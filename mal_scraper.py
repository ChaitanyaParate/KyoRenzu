import asyncio
import aiohttp
import sqlite3
import os
import argparse
from tqdm.asyncio import tqdm
import re
from recommender import _build_genre_correlation

DB_NAME = "anime_data.db"
COVERS_DIR = "covers"

# APIs
JIKAN_URL = "https://api.jikan.moe/v4/anime"
ANILIST_URL = "https://graphql.anilist.co"

# Limits
JIKAN_RATE_LIMIT = 2
ANILIST_RATE_LIMIT = 1.2
IMAGE_CONCURRENCY = 30
MAX_RETRIES = 5

def setup_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS anime (
            internal_id INTEGER PRIMARY KEY AUTOINCREMENT,
            mal_id INTEGER UNIQUE,
            anilist_id INTEGER,
            title TEXT,
            title_english TEXT,
            title_japanese TEXT,
            synopsis TEXT,
            genres TEXT,
            episodes INTEGER,
            score REAL,
            scored_by INTEGER,
            members INTEGER,
            year INTEGER,
            season TEXT,
            status TEXT,
            studio TEXT,
            aired_from TEXT,
            image_url TEXT,
            local_image_path TEXT,
            data_source TEXT
        )
    ''')
    conn.commit()
    return conn

# ----------------- PHASE 1: Scrape Base -----------------
async def fetch_page(session, page, sem):
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / JIKAN_RATE_LIMIT)
            url = f"{JIKAN_URL}?order_by=score&sort=desc&page={page}"
            try:
                async with session.get(url, timeout=15) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status in [429, 500, 502, 503, 504]:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
                    else:
                        return None
            except Exception:
                await asyncio.sleep(2 * (attempt + 1))
                continue
        return None

def process_page_data(anime_list, cursor, conn):
    for anime in anime_list:
        mal_id = anime.get('mal_id')
        title = anime.get('title')
        title_english = anime.get('title_english')
        title_japanese = anime.get('title_japanese')
        score = anime.get('score')
        scored_by = anime.get('scored_by')
        members = anime.get('members')
        synopsis = anime.get('synopsis')
        
        genres_list = [g.get('name') for g in anime.get('genres', [])]
        themes_list = [t.get('name') for t in anime.get('themes', [])]
        demographics_list = [d.get('name') for d in anime.get('demographics', [])]
        all_tags = genres_list + themes_list + demographics_list
        genres = ", ".join(dict.fromkeys(all_tags))
        
        aired_from_raw = (anime.get('aired') or {}).get('from')
        aired_from = aired_from_raw[:10] if aired_from_raw else None

        images = anime.get('images', {}).get('jpg', {})
        image_url = images.get('large_image_url') or images.get('image_url')

        try:
            # We use INSERT OR IGNORE so we don't overwrite enriched metadata on subsequent runs
            cursor.execute('''
                INSERT OR IGNORE INTO anime 
                (mal_id, title, title_english, title_japanese, score, scored_by,
                 members, genres, image_url, local_image_path, aired_from, synopsis, data_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (mal_id, title, title_english, title_japanese, score, scored_by,
                  members, genres, image_url, None, aired_from, synopsis, 'kaggle_base'))
            
            # If it already exists, update only the basic fields but preserve rich metadata
            cursor.execute('''
                UPDATE anime SET
                title = ?, title_english = ?, title_japanese = ?, score = ?, 
                scored_by = ?, members = ?, genres = ?, image_url = ?, aired_from = ?
                WHERE mal_id = ?
            ''', (title, title_english, title_japanese, score, scored_by, members, genres, image_url, aired_from, mal_id))
        except sqlite3.Error as e:
            print(f"DB Error on mal_id {mal_id}: {e}")

