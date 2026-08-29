import traceback
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
import csv
import xml.etree.ElementTree as ET
import io
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
import uvicorn
import sqlite3
import httpx
import json
import time
import cloudscraper
import re
import asyncio
import subprocess
from bs4 import BeautifulSoup
import urllib.parse

from input_parser import auto_parse, get_all_raw_titles, _resolve_by_ids, _load_title_map, AnimeEntry
from preference_encoder import EncodedPreference
from recommender import recommend as core_recommend
from rapidfuzz import fuzz, process
from mal_scraper import scrape_base, enrich_metadata

app = FastAPI(title="Don't Judge a Book by Its Cover - API")

def init_db():
    with sqlite3.connect("user_library.db") as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_library (
                mal_id INTEGER PRIMARY KEY,
                status TEXT DEFAULT 'Watching',
                episodes_watched INTEGER DEFAULT 0,
                score REAL DEFAULT 0,
                worth_level TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            conn.execute("ALTER TABLE user_library ADD COLUMN worth_level TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass # Column already exists
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mal_id INTEGER,
                title TEXT,
                episode INTEGER,
                message TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(mal_id, episode)
            )
        """)

async def notification_worker():
    while True:
        try:
            with sqlite3.connect("user_library.db") as conn:
                conn.row_factory = sqlite3.Row
                watching = conn.execute("SELECT mal_id, episodes_watched FROM user_library WHERE status = 'Watching'").fetchall()
            
            if watching:
                mal_ids = [row["mal_id"] for row in watching]
                watched_map = {row["mal_id"]: row["episodes_watched"] for row in watching}
                
                query = """
                query ($in: [Int]) {
                  Page(page: 1, perPage: 50) {
                    media(idMal_in: $in, type: ANIME, status: RELEASING) {
                      idMal
                      title { romaji english }
                      nextAiringEpisode {
                        episode
                      }
                      episodes
                    }
                  }
                }
                """
                async with httpx.AsyncClient() as client:
                    resp = await client.post("https://graphql.anilist.co", json={"query": query, "variables": {"in": mal_ids}})
                    if resp.status_code == 200:
                        media_list = resp.json().get('data', {}).get('Page', {}).get('media', [])
                        with sqlite3.connect("user_library.db") as conn:
                            for media in media_list:
                                mal_id = media.get('idMal')
                                title = media.get('title', {}).get('english') or media.get('title', {}).get('romaji')
                                next_airing = media.get('nextAiringEpisode')
                                episodes = media.get('episodes')
                                
                                current_ep = None
                                if next_airing:
                                    current_ep = next_airing.get('episode') - 1
                                elif episodes:
                                    current_ep = episodes
                                
                                if current_ep and current_ep > 0 and current_ep > watched_map.get(mal_id, 0):
                                    # Insert notification for this episode
                                    try:
                                        msg = f"Episode {current_ep} of {title} is now available!"
                                        conn.execute(
                                            "INSERT INTO notifications (mal_id, title, episode, message) VALUES (?, ?, ?, ?)",
                                            (mal_id, title, current_ep, msg)
                                        )
                                        conn.commit()
                                    except sqlite3.IntegrityError:
                                        pass # Already notified
        except Exception as e:
            print(f"Notification worker error: {e}")
            
        await asyncio.sleep(600)  # Poll every 10 minutes

@app.on_event("startup")
async def startup_event():
    init_db()
    asyncio.create_task(notification_worker())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecommendRequest(BaseModel):
    anime_input: str
    preference: Optional[str] = ""
    plot_preference: Optional[str] = ""
    audio_preference: Optional[str] = ""
    top_n: int = 6
    preferred_year: Optional[int] = None
    use_library: Optional[bool] = False

@app.post("/api/recommend")
async def get_recommendations(req: RecommendRequest):
    try:
        # Parse liked anime
        liked_anime = []
        if req.use_library:
            with sqlite3.connect("user_library.db") as udb:
                udb_cursor = udb.cursor()
                udb_cursor.execute("SELECT mal_id, worth_level FROM user_library WHERE status IN ('Completed', 'Watching')")
                library_items = udb_cursor.fetchall()
                
            if library_items:
                mal_ids = [item[0] for item in library_items]
                worth_levels = {item[0]: item[1] for item in library_items}
                
                with sqlite3.connect("anime_data.db") as adb:
                    adb.row_factory = sqlite3.Row
                    adb_cursor = adb.cursor()
                    adb_cursor.execute(f"SELECT mal_id, title_english, title, genres, score, local_image_path FROM anime WHERE mal_id IN ({','.join(map(str, mal_ids))})")
                    for row in adb_cursor.fetchall():
                        mal_id = row['mal_id']
                        worth = worth_levels.get(mal_id, '').lower()
                        
                        weight = 1.0
                        if 'high' in worth or '++' in worth: weight = 1.5
                        elif 'low' in worth or '--' in worth: weight = 0.5
                        
                        liked_anime.append(AnimeEntry(
                            mal_id=mal_id,
                            title=row['title_english'] or row['title'],
                            title_english=row['title_english'],
                            title_japanese=row['title'],
                            genres=row['genres'],
                            score=row['score'],
                            local_image_path=row['local_image_path'],
                            weight=weight
                        ))
        else:
            liked_anime = auto_parse(req.anime_input.strip() if req.anime_input else "")
            
        if not liked_anime:
            raise HTTPException(status_code=400, detail="Could not resolve any anime from input or library.")
            
        # Encode preference
        pref_text = req.preference.strip() if req.preference else ""
        text_embedding = None
        genre_filter = None
        era_year = req.preferred_year
        
        if pref_text:
            enc = EncodedPreference(pref_text)
            text_embedding = enc.text_embedding
            genre_filter = enc.genres if enc.genres else None
            if not era_year:
                era_year = enc.era_year
                
        plot_pref_text = req.plot_preference.strip() if req.plot_preference else None
        audio_pref_text = req.audio_preference.strip() if req.audio_preference else None
        
        n_candidates = max(req.top_n * 5, 150) + ((len(genre_filter) * 50) if genre_filter else 0)
        fetch_n = req.top_n + len(liked_anime) + 50
        
        results = core_recommend(
            liked_anime=liked_anime,
            preference_text_embed=text_embedding,
            plot_preference_text=plot_pref_text,
            audio_preference_text=audio_pref_text,
            genre_filter=genre_filter,
            era_year=era_year,
            top_n=fetch_n,
            n_candidates=n_candidates
        )
        
        if not results:
            return {"status": "error", "message": "No recommendations found.", "results": []}

        # Post filter to remove things already in the input
        EXCLUSION_THRESHOLD = 78
        raw_input_titles = get_all_raw_titles(req.anime_input.strip())

        def _is_watched(rec) -> bool:
            candidates = [
                rec.title.lower() if rec.title else "",
                rec.title_english.lower() if rec.title_english else "",
            ]
            for raw_title in raw_input_titles:
                if not raw_title or raw_title.isdigit() or len(raw_title) <= 2:
                    continue
                for cand in candidates:
                    if cand and fuzz.WRatio(raw_title, cand) >= EXCLUSION_THRESHOLD:
                        return True
            return False

        filtered = [r for r in results if not _is_watched(r)]
        results = filtered[:req.top_n]
            
        # Format results for frontend
        output = []
        with sqlite3.connect("anime_data.db") as conn:
            for i, r in enumerate(results):
                # Convert local_image_path to something the frontend can fetch
                # We will serve the 'covers' directory statically
                cover_url = f"http://localhost:8000/covers/{os.path.basename(r.local_image_path)}" if r.local_image_path else None
                
                c = conn.cursor()
                c.execute("SELECT aired_from, episodes FROM anime WHERE mal_id = ?", (r.mal_id,))
                row = c.fetchone()
                year = None
                episodes = None
                if row:
                    aired_from, eps = row
                    if aired_from:
                        year = aired_from[:4]
                    episodes = eps
                
                output.append({
                    "mal_id": r.mal_id,
                    "rank": i + 1,
                    "title": r.title,
                    "title_english": r.title_english,
                    "score": r.score,
                    "members": r.members,
                    "genres": r.genres,
                    "similarity": r.similarity,
                    "plot_similarity": r.plot_similarity,
                    "audio_similarity": r.audio_similarity,
                    "cover_url": cover_url,
                    "year": year,
                    "episodes": episodes
                })
            
        return {"status": "success", "results": output}
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def get_library_sqlite():
    conn = sqlite3.connect('anime_data.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    categories = ["Action", "Romance", "Comedy", "Sci-Fi", "Drama", "Fantasy", "Thriller", "Slice of Life"]
    library_data = []
    
    for cat in categories:
        c.execute("""
            SELECT title, title_english, score, genres, local_image_path, theme_local_path, synopsis, year, episodes
            FROM anime 
            WHERE genres LIKE ? AND local_image_path IS NOT NULL
            ORDER BY members DESC 
            LIMIT 15
        """, (f'%{cat}%',))
        
        rows = c.fetchall()
        anime_list = []
        for r in rows:
            cover_url = f"http://localhost:8000/covers/{os.path.basename(r['local_image_path'])}" if r['local_image_path'] else None
            theme_url = f"http://localhost:8000/themes/{os.path.basename(r['theme_local_path'])}" if r['theme_local_path'] else None
            
            anime_list.append({
                "title": r['title_english'] or r['title'],
                "title_original": r['title'],
                "score": r['score'],
                "genres": r['genres'],
                "synopsis": r['synopsis'],
                "year": r['year'],
                "episodes": r['episodes'],
                "cover_url": cover_url,
                "theme_url": theme_url
            })
        
        if anime_list:
            library_data.append({
                "category": cat,
                "anime": anime_list
            })
            
    conn.close()
    
    hero_animes = library_data[0]["anime"][:5] if library_data and library_data[0]["anime"] else []
    if hero_animes:
        library_data[0]["anime"] = library_data[0]["anime"][5:]
    
    return {
        "status": "success",
        "heroAnimes": hero_animes,
        "categories": library_data
    }

# Memory Cache
_LIBRARY_CACHE = None
_LIBRARY_CACHE_TIME = 0

def upsert_anime_to_db(item: dict, cover_url: str, synopsis: str):
    """Dynamically inserts missing anime from AniList into the local SQLite database."""
    mal_id = item.get('idMal')
    if not mal_id: return
    
    title = item.get('title', {}).get('english') or item.get('title', {}).get('romaji')
    title_english = item.get('title', {}).get('english') or ""
    score = (item.get('averageScore') or 0) / 10.0
    episodes = item.get('episodes')
    members = item.get('popularity')
    year = item.get('seasonYear')
    genres = ", ".join(item.get('genres', []))
    status = item.get('status')
    
    try:
        conn = sqlite3.connect('anime_data.db')
        c = conn.cursor()
        c.execute("""
            INSERT INTO anime (
                mal_id, title, title_english, score, episodes, 
                members, synopsis, year, genres, image_url, status, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mal_id) DO UPDATE SET
                title_english = CASE WHEN (anime.title_english IS NULL OR anime.title_english = '') THEN excluded.title_english ELSE anime.title_english END,
                synopsis = CASE WHEN (anime.synopsis IS NULL OR anime.synopsis = '') THEN excluded.synopsis ELSE anime.synopsis END,
                image_url = CASE WHEN (anime.image_url IS NULL OR anime.image_url = '') THEN excluded.image_url ELSE anime.image_url END,
                genres = CASE WHEN (anime.genres IS NULL OR anime.genres = '') THEN excluded.genres ELSE anime.genres END
        """, (
            mal_id, title, title_english, score, episodes,
            members, synopsis, year, genres, cover_url, status, 'anilist_dynamic'
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to dynamic upsert {title}: {e}")

def get_local_data_for_mal_id(mal_id: int):
    conn = sqlite3.connect('anime_data.db')
    c = conn.cursor()
    c.execute("SELECT local_image_path, theme_local_path, episodes, members FROM anime WHERE mal_id = ?", (mal_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0], row[1], row[2], row[3]
    return None, None, None, None

@app.get("/api/library")
async def get_library():
    global _LIBRARY_CACHE, _LIBRARY_CACHE_TIME
    try:
        # Check cache (1 hour)
        if _LIBRARY_CACHE and time.time() - _LIBRARY_CACHE_TIME < 3600:
            return _LIBRARY_CACHE

        try:
            hero_animes = []
            categories = [
                {"id": "recent", "name": "Recently Updated", "sort": "UPDATED_AT_DESC", "status": "RELEASING"},
                {"id": "upcoming", "name": "Upcoming Anime", "sort": "POPULARITY_DESC", "status": "NOT_YET_RELEASED"},
                {"id": "new", "name": "New Release", "sort": "START_DATE_DESC", "status": "RELEASING"},
                {"id": "completed", "name": "Just Completed", "sort": "END_DATE_DESC", "status": "FINISHED"}
            ]
            library_data = []
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                # 1. Fetch Top Trending for Heroes via AniList
                hero_query = """
                query {
                  Page(page: 1, perPage: 20) {
                    media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) {
                      idMal
                      title { romaji english }
                      coverImage { extraLarge }
                      bannerImage
                      genres
                      episodes
                      seasonYear
                      description
                      averageScore
                      format
                      popularity
                    }
                  }
                }
                """
                resp_hero = await client.post("https://graphql.anilist.co", json={"query": hero_query})
                resp_hero.raise_for_status()
                
                valid_heroes = []
                for item in resp_hero.json().get('data', {}).get('Page', {}).get('media', []):
                    # Anikoto-style filtering: Only allow anime with actual banner images in the Hero section!
                    if not item.get('bannerImage'): continue
                    if len(valid_heroes) >= 5: break
                    
                    mal_id = item.get('idMal')
                    if not mal_id: continue
                    local_image, local_theme, local_episodes, local_members = get_local_data_for_mal_id(mal_id)
                    cover_url = f"http://localhost:8000/covers/{os.path.basename(local_image)}" if local_image else item.get('coverImage', {}).get('extraLarge')
                    theme_url = f"http://localhost:8000/themes/{os.path.basename(local_theme)}" if local_theme else None
                    
                    synopsis = (item.get('description') or "").replace("<br>", "").replace("<i>", "").replace("</i>", "")
                    
                    hero_animes.append({
                        "mal_id": mal_id,
                        "title": item.get('title', {}).get('english') or item.get('title', {}).get('romaji'),
                        "title_original": item.get('title', {}).get('romaji'),
                        "score": (item.get('averageScore') or 0) / 10.0,
                        "genres": ", ".join(item.get('genres', [])),
                        "synopsis": synopsis,
                        "year": item.get('seasonYear'),
                        "episodes": item.get('episodes') or local_episodes,
                        "type": item.get('format'),
                        "members": local_members or item.get('popularity'),
                        "cover_url": cover_url,
                        "banner_url": item.get('bannerImage'),
                        "theme_url": theme_url
                    })
                    
                    upsert_anime_to_db(item, cover_url, synopsis)
                        
                    valid_heroes.append(item)
                
                # 2. Fetch Categories via AniList
                cat_query = """
                query ($sort: [MediaSort], $status: MediaStatus) {
                  Page(page: 1, perPage: 15) {
                    media(sort: $sort, type: ANIME, status: $status) {
                      idMal
                      title { romaji english }
                      coverImage { extraLarge }
                      bannerImage
                      genres
                      episodes
                      seasonYear
                      description
                      averageScore
                      format
                      popularity
                    }
                  }
                }
                """
                for cat in categories:
                    resp = await client.post("https://graphql.anilist.co", json={"query": cat_query, "variables": {"sort": [cat["sort"]], "status": cat["status"]}})
                    resp.raise_for_status()
                    data = resp.json().get('data', {}).get('Page', {}).get('media', [])
                    
                    anime_list = []
                    for item in data:
                        mal_id = item.get('idMal')
                        if not mal_id: continue
                        local_image, local_theme, local_episodes, local_members = get_local_data_for_mal_id(mal_id)
                        
                        cover_url = f"http://localhost:8000/covers/{os.path.basename(local_image)}" if local_image else item.get('coverImage', {}).get('extraLarge')
                        theme_url = f"http://localhost:8000/themes/{os.path.basename(local_theme)}" if local_theme else None
                        
                        synopsis = (item.get('description') or "").replace("<br>", "").replace("<i>", "").replace("</i>", "")
                        
                        anime_list.append({
                            "mal_id": mal_id,
                            "title": item.get('title', {}).get('english') or item.get('title', {}).get('romaji'),
                            "title_original": item.get('title', {}).get('romaji'),
                            "score": (item.get('averageScore') or 0) / 10.0,
                            "genres": ", ".join(item.get('genres', [])),
                            "synopsis": synopsis,
                            "year": item.get('seasonYear'),
                            "episodes": item.get('episodes') or local_episodes,
                            "type": item.get('format'),
                            "members": local_members or item.get('popularity'),
                            "cover_url": cover_url,
                            "banner_url": item.get('bannerImage'),
                            "theme_url": theme_url
                        })
                        
                        upsert_anime_to_db(item, cover_url, synopsis)
                    
                    if anime_list:
                        library_data.append({
                            "category": cat['name'],
                            "anime": anime_list
                        })
                    # AniList rate limits are higher, no strict sleep needed for 4 requests, but adding a small delay just in case
                    await asyncio.sleep(0.1)
                    
            result = {
                "status": "success",
                "heroAnimes": hero_animes,
                "categories": library_data
            }
            
            with open('library_cache.json', 'w') as f:
                json.dump(result, f)
                
            _LIBRARY_CACHE = result
            _LIBRARY_CACHE_TIME = time.time()
            return result
            
        except Exception as api_e:
            print(f"AniList API failed: {api_e}.")
            if os.path.exists('library_cache.json'):
                with open('library_cache.json', 'r') as f:
                    _LIBRARY_CACHE = json.load(f)
                _LIBRARY_CACHE_TIME = time.time()
                return _LIBRARY_CACHE
            else:
                return get_library_sqlite()
                
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if os.path.exists("covers"):
    app.mount("/covers", StaticFiles(directory="covers"), name="covers")

if os.path.exists("themes"):
    app.mount("/themes", StaticFiles(directory="themes"), name="themes")

class UserLibraryUpdate(BaseModel):
    mal_id: int
    status: Optional[str] = None
    episodes_watched: Optional[int] = None
    score: Optional[float] = None
    worth_level: Optional[str] = None
    notes: Optional[str] = None

@app.delete("/api/user_library/{mal_id}")
async def delete_user_library_item(mal_id: int):
    try:
        with sqlite3.connect("user_library.db") as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_library WHERE mal_id = ?", (mal_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/anime/{mal_id}")
def get_anime_details(mal_id: int):
    conn = sqlite3.connect("anime_data.db")
    conn.row_factory = sqlite3.Row
    anime = conn.execute('SELECT * FROM anime WHERE mal_id = ?', (mal_id,)).fetchone()
    conn.close()
    if anime:
        anime_dict = dict(anime)
        if anime_dict.get('local_image_path'):
            anime_dict['cover_url'] = f"http://localhost:8000/covers/{os.path.basename(anime_dict['local_image_path'])}"
        else:
            anime_dict['cover_url'] = anime_dict.get('image_url')
        return anime_dict
    raise HTTPException(status_code=404, detail="Anime not found")

@app.get("/api/random")
def get_random_anime():
    conn = sqlite3.connect("anime_data.db")
    conn.row_factory = sqlite3.Row
    anime = conn.execute('SELECT * FROM anime ORDER BY RANDOM() LIMIT 1').fetchone()
    conn.close()
    if anime:
        anime_dict = dict(anime)
        if anime_dict.get('local_image_path'):
            anime_dict['cover_url'] = f"http://localhost:8000/covers/{os.path.basename(anime_dict['local_image_path'])}"
        else:
            anime_dict['cover_url'] = anime_dict.get('image_url')
        return anime_dict
    raise HTTPException(status_code=404, detail="No anime found")

@app.get("/api/user_library")
async def get_user_library():
    try:
        with sqlite3.connect("user_library.db") as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("ATTACH DATABASE 'anime_data.db' AS anime_db")
            cursor.execute("""
                SELECT 
                    u.mal_id, u.status, u.episodes_watched, u.score, u.worth_level, u.updated_at, u.notes,
                    a.title, a.title_english, a.genres, a.episodes as total_episodes,
                    a.season, a.year, a.image_url, a.local_image_path, a.synopsis, a.score as global_score
                FROM user_library u
                JOIN anime_db.anime a ON u.mal_id = a.mal_id
                ORDER BY u.updated_at DESC
            """)
            rows = cursor.fetchall()
            library = []
            for row in rows:
                item = dict(row)
                if item.get("local_image_path") and os.path.exists(item["local_image_path"]):
                    item["cover_url"] = f"http://localhost:8000/covers/{os.path.basename(item['local_image_path'])}"
                else:
                    item["cover_url"] = item.get("image_url") or ""
                library.append(item)
            return {"status": "success", "library": library}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user_library")
async def update_user_library(update: UserLibraryUpdate):
    try:
        with sqlite3.connect("user_library.db") as conn:
            cursor = conn.cursor()
            
            # Check if exists
            cursor.execute("SELECT status, episodes_watched, score, worth_level, notes FROM user_library WHERE mal_id = ?", (update.mal_id,))
            row = cursor.fetchone()
            
            if row:
                new_status = update.status if update.status is not None else row[0]
                new_episodes = update.episodes_watched if update.episodes_watched is not None else row[1]
                new_score = update.score if update.score is not None else row[2]
                new_worth = update.worth_level if update.worth_level is not None else row[3]
                new_notes = update.notes if update.notes is not None else row[4]
                
                cursor.execute("""
                    UPDATE user_library 
                    SET status = ?, episodes_watched = ?, score = ?, worth_level = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE mal_id = ?
                """, (new_status, new_episodes, new_score, new_worth, new_notes, update.mal_id))
            else:
                new_status = update.status if update.status is not None else 'Watching'
                new_episodes = update.episodes_watched if update.episodes_watched is not None else 0
                new_score = update.score if update.score is not None else 0
                new_worth = update.worth_level if update.worth_level is not None else ''
                new_notes = update.notes if update.notes is not None else ''
                
                cursor.execute("""
                    INSERT INTO user_library (mal_id, status, episodes_watched, score, worth_level, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (update.mal_id, new_status, new_episodes, new_score, new_worth, new_notes))
            
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user_library/{mal_id}")
async def delete_user_library(mal_id: int):
    try:
        with sqlite3.connect("user_library.db") as conn:
            conn.execute("DELETE FROM user_library WHERE mal_id = ?", (mal_id,))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/library/export")
