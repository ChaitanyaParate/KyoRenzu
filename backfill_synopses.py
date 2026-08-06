import asyncio
import aiohttp
import sqlite3
import argparse
from tqdm.asyncio import tqdm
import re

DB_NAME = "anime_data.db"
API_URL = "https://graphql.anilist.co"
API_RATE_LIMIT = 1.2  # AniList limit is ~90/min, we use 1.2 req/sec to be safe

def clean_html(raw_html):
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', raw_html).replace('\n', ' ').strip()

async def fetch_synopsis(session, mal_id, sem):
    query = '''
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        description
      }
    }
    '''
    
    async with sem:
        retries = 5
        for attempt in range(retries):
            await asyncio.sleep(1.0 / API_RATE_LIMIT)
            try:
                async with session.post(
                    API_URL, 
                    json={'query': query, 'variables': {'idMal': mal_id}},
                    timeout=15
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        desc = data.get('data', {}).get('Media', {}).get('description')
                        return mal_id, clean_html(desc)
                    elif response.status == 404:
                        return mal_id, "" # Not found in AniList
                    elif response.status == 429:
                        await asyncio.sleep(10 * (attempt + 1))
                        continue
                    else:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
            except Exception:
                await asyncio.sleep(2 * (attempt + 1))
                continue
        return mal_id, None

async def backfill(limit=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT mal_id FROM anime WHERE synopsis IS NULL")
    records = c.fetchall()
    
    if not records:
        print("No anime missing synopses!")
        return

    if limit:
        records = records[:limit]
        print(f"Limiting to {limit} records for this run.")

    print(f"Found {len(records)} anime missing synopses. Fetching from AniList API...")
    
    batch_size = 100
    sem = asyncio.Semaphore(1)
    
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Fetching Synopses") as pbar:
            for i in range(0, len(records), batch_size):
                batch_records = records[i:i+batch_size]
                
                results = []
                for mal_id, in batch_records:
                    res = await fetch_synopsis(session, mal_id, sem)
                    results.append(res)
                    pbar.update(1)
                
                updates = [(syn, mid) for mid, syn in results if syn is not None]
                if updates:
                    c.executemany("UPDATE anime SET synopsis = ? WHERE mal_id = ?", updates)
                    conn.commit()

    conn.close()
    print("Backfill complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Limit number of anime to fetch")
    args = parser.parse_args()
    asyncio.run(backfill(args.limit))