async def scrape_base():
    conn = setup_db()
    c = conn.cursor()
    print("Fetching first page to determine total pages...")
    async with aiohttp.ClientSession() as session:
        api_sem = asyncio.Semaphore(1) 
        first_page = await fetch_page(session, 1, api_sem)
        if not first_page:
            print("Could not fetch first page. Exiting.")
            return

        last_visible_page = first_page['pagination']['last_visible_page']
        print(f"Total pages to scrape: {last_visible_page} (~{last_visible_page * 25} anime)")
        
        process_page_data(first_page['data'], c, conn)

        for page in tqdm(range(2, last_visible_page + 1), desc="Scraping Base Pages"):
            data = await fetch_page(session, page, api_sem)
            if data and 'data' in data:
                process_page_data(data['data'], c, conn)
            conn.commit()

    conn.close()
    print("Base metadata scraping complete.")
    print("Rebuilding genre correlation table...")
    _build_genre_correlation()
    print("Genre correlation updated.")


# ----------------- PHASE 2: Enrich Metadata -----------------
def clean_html(raw_html):
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', raw_html).replace('\n', ' ').strip()

async def fetch_anilist(session, mal_id, sem):
    query = '''
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id description episodes seasonYear season status
        studios(isMain: true) { nodes { name } }
      }
    }
    '''
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / ANILIST_RATE_LIMIT)
            try:
                async with session.post(ANILIST_URL, json={'query': query, 'variables': {'idMal': mal_id}}, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        media = data.get('data', {}).get('Media')
                        if not media:
                            return None
                        
                        desc = clean_html(media.get('description'))
                        studios = media.get('studios', {}).get('nodes', [])
                        studio = studios[0].get('name') if studios else None
                        
                        return {
                            'anilist_id': media.get('id'),
                            'synopsis': desc,
                            'episodes': media.get('episodes'),
                            'year': media.get('seasonYear'),
                            'season': media.get('season'),
                            'status': media.get('status'),
                            'studio': studio,
                            'data_source': 'anilist'
                        }
                    elif response.status == 404:
                        return None
                    elif response.status == 429:
                        await asyncio.sleep(10 * (attempt + 1))
                        continue
            except Exception:
                await asyncio.sleep(2 * (attempt + 1))
                continue
        return None

async def fetch_jikan(session, mal_id, sem):
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / JIKAN_RATE_LIMIT)
            url = f"{JIKAN_URL}/{mal_id}"
            try:
                async with session.get(url, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        anime = data.get('data', {})
                        desc = anime.get('synopsis')
                        studios = anime.get('studios', [])
                        studio = studios[0].get('name') if studios else None
                        
                        return {
                            'anilist_id': None,
                            'synopsis': desc,
                            'episodes': anime.get('episodes'),
                            'year': anime.get('year'),
                            'season': anime.get('season'),
                            'status': anime.get('status'),
                            'studio': studio,
                            'data_source': 'jikan'
                        }
                    elif response.status == 404:
                        return None
                    elif response.status == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    elif response.status in [500, 502, 503, 504]:
                        return None
            except Exception:
                await asyncio.sleep(2 ** attempt)
                continue
        return None

async def tiered_fetch(session, mal_id, anilist_sem, jikan_sem):
    res = await fetch_anilist(session, mal_id, anilist_sem)
    if res and res.get('synopsis'):
        return mal_id, res
    
    res = await fetch_jikan(session, mal_id, jikan_sem)
    if res and res.get('synopsis'):
        return mal_id, res
    
    return mal_id, {'data_source': 'none'}

async def process_batch_enrich(session, records, conn, c, anilist_sem, jikan_sem, pbar):
    async def fetch_and_update(mal_id):
        res = await tiered_fetch(session, mal_id, anilist_sem, jikan_sem)
        pbar.update(1)
        return res

    tasks = [fetch_and_update(mal_id) for mal_id, in records]
    results = await asyncio.gather(*tasks)
        
    updates = []
    for mal_id, data in results:
        if data.get('data_source') == 'none':
            updates.append((None, None, None, None, None, None, None, 'none', mal_id))
        else:
            updates.append((
                data.get('anilist_id'), data.get('synopsis'), data.get('episodes'),
                data.get('year'), data.get('season'), data.get('status'),
                data.get('studio'), data.get('data_source'), mal_id
            ))
            
    if updates:
        c.executemany('''
            UPDATE anime SET 
                anilist_id = ?, synopsis = ?, episodes = ?, year = ?, 
                season = ?, status = ?, studio = ?, data_source = ?
            WHERE mal_id = ?
        ''', updates)
        conn.commit()

async def enrich_metadata(limit=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT mal_id FROM anime WHERE data_source = 'kaggle_base' OR data_source IS NULL")
    records = c.fetchall()
    
    if not records:
        print("All anime metadata resolved!")
        return

    if limit:
        records = records[:limit]
        print(f"Limiting to {limit} records.")

    print(f"Starting tiered pipeline to enrich {len(records)} anime...")
    anilist_sem = asyncio.Semaphore(1)
    jikan_sem = asyncio.Semaphore(1)
    
    batch_size = 50
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Tiered Fetch") as pbar:
            for i in range(0, len(records), batch_size):
                batch_records = records[i:i+batch_size]
                await process_batch_enrich(session, batch_records, conn, c, anilist_sem, jikan_sem, pbar)

    conn.close()
    print("Metadata enrichment complete!")


# ----------------- PHASE 3: Download Covers -----------------
async def download_image(session, sem, mal_id, image_url, pbar):
    async with sem:
        if not image_url:
            pbar.update(1)
            return mal_id, None
            
        ext = image_url.split('.')[-1]
        local_path = os.path.join(COVERS_DIR, f"{mal_id}.{ext}")
        
        if os.path.exists(local_path):
            pbar.update(1)
            return mal_id, local_path

        for attempt in range(MAX_RETRIES):
            try:
                await asyncio.sleep(1.5)
                async with session.get(image_url, timeout=15) as response:
                    if response.status == 200:
                        content = await response.read()
                        with open(local_path, 'wb') as f:
                            f.write(content)
                        pbar.update(1)
                        return mal_id, local_path
                    elif response.status in [429, 403]:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
                    else:
                        break
            except Exception:
                await asyncio.sleep(1)
                continue
        
        pbar.update(1)
        return mal_id, None

async def download_covers():
    if not os.path.exists(COVERS_DIR):
        os.makedirs(COVERS_DIR)

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT mal_id, image_url FROM anime WHERE local_image_path IS NULL")
    records = c.fetchall()
    
    if not records:
        print("No missing covers to download.")
        return

    print(f"Found {len(records)} covers to download.")
    sem = asyncio.Semaphore(IMAGE_CONCURRENCY)
    
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Downloading Covers") as pbar:
            tasks = [download_image(session, sem, mal_id, url, pbar) for mal_id, url in records]
            results = await asyncio.gather(*tasks)
            
            updates = [(path, mal_id) for mal_id, path in results if path]
            c.executemany("UPDATE anime SET local_image_path = ? WHERE mal_id = ?", updates)
            conn.commit()

    conn.close()
    print("Cover download complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MyAnimeList Universal Scraper")
    parser.add_argument("--scrape-base", action="store_true", help="Scrape top anime base metadata from Jikan API")
    parser.add_argument("--enrich-metadata", action="store_true", help="Fetch detailed metadata/synopses via AniList->Jikan tiered pipeline")
    parser.add_argument("--download-covers", action="store_true", help="Download missing cover images locally")
    parser.add_argument("--all", action="store_true", help="Run the entire pipeline (Base -> Enrich -> Covers)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of items processed in enrichment phase")
    args = parser.parse_args()

    setup_db()

    if args.scrape_base or args.all:
        asyncio.run(scrape_base())
    
    if args.enrich_metadata or args.all:
        asyncio.run(enrich_metadata(args.limit))

    if args.download_covers or args.all:
        asyncio.run(download_covers())
    
    if not any([args.scrape_base, args.enrich_metadata, args.download_covers, args.all]):
        parser.print_help()