async def export_user_library(format: str = "xml"):
    try:
        with sqlite3.connect("user_library.db") as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.mal_id, u.status, u.episodes_watched, u.score, u.worth_level
                FROM user_library u
            """)
            rows = cursor.fetchall()

        # Fetch titles for the XML from anime_data.db
        with sqlite3.connect("anime_data.db") as conn2:
            conn2.row_factory = sqlite3.Row
            cursor2 = conn2.cursor()
            anime_info = {}
            if rows:
                mal_ids = [str(r['mal_id']) for r in rows]
                cursor2.execute(f"SELECT mal_id, title_english, title, episodes FROM anime WHERE mal_id IN ({','.join(mal_ids)})")
                for r in cursor2.fetchall():
                    anime_info[r['mal_id']] = dict(r)
                    
        # Status Mapping (Anikoto -> MAL)
        status_map = {
            "Completed": "Completed",
            "Watching": "Watching",
            "On-Hold": "On-Hold",
            "Dropped": "Dropped",
            "Plan to Watch": "Planned"
        }

        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["ID", "title", "status", "score", "episodes_watched", "total_episodes", "worth_level"])
            for r in rows:
                mal_id = r['mal_id']
                info = anime_info.get(mal_id, {})
                title = info.get('title_english') or info.get('title') or f"Unknown {mal_id}"
                total_episodes = info.get('episodes') or 0
                writer.writerow([
                    mal_id, 
                    title,
                    status_map.get(r['status'], r['status']),
                    r['score'],
                    r['episodes_watched'],
                    total_episodes,
                    r['worth_level']
                ])
            return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=library_export.csv"})
        
        else: # xml
            import xml.dom.minidom
            root = ET.Element("myanimelist")
            myinfo = ET.SubElement(root, "myinfo")
            ET.SubElement(myinfo, "user_name").text = "AnikotoUser"
            ET.SubElement(myinfo, "user_export_type").text = "1"
            
            for r in rows:
                anime = ET.SubElement(root, "anime")
                mal_id = r['mal_id']
                info = anime_info.get(mal_id, {})
                
                ET.SubElement(anime, "series_animedb_id").text = str(mal_id)
                ET.SubElement(anime, "series_title").text = "___CDATA___" + str(info.get('title_english') or info.get('title') or f"Unknown {mal_id}") + "___ENDCDATA___"
                ET.SubElement(anime, "series_type").text = "TV"
                ET.SubElement(anime, "series_episodes").text = str(info.get('episodes') or 0)
                
                ET.SubElement(anime, "my_watched_episodes").text = str(r['episodes_watched'])
                ET.SubElement(anime, "my_score").text = str(r['score'])
                ET.SubElement(anime, "my_status").text = status_map.get(r['status'], r['status'])
                
            xml_str = ET.tostring(root, encoding='unicode', xml_declaration=False)
            xml_str = xml.dom.minidom.parseString(xml_str).toprettyxml(indent="\t")
            xml_str = xml_str.replace('<?xml version="1.0" ?>', '<?xml version="1.0" encoding="UTF-8" ?>\n\t\t<!--\n\t\t Created by XML Export feature at MyAnimeList.net\n\t\t-->\n')
            xml_str = xml_str.replace("___CDATA___", "<![CDATA[").replace("___ENDCDATA___", "]]>")
            return Response(content=xml_str, media_type="application/xml", headers={"Content-Disposition": "attachment; filename=library_export.xml"})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/library/import")
async def import_user_library(file: UploadFile = File(...), overwrite: bool = Form(False)):
    try:
        content = await file.read()
        
        # Status Mapping (MAL -> Anikoto)
        status_map = {
            "Completed": "Completed",
            "Watching": "Watching",
            "On-Hold": "On-Hold",
            "Dropped": "Dropped",
            "Plan to Watch": "Planned"
        }
        
        imported_entries = []
        
        if file.filename.endswith(".csv"):
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            
            with sqlite3.connect("anime_data.db") as adb:
                adb_cursor = adb.cursor()
                for row in reader:
                    mal_id = 0
                    try:
                        mal_id = int(row.get('anime_id', 0) or row.get('mal_id', 0) or 0)
                    except ValueError:
                        pass
                        
                    if mal_id <= 0:
                        title = row.get('Anime', '') or row.get('title', '') or row.get('Anime Movie', '')
                        if not title: continue
                        adb_cursor.execute("SELECT mal_id FROM anime WHERE title_english LIKE ? OR title LIKE ? COLLATE NOCASE", (f"%{title}%", f"%{title}%"))
                        res = adb_cursor.fetchone()
                        if res:
                            mal_id = res[0]
                        else:
                            continue
                            
                    status = status_map.get(row.get('status', ''), "Completed") # Default to Completed for Ani.csv
                    score = float(row.get('score', 0) or 0)
                    ep_str = row.get('my_watched_episodes', '') or row.get('episodes_watched', '') or row.get('Ep. No.', '')
                    try:
                        episodes_watched = int(ep_str) if ep_str else 0
                    except ValueError:
                        episodes_watched = 0
                    worth_level = row.get('worth_level', '') or row.get('Worth Level', '')
                    
                    # Fetch base info to check for overflow
                    adb_cursor.execute("SELECT title_english, title, episodes FROM anime WHERE mal_id = ?", (mal_id,))
                    base_res = adb_cursor.fetchone()
                    if not base_res:
                        imported_entries.append((mal_id, status, episodes_watched, score, worth_level))
                        continue
                        
                    base_total_eps = base_res[2] or 0
                    base_title = base_res[0] or base_res[1] or ""
                    
                    if base_total_eps > 0 and episodes_watched > base_total_eps:
                        # Distribute Overflow
                        imported_entries.append((mal_id, "Completed", base_total_eps, score, worth_level))
                        remaining = episodes_watched - base_total_eps
                        
                        # Extract core franchise name
                        search_term = base_title.split(':')[0]
                        if ' Season' in search_term: search_term = search_term.split(' Season')[0]
                        if len(search_term) < 4: search_term = base_title
                            
                        # Query sequels
                        adb_cursor.execute("""
                            SELECT mal_id, episodes, title, title_english 
                            FROM anime 
                            WHERE (title_english LIKE ? OR title LIKE ? COLLATE NOCASE) 
                            AND mal_id != ? 
                            ORDER BY year ASC, aired_from ASC
                        """, (f"{search_term}%", f"{search_term}%", mal_id))
                        
                        for rel in adb_cursor.fetchall():
                            if remaining <= 0: break
                            rel_id, rel_eps = rel[0], rel[1] or 0
                            rel_title = str(rel[2] or '').lower() + ' ' + str(rel[3] or '').lower()
                            
                            if rel_eps == 0: continue
                            
                            # Filter out common spin-offs, OVAs, movies, and recaps
                            skip_keywords = [
                                'ova', 'ona', 'oad', 'movie', 'picture drama', 'recap', 'special', 
                                'junior high', 'chibi', 'bow and arrow', 'wings of freedom', 
                                'roar of awakening', 'chronicle', 'music', 'digest', 'preview', 'summary',
                                'no regrets', 'lost girls'
                            ]
                            if any(kw in rel_title for kw in skip_keywords):
                                continue
                                
                            # Also skip short series (usually OVAs/specials) if distributing
                            if rel_eps < 5 and base_total_eps > 8:
                                continue
                                
                            if remaining >= rel_eps:
                                imported_entries.append((rel_id, "Completed", rel_eps, score, worth_level))
                                remaining -= rel_eps
                            else:
                                imported_entries.append((rel_id, "Watching", remaining, score, worth_level))
                                remaining = 0
                    else:
                        imported_entries.append((mal_id, status, episodes_watched, score, worth_level))
                
        elif file.filename.endswith(".xml"):
            root = ET.fromstring(content)
            for anime in root.findall('anime'):
                mal_id_el = anime.find('series_animedb_id')
                if mal_id_el is None or not mal_id_el.text: continue
                mal_id = int(mal_id_el.text)
                
                status_el = anime.find('my_status')
                status = status_map.get(status_el.text if status_el is not None else '', "Watching")
                
                score_el = anime.find('my_score')
                score = float(score_el.text) if score_el is not None and score_el.text else 0
                
                eps_el = anime.find('my_watched_episodes')
                episodes_watched = int(eps_el.text) if eps_el is not None and eps_el.text else 0
                
                imported_entries.append((mal_id, status, episodes_watched, score, ""))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        with sqlite3.connect("user_library.db") as conn:
            cursor = conn.cursor()
            if overwrite:
                cursor.execute("DELETE FROM user_library")
            
            for mal_id, status, episodes_watched, score, worth_level in imported_entries:
                cursor.execute("SELECT mal_id FROM user_library WHERE mal_id = ?", (mal_id,))
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE user_library 
                        SET status = ?, episodes_watched = ?, score = ?, worth_level = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE mal_id = ?
                    """, (status, episodes_watched, score, worth_level, mal_id))
                else:
                    cursor.execute("""
                        INSERT INTO user_library (mal_id, status, episodes_watched, score, worth_level)
                        VALUES (?, ?, ?, ?, ?)
                    """, (mal_id, status, episodes_watched, score, worth_level))
            conn.commit()
            
        return {"status": "success", "imported": len(imported_entries)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Query

@app.get("/api/search")
async def search_anime(
    q: Optional[str] = None,
    genres: Optional[str] = None,
    season: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    format: Optional[str] = None,
    sort: Optional[str] = "trending",
    page: int = 1,
    limit: int = 30
):
    try:
        with sqlite3.connect("anime_data.db") as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = "SELECT * FROM anime WHERE 1=1"
            params = []
            
            if q:
                # Use rapidfuzz for intelligent typo-tolerant search
                title_map = _load_title_map()
                candidates = []
                for mid, info in title_map.items():
                    if info['title']: candidates.append((mid, info['title']))
                    if info['title_english']: candidates.append((mid, info['title_english']))
                    if info['title_japanese']: candidates.append((mid, info['title_japanese']))
                
                choices = [c[1] for c in candidates]
                # Extract top 50 matches using WRatio
                results_fuzzy = process.extract(q, choices, scorer=fuzz.WRatio, limit=50)
                
                matched_ids = []
                for match_str, score, idx in results_fuzzy:
                    if score > 50: # Minimum confidence threshold
                        mal_id = candidates[idx][0]
                        if mal_id not in matched_ids:
                            matched_ids.append(mal_id)
                
                if matched_ids:
                    placeholders = ",".join("?" for _ in matched_ids)
                    query += f" AND mal_id IN ({placeholders})"
                    params.extend(matched_ids)
                    
                    case_stmts = " ".join([f"WHEN {mid} THEN {i}" for i, mid in enumerate(matched_ids)])
                    fuzzy_order = f"CASE mal_id {case_stmts} ELSE 9999 END"
                else:
                    query += " AND 1=0" # No matches found
                    fuzzy_order = None
                
            if genres:
                for genre in genres.split(","):
                    query += " AND genres LIKE ?"
                    params.append(f"%{genre.strip()}%")
                    
            if season:
                query += " AND season = ?"
                params.append(season)
                
            if year:
                query += " AND year = ?"
                params.append(year)
                
            if status:
                query += " AND status LIKE ?"
                params.append(f"%{status}%")
                
            if format:
                if format.upper() == 'TV':
                    query += " AND (episodes > 1 OR episodes IS NULL)"
                elif format.upper() == 'MOVIE' or format.upper() == 'OVA':
                    query += " AND episodes = 1"
                    
            if q and fuzzy_order:
                query += f" ORDER BY {fuzzy_order} ASC"
            elif sort == "popularity":
                query += " ORDER BY members DESC"
            elif sort == "score":
                query += " ORDER BY score DESC"
            elif sort == "title":
                query += " ORDER BY title_english ASC"
            elif sort == "date":
                query += " ORDER BY year DESC"
            else: # trending
                query += " ORDER BY members DESC, year DESC"
                
            offset = (page - 1) * limit
            query += f" LIMIT {limit} OFFSET {offset}"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            results = []
            for r in rows:
                cover_url = f"http://localhost:8000/covers/{os.path.basename(r['local_image_path'])}" if r['local_image_path'] else r['image_url']
                theme_url = f"http://localhost:8000/themes/{os.path.basename(r['theme_local_path'])}" if r['theme_local_path'] else None
                
                results.append({
                    "mal_id": r['mal_id'],
                    "title": r['title_english'] or r['title'],
                    "title_original": r['title'],
                    "score": r['score'],
                    "members": r['members'],
                    "genres": r['genres'],
                    "synopsis": r['synopsis'],
                    "year": r['year'],
                    "season": r['season'],
                    "episodes": r['episodes'],
                    "status": r['status'],
                    "cover_url": cover_url,
                    "theme_url": theme_url
                })
                
            return {"status": "success", "results": results, "page": page}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations/{mal_id}")
async def get_recommendations(mal_id: int):
    try:
        # Resolve the mal_id to an AnimeEntry using the input parser
        liked = _resolve_by_ids([mal_id])
        if not liked:
            return {"status": "error", "message": "Anime not found or missing from database."}
            
        # Fetch recommendations using the ML recommender engine
        # top_n=6 because the first result might be the anime itself (if not perfectly filtered)
        try:
            recs = core_recommend(liked_anime=liked, top_n=6)
        except ValueError as ve:
            print(f"[api] Recommendation fallback: {ve}")
            recs = []
        except Exception as e:
            print(f"[api] Recommendation error: {e}")
            recs = []
        
        # Format results
        results = []
        with sqlite3.connect("anime_data.db") as conn:
            for r in recs:
                # Skip the anime itself if it appears
                if r.mal_id == mal_id:
                    continue
                    
                cover_url = f"http://localhost:8000/covers/{os.path.basename(r.local_image_path)}" if r.local_image_path else ""
                
                # Fetch missing metadata (year, episodes) from db
                c = conn.cursor()
                c.execute("SELECT aired_from, episodes FROM anime WHERE mal_id = ?", (r.mal_id,))
                row = c.fetchone()
                year = None
                episodes = None
                if row:
                    aired_from, eps = row
                    if aired_from:
                        year = aired_from[:4]
                    episodes = eps
                
                results.append({
                    "mal_id": r.mal_id,
                    "title": r.title_english or r.title,
                    "title_original": r.title,
                    "score": r.score,
                    "members": r.members,
                    "genres": r.genres,
                    "cover_url": cover_url,
                    "year": year,
                    "episodes": episodes
                })
                
                # Limit to 5 strictly
                if len(results) == 5:
                    break
            
        return {"status": "success", "recommendations": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/play")
async def play_episode(title: str, episode: int, alt_title: str = None, dub: bool = False, quality: str = "best", provider: str = "anidb"):
    try:
        if provider == "anikoto":
            raise HTTPException(status_code=501, detail="Anikoto scraper is under construction. Please use Anidb.")

        # Pre-search logic to prevent wrong video playback
        import urllib.parse
        import difflib
        import re
        
        env = os.environ.copy()
        env["PATH"] = f"{os.path.expanduser('~')}/.local/bin:" + env.get("PATH", "")
        
        selection_index = 1
        active_search_title = title
        try:
            # We'll search using the English title by default since Anidb is heavily English-indexed
            search_query = title.replace(' ', '+')
            search_url = f"https://anidb.app/browse?q={search_query}"
            
            curl_proc = await asyncio.create_subprocess_exec(
                "curl_chrome116", "-sL", 
                search_url,
                env=env,
                stdout=asyncio.subprocess.PIPE
            )
            try:
                stdout, _ = await asyncio.wait_for(curl_proc.communicate(), timeout=15.0)
            except asyncio.TimeoutError:
                curl_proc.kill()
                raise HTTPException(status_code=504, detail="Pre-search validation timed out on Anidb.")
                
            html = stdout.decode('utf-8', errors='ignore').replace('\n', ' ')
            
            matches = re.findall(r'anime/[a-z0-9-]+-[0-9]+".*?alt="([^"]+)"', html)
            if not matches:
                # Fallback: Try searching with alt_title if initial search yields 0 results
                if alt_title:
                    active_search_title = alt_title
                    search_query = alt_title.replace(' ', '+')
                    search_url = f"https://anidb.app/browse?q={search_query}"
                    curl_proc = await asyncio.create_subprocess_exec(
                        "curl_chrome116", "-sL", search_url, env=env, stdout=asyncio.subprocess.PIPE
                    )
                    try:
                        stdout, _ = await asyncio.wait_for(curl_proc.communicate(), timeout=15.0)
                    except asyncio.TimeoutError:
                        curl_proc.kill()
                        raise HTTPException(status_code=504, detail="Pre-search validation timed out on Anidb.")
                    html = stdout.decode('utf-8', errors='ignore').replace('\n', ' ')
                    matches = re.findall(r'anime/[a-z0-9-]+-[0-9]+".*?alt="([^"]+)"', html)
                    
                if not matches:
                    raise HTTPException(status_code=404, detail=f"Anime '{title}' not found on Anidb (0 search results).")
                
            best_idx = 1
            best_ratio = 0
            best_title = ""
            for i, anidb_title in enumerate(matches):
                clean_title = anidb_title.replace('&#039;', "'").replace('&quot;', '"').replace('&amp;', '&')
                ratio1 = difflib.SequenceMatcher(None, title.lower(), clean_title.lower()).ratio()
                ratio2 = difflib.SequenceMatcher(None, alt_title.lower(), clean_title.lower()).ratio() if alt_title else 0
                ratio = max(ratio1, ratio2)
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_idx = i + 1
                    best_title = clean_title
            
            if best_ratio < 0.6:
                raise HTTPException(status_code=404, detail=f"Anime '{title}' not found. Closest match was '{best_title}' ({best_ratio:.0%} similarity).")
            selection_index = best_idx
        except HTTPException:
            raise
        except Exception as e:
            print(f"Pre-search validation failed: {e}")

        # Execute ani-cli with the validated selection index and the search string that matched
        cmd = ["./ani-cli-master/ani-cli", active_search_title, "-q", quality, "-S", str(selection_index), "-e", str(episode), "--exit-after-play"]
        if dub:
            cmd.append("--dub")
        
        env = os.environ.copy()
        env["PATH"] = f"{os.path.expanduser('~')}/.local/bin:" + env.get("PATH", "")
        # Run process asynchronously so we don't block the API
        process = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        # Read output for up to 45 seconds to catch early errors (like "No results found")
        error_log = []
        try:
            async with asyncio.timeout(45.0):
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break
                    decoded_line = line.decode('utf-8').strip()
                    error_log.append(decoded_line)
                    
                    # If ani-cli successfully scraped and is launching mpv, it prints this:
                    if "Playing episode" in decoded_line or "anidb.app links fetched" in decoded_line or "Downloading" in decoded_line:
                        return {"status": "playing", "message": f"Launching player for {title} Episode {episode}"}
                        
        except asyncio.TimeoutError:
            # If it takes more than 10 seconds, it's likely stuck downloading or scraping very slowly.
            # We assume it's working to prevent the UI from hanging forever.
            return {"status": "playing", "message": f"Scraping is taking a while, but player will launch soon..."}
            
        # If we reach here, the process exited early.
        await process.wait()
        if process.returncode != 0:
            err = " ".join(error_log)
            if "No results found" in err or "Invalid episode" in err:
                raise HTTPException(status_code=404, detail="Could not find this anime or episode on ani-cli.")
            raise HTTPException(status_code=500, detail=f"ani-cli failed: {err[-200:]}")
            
        return {"status": "playing", "message": f"Launching player for {title} Episode {episode}"}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications")
async def get_notifications():
    try:
        with sqlite3.connect("user_library.db") as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReadNotificationRequest(BaseModel):
    notification_ids: list[int]

@app.post("/api/notifications/read")
async def mark_notifications_read(req: ReadNotificationRequest):
    try:
        with sqlite3.connect("user_library.db") as conn:
            for nid in req.notification_ids:
                conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (nid,))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/episodes_web_search")
async def get_episodes_web_search(title: str):
    try:
        query = urllib.parse.quote_plus(f"{title} total episodes")
        url = f"https://html.duckduckgo.com/html/?q={query}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, "html.parser")
        snippets = [a.text for a in soup.find_all("a", class_="result__snippet")]
        
        for s in snippets:
            match = re.search(r'(\d+)\s+Episodes?', s, re.IGNORECASE)
            if match:
                episodes = int(match.group(1))
                if 0 < episodes < 1500 and episodes != 2026:
                    return {"status": "success", "episodes": episodes}
                    
        return {"status": "error", "message": "Could not find episode count in web search"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
