import asyncio
import aiohttp
import sqlite3
import os
import argparse
from tqdm.asyncio import tqdm

DB_NAME = "anime_data.db"
THEMES_DIR = "themes"
MAX_RETRIES = 3
CONCURRENCY = 10

def setup_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Check if theme_local_path exists
    c.execute("PRAGMA table_info(anime)")
    columns = [info[1] for info in c.fetchall()]
    if "theme_local_path" not in columns:
        c.execute("ALTER TABLE anime ADD COLUMN theme_local_path TEXT")
        conn.commit()
    return conn

async def get_theme_url(session, mal_id):
    url = f"https://api.animethemes.moe/anime?include=animethemes.animethemeentries.videos.audio&filter[has]=resources&filter[site]=MyAnimeList&filter[external_id]={mal_id}"
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, timeout=15) as response:
                if response.status == 200:
                    data = await response.json()
                    anime_list = data.get('anime', [])
                    if not anime_list:
                        return None
                    
                    themes = anime_list[0].get('animethemes', [])
                    if not themes:
                        return None
                    
                    # Try to find an OP first, else fallback to ED
                    selected_theme = None
                    for theme in themes:
                        if theme.get('type') == 'OP':
                            selected_theme = theme
                            break
                    if not selected_theme:
                        selected_theme = themes[0]
                        
                    entries = selected_theme.get('animethemeentries', [])
                    if not entries:
                        return None
                        
                    videos = entries[0].get('videos', [])
                    if not videos:
                        return None
                        
                    # AnimeThemes usually separates the audio track into an .ogg file
                    audio_info = videos[0].get('audio')
                    if audio_info and audio_info.get('link'):
                        return audio_info.get('link')
                        
                    # Fallback to the full video link if audio is not separate
                    return videos[0].get('link')
                elif response.status == 429:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return None
        except Exception:
            await asyncio.sleep(2 ** attempt)
    return None

async def download_theme(session, sem, mal_id, pbar):
    async with sem:
        audio_url = await get_theme_url(session, mal_id)
        if not audio_url:
            pbar.update(1)
            return mal_id, "NOT_FOUND"

        ext = audio_url.split('.')[-1] if '.' in audio_url.split('/')[-1] else 'ogg'
        # Remove any query params from ext
        ext = ext.split('?')[0]
        local_path = os.path.join(THEMES_DIR, f"{mal_id}.{ext}")

        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            pbar.update(1)
            return mal_id, local_path

        for attempt in range(MAX_RETRIES):
            try:
                # Add a small delay between requests to be nice to AnimeThemes.moe
                await asyncio.sleep(0.5)
                async with session.get(audio_url, timeout=30) as response:
                    if response.status == 200:
                        content = await response.read()
                        with open(local_path, 'wb') as f:
                            f.write(content)
                        pbar.update(1)
                        return mal_id, local_path
            except Exception:
                await asyncio.sleep(2 ** attempt)
        
        pbar.update(1)
        return mal_id, "FAILED"

async def main(limit=None):
    if not os.path.exists(THEMES_DIR):
        os.makedirs(THEMES_DIR)

    conn = setup_db()
    c = conn.cursor()
    c.execute("SELECT mal_id FROM anime WHERE theme_local_path IS NULL OR theme_local_path = 'FAILED'")
    records = c.fetchall()
    
    if not records:
        print("No missing themes to download.")
        return

    if limit:
        records = records[:limit]
        print(f"Limiting to {limit} records.")

    print(f"Found {len(records)} themes to process.")
    sem = asyncio.Semaphore(CONCURRENCY)
    
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Downloading Themes") as pbar:
            tasks = [download_theme(session, sem, mal_id, pbar) for mal_id, in records]
            
            # Process in batches to save memory and update DB periodically
            batch_size = 50
            for i in range(0, len(tasks), batch_size):
                batch_tasks = tasks[i:i+batch_size]
                results = await asyncio.gather(*batch_tasks)
                
                updates = [(path, mal_id) for mal_id, path in results]
                c.executemany("UPDATE anime SET theme_local_path = ? WHERE mal_id = ?", updates)
                conn.commit()

    conn.close()
    print("Theme download complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Anime Theme Downloader using AnimeThemes.moe")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of themes to download (for testing)")
    args = parser.parse_args()

    asyncio.run(main(args.limit))
