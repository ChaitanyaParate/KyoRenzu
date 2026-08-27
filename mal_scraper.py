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
KITSU_URL = "https://kitsu.io/api/edge"
ANILIST_URL = "https://graphql.anilist.co"
JIKAN_URL = "https://api.jikan.moe/v4/anime"
ANIMETHEMES_URL = "https://api.animethemes.moe/anime"

# Limits
KITSU_RATE_LIMIT = 5
ANILIST_RATE_LIMIT = 1.2
JIKAN_RATE_LIMIT = 2
ANIMETHEMES_RATE_LIMIT = 2
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

# ----------------- PHASE 1: Scrape Base (via Kitsu) -----------------
async def fetch_kitsu_page(session, offset, sem):
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / KITSU_RATE_LIMIT)
            url = f"{KITSU_URL}/anime?sort=-averageRating&page[limit]=20&page[offset]={offset}&include=mappings"
            try:
                async with session.get(url, headers={'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0'}, timeout=15) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 429:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
                    else:
                        return None
            except Exception:
                await asyncio.sleep(2 * (attempt + 1))
                continue
        return None

def process_kitsu_page_data(data_json, cursor, conn):
    if not data_json or 'data' not in data_json:
        return 0
    
    data = data_json.get('data', [])
    included = data_json.get('included', [])
    mappings_lookup = {item['id']: item for item in included if item['type'] == 'mappings'}

    inserted = 0
    for anime in data:
        attrs = anime.get('attributes', {})
        
        mal_id = None
        relationships = anime.get('relationships', {})
        mappings_ref = relationships.get('mappings', {}).get('data', [])
        for m in mappings_ref:
            mapping_item = mappings_lookup.get(m['id'])
            if mapping_item and mapping_item.get('attributes', {}).get('externalSite') == 'myanimelist/anime':
                mal_id_str = mapping_item['attributes'].get('externalId')
                if mal_id_str and mal_id_str.isdigit():
                    mal_id = int(mal_id_str)
                break
        
        if not mal_id:
            continue

        title = attrs.get('canonicalTitle')
        titles = attrs.get('titles', {})
        title_english = titles.get('en') or titles.get('en_us')
        title_japanese = titles.get('ja_jp')
        
        score_str = attrs.get('averageRating')
        score = float(score_str) / 10.0 if score_str else None # Kitsu uses 0-100, MAL uses 0-10
        members = attrs.get('userCount')
        synopsis = attrs.get('synopsis')
        
        poster = attrs.get('posterImage') or {}
        image_url = poster.get('original') or poster.get('large')

        start_date = attrs.get('startDate')

        try:
            cursor.execute('''
                INSERT OR IGNORE INTO anime 
                (mal_id, title, title_english, title_japanese, score, members, image_url, aired_from, synopsis, data_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (mal_id, title, title_english, title_japanese, score, members, image_url, start_date, synopsis, 'kaggle_base'))
            
            cursor.execute('''
                UPDATE anime SET
                title = ?, title_english = ?, title_japanese = ?, score = ?, members = ?, image_url = ?, aired_from = ?
                WHERE mal_id = ?
            ''', (title, title_english, title_japanese, score, members, image_url, start_date, mal_id))
            inserted += 1
        except sqlite3.Error as e:
            print(f"DB Error on mal_id {mal_id}: {e}")
            
    return inserted

async def scrape_base():
    conn = setup_db()
    c = conn.cursor()
    print("Starting Kitsu base discovery pipeline...")
    
    # We will fetch top 10000 anime (20 per page * 500 pages)
    total_pages = 500
    
    async with aiohttp.ClientSession() as session:
        api_sem = asyncio.Semaphore(1) 
        
        with tqdm(total=total_pages, desc="Scraping Kitsu Pages") as pbar:
            for page in range(total_pages):
                offset = page * 20
                data = await fetch_kitsu_page(session, offset, api_sem)
                if data:
                    process_kitsu_page_data(data, c, conn)
                conn.commit()
                pbar.update(1)

    conn.close()
    print("Base metadata scraping complete.")
    print("Rebuilding genre correlation table...")
    try:
        _build_genre_correlation()
        print("Genre correlation updated.")
    except Exception as e:
        print(f"Skipping genre correlation build for now: {e}")

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
        id description episodes seasonYear season status genres
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
                        
                        genres = media.get('genres', [])
                        genres_str = ", ".join(genres) if genres else None
                        
                        return {
                            'anilist_id': media.get('id'),
                            'synopsis': desc,
                            'episodes': media.get('episodes'),
                            'year': media.get('seasonYear'),
                            'season': media.get('season'),
                            'status': media.get('status'),
                            'studio': studio,
                            'genres': genres_str,
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
                            'genres': None, # Jikan genres are handled differently or skipped here
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

async def fetch_kitsu(session, mal_id, sem):
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / KITSU_RATE_LIMIT)
            url = f"{KITSU_URL}/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]={mal_id}&include=item"
            try:
                async with session.get(url, headers={'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0'}, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        included = data.get('included', [])
                        if not included:
                            return None
                        
                        attrs = included[0].get('attributes', {})
                        desc = attrs.get('synopsis')
                        if not desc:
                            return None

                        start_date = attrs.get('startDate')
                        year = int(start_date[:4]) if start_date and len(start_date) >= 4 else None
                        month = int(start_date[5:7]) if start_date and len(start_date) >= 7 else None
                        season = None
                        if month:
                            if month in [12, 1, 2]: season = "WINTER"
                            elif month in [3, 4, 5]: season = "SPRING"
                            elif month in [6, 7, 8]: season = "SUMMER"
                            elif month in [9, 10, 11]: season = "FALL"

                        status_map = {
                            'finished': 'FINISHED',
                            'current': 'RELEASING',
                            'tba': 'NOT_YET_RELEASED',
                            'unreleased': 'NOT_YET_RELEASED',
                            'upcoming': 'NOT_YET_RELEASED'
                        }
                        
                        return {
                            'anilist_id': None,
                            'synopsis': desc,
                            'episodes': attrs.get('episodeCount'),
                            'year': year,
                            'season': season,
                            'status': status_map.get(attrs.get('status'), attrs.get('status')),
                            'studio': None,
                            'genres': None,
                            'data_source': 'kitsu'
                        }
                    elif response.status == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    else:
                        return None
            except Exception:
                await asyncio.sleep(2 ** attempt)
                continue
        return None

async def fetch_animethemes(session, mal_id, sem):
    async with sem:
        for attempt in range(MAX_RETRIES):
            await asyncio.sleep(1.0 / ANIMETHEMES_RATE_LIMIT)
            url = f"{ANIMETHEMES_URL}?filter[site]=MyAnimeList&filter[external_id]={mal_id}"
            try:
                async with session.get(url, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        anime_list = data.get('anime', [])
                        if not anime_list:
                            return None
                        
                        attrs = anime_list[0]
                        desc = attrs.get('synopsis')
                        if not desc:
                            return None

                        season_str = attrs.get('season')
                        season = season_str.upper() if season_str else None
                        
                        return {
                            'anilist_id': None,
                            'synopsis': desc,
                            'episodes': None,
                            'year': attrs.get('year'),
                            'season': season,
                            'status': None,
                            'studio': None,
                            'genres': None,
                            'data_source': 'animethemes'
                        }
                    elif response.status == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    else:
                        return None
            except Exception:
                await asyncio.sleep(2 ** attempt)
                continue
        return None

async def tiered_fetch(session, mal_id, anilist_sem, jikan_sem, kitsu_sem, animethemes_sem):
    merged_data = {}
    
    def merge_result(res):
        if not res: return
        for k, v in res.items():
            if v and not merged_data.get(k):
                merged_data[k] = v

    def has_all_fields():
        required = ['synopsis', 'anilist_id', 'episodes', 'year', 'season', 'status', 'studio', 'genres']
        return all(merged_data.get(k) for k in required)

    res = await fetch_animethemes(session, mal_id, animethemes_sem)
    merge_result(res)
    if has_all_fields(): return mal_id, merged_data

    res = await fetch_anilist(session, mal_id, anilist_sem)
    merge_result(res)
    if has_all_fields(): return mal_id, merged_data
    
    res = await fetch_jikan(session, mal_id, jikan_sem)
    merge_result(res)
    if has_all_fields(): return mal_id, merged_data

    res = await fetch_kitsu(session, mal_id, kitsu_sem)
    merge_result(res)
    
    if not merged_data:
        return mal_id, {'data_source': 'none'}
        
    return mal_id, merged_data

async def process_batch_enrich(session, records, conn, c, anilist_sem, jikan_sem, kitsu_sem, animethemes_sem, pbar):
    async def fetch_and_update(mal_id):
        res = await tiered_fetch(session, mal_id, anilist_sem, jikan_sem, kitsu_sem, animethemes_sem)
        pbar.update(1)
        return res

    tasks = [fetch_and_update(mal_id) for mal_id, in records]
    results = await asyncio.gather(*tasks)
        
    updates = []
    genre_updates = []
    for mal_id, data in results:
        if data.get('data_source') == 'none':
            updates.append((None, None, None, None, None, None, None, 'none', mal_id))
        else:
            updates.append((
                data.get('anilist_id'), data.get('synopsis'), data.get('episodes'),
                data.get('year'), data.get('season'), data.get('status'),
                data.get('studio'), data.get('data_source'), mal_id
            ))
            if data.get('genres'):
                genre_updates.append((data.get('genres'), mal_id))
            
    if updates:
        c.executemany('''
            UPDATE anime SET 
                anilist_id = ?, synopsis = ?, episodes = ?, year = ?, 
                season = ?, status = ?, studio = ?, data_source = ?
            WHERE mal_id = ?
        ''', updates)
        
    if genre_updates:
        c.executemany('''
            UPDATE anime SET genres = ? WHERE mal_id = ? AND (genres IS NULL OR genres = '')
        ''', genre_updates)
        
    conn.commit()

async def enrich_metadata(limit=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT mal_id FROM anime WHERE data_source = 'kaggle_base' OR data_source IS NULL OR status IS NULL OR anilist_id IS NULL OR studio IS NULL")
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
    kitsu_sem = asyncio.Semaphore(1)
    animethemes_sem = asyncio.Semaphore(1)
    
    batch_size = 50
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Tiered Fetch") as pbar:
            for i in range(0, len(records), batch_size):
                batch_records = records[i:i+batch_size]
                await process_batch_enrich(session, batch_records, conn, c, anilist_sem, jikan_sem, kitsu_sem, animethemes_sem, pbar)

    conn.close()
    print("Metadata enrichment complete!")


# ----------------- PHASE 3: Download Covers -----------------
async def get_kitsu_cover_url(session, mal_id):
    url = f"{KITSU_URL}/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]={mal_id}&include=item"
    try:
        async with session.get(url, headers={'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0'}, timeout=15) as response:
            if response.status == 200:
                data = await response.json()
                included = data.get('included', [])
                if included:
                    poster = included[0].get('attributes', {}).get('posterImage') or {}
                    return poster.get('original') or poster.get('large')
    except Exception:
        pass
    return None

async def download_image(session, sem, mal_id, image_url, pbar):
    async with sem:
        local_path = os.path.join(COVERS_DIR, f"{mal_id}.jpg")
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            pbar.update(1)
            return mal_id, local_path

        urls_to_try = [image_url] if image_url else []

        for attempt in range(MAX_RETRIES):
            if not urls_to_try:
                # Fallback to fetching fresh URL from Kitsu
                fallback_url = await get_kitsu_cover_url(session, mal_id)
                if fallback_url:
                    urls_to_try.append(fallback_url)
                else:
                    break
                    
            current_url = urls_to_try[0]
            try:
                await asyncio.sleep(1.0)
                async with session.get(current_url, timeout=15) as response:
                    if response.status == 200:
                        content = await response.read()
                        with open(local_path, 'wb') as f:
                            f.write(content)
                        pbar.update(1)
                        return mal_id, local_path
                    elif response.status in [429, 403, 404]:
                        urls_to_try.pop(0) # URL is dead, try fallback next loop
                        continue
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
    parser.add_argument("--scrape-base", action="store_true", help="Scrape top anime base metadata from Kitsu API")
    parser.add_argument("--enrich-metadata", action="store_true", help="Fetch detailed metadata/synopses via AnimeThemes->AniList->Jikan->Kitsu tiered pipeline")
    parser.add_argument("--download-covers", action="store_true", help="Download missing cover images locally with Kitsu fallback")
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
