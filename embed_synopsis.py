"""
Phase 1b: Pre-compute SentenceTransformer embeddings for all anime synopses.
Run ONCE to generate synopsis_embeddings.npy and synopsis_index.json.
"""

import os
import json
import sqlite3
import numpy as np
import torch
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

# ── Config ──────────────────────────────────────────────────────────────────
DB_PATH = "anime_data.db"
EMBEDDINGS_PATH = "synopsis_embeddings.npy"
INDEX_PATH = "synopsis_index.json"
MODEL_NAME = "all-MiniLM-L6-v2"
BATCH_SIZE = 128

# ── Device selection (GPU preferred, CPU fallback) ───────────────────────────
if torch.cuda.is_available() and os.environ.get("FORCE_CPU") != "1":
    DEVICE = "cuda"
    print(f"[embed_synopsis] ✔ GPU detected: {torch.cuda.get_device_name(0)}")
else:
    DEVICE = "cpu"
    print("[embed_synopsis] ⚠ CUDA not available or FORCE_CPU=1. Running on CPU.")
print(f"[embed_synopsis] Device: {DEVICE}")

# ── Load model ───────────────────────────────────────────────────────────────
print(f"[embed_synopsis] Loading SentenceTransformer model: {MODEL_NAME}")
model = SentenceTransformer(MODEL_NAME, device=DEVICE)

def load_existing_index():
    """Load existing index so we can resume interrupted runs."""
    if os.path.exists(INDEX_PATH) and os.path.exists(EMBEDDINGS_PATH):
        with open(INDEX_PATH, "r") as f:
            index = json.load(f)  # {str(mal_id): row_idx}
        embeddings = np.load(EMBEDDINGS_PATH)
        print(f"[embed_synopsis] Resuming — {len(index)} embeddings already computed.")
        return index, list(embeddings)
    return {}, []

def save_index(index, embeddings_list):
    np.save(EMBEDDINGS_PATH, np.array(embeddings_list, dtype=np.float32))
    with open(INDEX_PATH, "w") as f:
        json.dump(index, f)

def main():
    # ── Fetch records from DB ────────────────────────────────────────────────
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Check if synopsis column exists
    try:
        c.execute("SELECT mal_id, synopsis FROM anime WHERE synopsis IS NOT NULL AND synopsis != ''")
        records = c.fetchall()
    except sqlite3.OperationalError:
        print("[embed_synopsis] Error: 'synopsis' column not found in database.")
        print("[embed_synopsis] Please run `python mal_scraper.py --scrape-metadata` to fetch synopses.")
        return
    finally:
        conn.close()

    print(f"[embed_synopsis] {len(records)} anime with synopses found in DB.")

    # ── Resume support ───────────────────────────────────────────────────────
    index, embeddings_list = load_existing_index()
    done_ids = set(index.keys())

    pending = [(mid, text) for mid, text in records if str(mid) not in done_ids]
    print(f"[embed_synopsis] {len(pending)} synopses left to embed.")

    if not pending:
        print("[embed_synopsis] Nothing to do — index is complete.")
        return

    # ── Batch embed ──────────────────────────────────────────────────────────
    batch_mal_ids = []
    batch_texts = []

    save_every = 5000  # checkpoint save interval
    total_saved = 0

    for mal_id, text in tqdm(pending, desc="Embedding synopses"):
        batch_mal_ids.append(mal_id)
        batch_texts.append(text)

        if len(batch_texts) >= BATCH_SIZE:
            # sentence-transformers encodes list of strings and can normalize
            vecs = model.encode(batch_texts, batch_size=BATCH_SIZE, normalize_embeddings=True, show_progress_bar=False)
            
            for embed_i in range(len(batch_texts)):
                mid = batch_mal_ids[embed_i]
                index[str(mid)] = len(embeddings_list)
                embeddings_list.append(vecs[embed_i])
            
            batch_mal_ids, batch_texts = [], []

            # Periodic checkpoint save
            total_saved += BATCH_SIZE
            if total_saved % save_every < BATCH_SIZE:
                save_index(index, embeddings_list)
                print(f"\n[embed_synopsis] Checkpoint: {len(embeddings_list)} embeddings saved.")


    # ── Flush remaining ──────────────────────────────────────────────────────
    if batch_texts:
        vecs = model.encode(batch_texts, batch_size=BATCH_SIZE, normalize_embeddings=True, show_progress_bar=False)
        for embed_i in range(len(batch_texts)):
            mid = batch_mal_ids[embed_i]
            index[str(mid)] = len(embeddings_list)
            embeddings_list.append(vecs[embed_i])

    # ── Save ─────────────────────────────────────────────────────────────────
    save_index(index, embeddings_list)
    print(f"[embed_synopsis] Done. Saved {len(embeddings_list)} embeddings → {EMBEDDINGS_PATH}")
    print(f"[embed_synopsis] Index saved → {INDEX_PATH}")

if __name__ == "__main__":
    main()
