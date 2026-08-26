import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os
import uvicorn
import sqlite3
import httpx
import json
import time
import asyncio

from input_parser import auto_parse, get_all_raw_titles, _resolve_by_ids, _load_title_map
from preference_encoder import EncodedPreference
from recommender import recommend as core_recommend
from rapidfuzz import fuzz, process

app = FastAPI(title="Don't Judge a Book by Its Cover - API")

def init_db():
    with sqlite3.connect("user_library.db") as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_library (
                mal_id INTEGER PRIMARY KEY,
                status TEXT DEFAULT 'Watching',
                episodes_watched INTEGER DEFAULT 0,
                score REAL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

@app.on_event("startup")
async def startup_event():
    init_db()

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

@app.post("/api/recommend")
async def get_recommendations(req: RecommendRequest):
    try:
        # Parse liked anime
        liked_anime = auto_parse(req.anime_input.strip())
        if not liked_anime:
            raise HTTPException(status_code=400, detail="Could not resolve any anime from input.")
            
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
        for i, r in enumerate(results):
            # Convert local_image_path to something the frontend can fetch
            # We will serve the 'covers' directory statically
            cover_url = f"http://localhost:8000/covers/{os.path.basename(r.local_image_path)}" if r.local_image_path else None
            
            output.append({
                "rank": i + 1,
                "title": r.title,
                "title_english": r.title_english,
                "score": r.score,
                "members": r.members,
                "genres": r.genres,
                "similarity": r.similarity,
                "plot_similarity": r.plot_similarity,
                "audio_similarity": r.audio_similarity,
                "cover_url": cover_url
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

def get_local_paths_for_mal_id(mal_id: int):
    conn = sqlite3.connect('anime_data.db')
    c = conn.cursor()
    c.execute("SELECT local_image_path, theme_local_path FROM anime WHERE mal_id = ?", (mal_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0], row[1]
    return None, None

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
                {"id": 1, "name": "Action"},
                {"id": 22, "name": "Romance"},
                {"id": 4, "name": "Comedy"},
                {"id": 24, "name": "Sci-Fi"}
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
                    local_image, local_theme = get_local_paths_for_mal_id(mal_id)
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
                        "episodes": item.get('episodes'),
                        "cover_url": cover_url,
                        "banner_url": item.get('bannerImage'),
                        "theme_url": theme_url
                    })
                    valid_heroes.append(item)
                
                # 2. Fetch Categories via AniList
                cat_query = """
                query ($genre: String) {
                  Page(page: 1, perPage: 15) {
                    media(sort: POPULARITY_DESC, type: ANIME, genre: $genre) {
                      idMal
                      title { romaji english }
                      coverImage { extraLarge }
                      bannerImage
                      genres
                      episodes
                      seasonYear
                      description
                      averageScore
                    }
                  }
                }
                """
                for cat in categories:
                    resp = await client.post("https://graphql.anilist.co", json={"query": cat_query, "variables": {"genre": cat["name"]}})
                    resp.raise_for_status()
                    data = resp.json().get('data', {}).get('Page', {}).get('media', [])
                    
                    anime_list = []
                    for item in data:
                        mal_id = item.get('idMal')
                        if not mal_id: continue
                        local_image, local_theme = get_local_paths_for_mal_id(mal_id)
                        
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
                            "episodes": item.get('episodes'),
                            "cover_url": cover_url,
                            "banner_url": item.get('bannerImage'),
                            "theme_url": theme_url
                        })
                    
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

@app.get("/api/user_library")
async def get_user_library():
    try:
        with sqlite3.connect("user_library.db") as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("ATTACH DATABASE 'anime_data.db' AS anime_db")
            cursor.execute("""
                SELECT 
                    u.mal_id, u.status, u.episodes_watched, u.score, u.updated_at,
                    a.title, a.title_english, a.genres, a.episodes as total_episodes,
                    a.season, a.year, a.image_url, a.local_image_path
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
            cursor.execute("SELECT status, episodes_watched, score FROM user_library WHERE mal_id = ?", (update.mal_id,))
            row = cursor.fetchone()
            
            if row:
                new_status = update.status if update.status is not None else row[0]
                new_episodes = update.episodes_watched if update.episodes_watched is not None else row[1]
                new_score = update.score if update.score is not None else row[2]
                
                cursor.execute("""
                    UPDATE user_library 
                    SET status = ?, episodes_watched = ?, score = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE mal_id = ?
                """, (new_status, new_episodes, new_score, update.mal_id))
            else:
                new_status = update.status if update.status is not None else 'Watching'
                new_episodes = update.episodes_watched if update.episodes_watched is not None else 0
                new_score = update.score if update.score is not None else 0
                
                cursor.execute("""
                    INSERT INTO user_library (mal_id, status, episodes_watched, score)
                    VALUES (?, ?, ?, ?)
                """, (update.mal_id, new_status, new_episodes, new_score))
            
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
                else:
                    query += " AND 1=0" # No matches found
                
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
                    
            if sort == "popularity":
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
        recs = core_recommend(liked_anime=liked, top_n=6)
        
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

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
