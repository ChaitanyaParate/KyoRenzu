import asyncio
import aiohttp
import sqlite3
import os
import argparse
import numpy as np
import torch
import librosa
from transformers import ClapModel, ClapProcessor
from tqdm.asyncio import tqdm
import json

DB_NAME = "anime_data.db"
THEMES_DIR = "themes"
MAX_RETRIES = 3
CONCURRENCY = 5  # Lower concurrency because of GPU/CPU processing

# We will save the embeddings incrementally
EMBEDDINGS_FILE = "themes/audio_embeddings.npy"
INDEX_FILE = "themes/audio_index.json"

def setup_db():
    conn = sqlite3.connect(DB_NAME)
    return conn

# We can reuse get_theme_url logic
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
                    selected_theme = next((t for t in themes if t.get('type') == 'OP'), themes[0])
                    entries = selected_theme.get('animethemeentries', [])
                    if not entries: return None
                    videos = entries[0].get('videos', [])
                    if not videos: return None
                    audio_info = videos[0].get('audio')
                    if audio_info and audio_info.get('link'):
                        return audio_info.get('link')
                    return videos[0].get('link')
                elif response.status == 429:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return None
        except Exception:
            await asyncio.sleep(2 ** attempt)
    return None

async def download_and_embed(session, sem, mal_id, processor, model, device, pbar):
    async with sem:
        audio_url = await get_theme_url(session, mal_id)
        if not audio_url:
            pbar.update(1)
            return mal_id, None

        ext = audio_url.split('.')[-1].split('?')[0]
        if not ext: ext = 'ogg'
        
        # Temp file for librosa
        temp_path = os.path.join(THEMES_DIR, f"temp_{mal_id}.{ext}")

        for attempt in range(MAX_RETRIES):
            try:
                await asyncio.sleep(0.5)
                async with session.get(audio_url, timeout=30) as response:
                    if response.status == 200:
                        content = await response.read()
                        with open(temp_path, 'wb') as f:
                            f.write(content)
                        
                        # Process audio
                        try:
                            # Load audio (CLAP uses 48000 Hz)
                            audio_data, sr = librosa.load(temp_path, sr=48000, mono=True)
                            
                            # Keep only first 30 seconds to save memory and speed up inference
                            audio_data = audio_data[:sr * 30] 

                            inputs = processor(audio=audio_data, return_tensors="pt", sampling_rate=sr)
                            inputs = {k: v.to(device) for k, v in inputs.items()}
                            
                            with torch.no_grad():
                                outputs = model.get_audio_features(**inputs)
                                
                            embedding = outputs[0].cpu().numpy()
                            
                            # Clean up file immediately
                            os.remove(temp_path)
                            pbar.update(1)
                            return mal_id, embedding
                        except Exception as e:
                            print(f"\nError processing audio {mal_id}: {e}")
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
                            pbar.update(1)
                            return mal_id, None
            except Exception as e:
                print(f"\nDownload error for {mal_id}: {e}")
                await asyncio.sleep(2 ** attempt)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
        pbar.update(1)
        return mal_id, None

async def main(limit=None):
    if not os.path.exists(THEMES_DIR):
        os.makedirs(THEMES_DIR)

    # Initialize model
    print("Loading CLAP Model (laion/clap-htsat-unfused)...")
    model_id = "laion/clap-htsat-unfused"
    processor = ClapProcessor.from_pretrained(model_id)
    model = ClapModel.from_pretrained(model_id)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    model = model.to(device)
    model.eval()

    # Load existing embeddings to allow resuming
    if os.path.exists(EMBEDDINGS_FILE) and os.path.exists(INDEX_FILE):
        embeddings = np.load(EMBEDDINGS_FILE)
        with open(INDEX_FILE, "r") as f:
            index_map = json.load(f)
        processed_mal_ids = set([int(k) for k in index_map.keys()])
        embeddings_list = list(embeddings)
    else:
        embeddings_list = []
        index_map = {}
        processed_mal_ids = set()

    conn = setup_db()
    c = conn.cursor()
    c.execute("SELECT mal_id FROM anime WHERE data_source != 'none' AND data_source IS NOT NULL")
    all_records = c.fetchall()
    
    # Filter out ones we've already embedded
    records = [r for r in all_records if r[0] not in processed_mal_ids]

    if not records:
        print("All audio embeddings generated!")
        return

    if limit:
        records = records[:limit]
        print(f"Limiting to {limit} records.")

    print(f"Found {len(records)} new themes to process.")
    sem = asyncio.Semaphore(CONCURRENCY)
    
    async with aiohttp.ClientSession() as session:
        with tqdm(total=len(records), desc="Extracting Audio Embeddings") as pbar:
            tasks = [download_and_embed(session, sem, mal_id, processor, model, device, pbar) for mal_id, in records]
            
            # Save checkpoints every batch
            batch_size = 50
            for i in range(0, len(tasks), batch_size):
                batch_tasks = tasks[i:i+batch_size]
                results = await asyncio.gather(*batch_tasks)
                
                new_added = False
                for mal_id, emb in results:
                    if emb is not None:
                        idx = len(embeddings_list)
                        embeddings_list.append(emb)
                        index_map[str(mal_id)] = idx
                        new_added = True
                
                if new_added:
                    np.save(EMBEDDINGS_FILE, np.array(embeddings_list, dtype=np.float32))
                    with open(INDEX_FILE, "w") as f:
                        json.dump(index_map, f)

    conn.close()
    print("Audio embedding complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="On-the-fly Audio Embedding Extractor")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of themes to process")
    args = parser.parse_args()

    asyncio.run(main(args.limit))
