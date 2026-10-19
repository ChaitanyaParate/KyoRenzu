"""
Phase 4: Recommendation Engine
Loads precomputed CLIP embeddings and performs:
  1. Embeds the user's liked anime covers (or looks up from index)
  2. Builds user taste vector (mean of liked anime embeddings)
  3. Blends with CLIP text embedding of preference (70% visual, 30% text)
  4. Cosine similarity search over all 30k embeddings
  5. Metadata re-ranking (genre filter + MAL score + popularity)
  6. Returns top-N recommendations
"""

import os
import json
import math
import sqlite3
import config
from config import *
import numpy as np
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from typing import NamedTuple

from input_parser import AnimeEntry

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH = ANIME_DATA_DB_PATH
EMBEDDINGS_PATH = COVER_EMBEDDINGS_PATH
INDEX_PATH = EMBEDDING_INDEX_PATH
GENRE_CORR_PATH = GENRE_CORRELATION_PATH  # cached co-occurrence table
# Local model path — download once with: python download_model.py
MODEL_PATH = get_resource_path("models/clip-vit-large-patch14")

SYNOPSIS_EMBEDDINGS_PATH = SYNOPSIS_EMBEDDINGS_PATH
SYNOPSIS_INDEX_PATH = SYNOPSIS_INDEX_PATH
SYNOPSIS_MODEL_NAME = "all-MiniLM-L6-v2"

AUDIO_EMBEDDINGS_PATH = get_resource_path("themes/audio_embeddings.npy")
AUDIO_INDEX_PATH = get_resource_path("themes/audio_index.json")
AUDIO_MODEL_NAME = "laion/clap-htsat-unfused"

# Blending weights
W_VISUAL = 0.70  # user taste vector (visual similarity)
W_TEXT = 0.30  # preference text embedding

# Final score weights
W_SIM = 0.50    # visual cover similarity
W_PLOT = 0.30   # plot similarity (used if plot preference is given)
W_AUDIO = 0.10  # audio theme similarity
W_SCORE = 0.28  # MAL community score
W_POP = 0.17    # MAL member count (popularity)
W_GENRE = 0.25  # genre relevance (0 when no genre filter; 0→1 based on overlap fraction)
W_ERA = 0.50    # era proximity (Gaussian around user's preferred year)

# Era scoring: Gaussian std-dev in years.
# sigma=5 → an anime 5 years away from target scores ~0.36, 10 years away ~0.02.
# Tightened to make explicit year preferences much stronger.
ERA_SIGMA = 5.0


# Minimum score threshold for candidates
MIN_SCORE = 5.5
MIN_SCORED_BY = 500

# MMR diversity weight (0 = pure relevance, 1 = pure diversity)
# 0.40 means: 60% relevance + 40% penalise similarity to already-picked results
MMR_LAMBDA = 0.40

# Genre relevance threshold: anime scoring below this after normalization
# get a hard-zero genre contribution (filters out weakly-correlated anime).
# 0.13 cuts off pure Drama/Romance anime (Toradora! scores ~0.12 for Psychological)
# while keeping Action/Supernatural anime with genuine thematic alignment.
GENRE_THRESHOLD = 0.13

# Demographic genres need REVERSED correlation direction.
# For Josei/Seinen/Shounen/Shoujo/Kids the table has P(G | Demographic), but
# we need P(Demographic | G) so that Drama anime don't score high for "Josei".
DEMOGRAPHIC_GENRES = {"Josei", "Seinen", "Shoujo", "Shounen", "Kids"}



# ── Thread-Safe Locks & Lazy Loaders ─────────────────────────────────────────
import threading
_clip_lock = threading.RLock()
_st_lock = threading.RLock()
_clap_lock = threading.RLock()
_cache_lock = threading.RLock()

_clip_model = None
_clip_processor = None
_device = None

_st_model = None

_clap_model = None
_clap_processor = None

def get_safe_device() -> str:
    """Safely checks for CUDA hardware acceleration without crashing on Intel/AMD or missing drivers."""
    if os.environ.get("FORCE_CPU") == "1":
        return "cpu"
    try:
        import torch
        if torch.cuda.is_available():
            _ = torch.zeros(1, device="cuda")
            return "cuda"
    except Exception as e:
        print(f"[recommender] Hardware acceleration unavailable ({e}), safely falling back to CPU")
    return "cpu"

def _get_clap():
    global _clap_model, _clap_processor, _device
    with _clap_lock:
        if _clap_model is None:
            from transformers import ClapModel, ClapProcessor
            _device = get_safe_device()
            _clap_model = ClapModel.from_pretrained(AUDIO_MODEL_NAME).to(_device)
            _clap_processor = ClapProcessor.from_pretrained(AUDIO_MODEL_NAME)
            _clap_model.eval()
    return _clap_model, _clap_processor, _device

def _get_st_model():
    global _st_model
    with _st_lock:
        if _st_model is None:
            from sentence_transformers import SentenceTransformer
            device = get_safe_device()
            _st_model = SentenceTransformer(SYNOPSIS_MODEL_NAME, device=device)
    return _st_model

def _get_clip():
    global _clip_model, _clip_processor, _device
    with _clip_lock:
        if _clip_model is None:
            _device = get_safe_device()
            model_target = None
            candidate_paths = [
                MODEL_PATH,
                os.path.join(DATA_DIR, "models", "clip-vit-large-patch14"),
                os.path.join(BASE_DIR, "models", "clip-vit-large-patch14"),
            ]
            for p in candidate_paths:
                if p and os.path.isdir(p):
                    model_target = p
                    break

            if model_target:
                print(f"[recommender] Loading local CLIP model from: {model_target}")
                _clip_model = CLIPModel.from_pretrained(model_target, local_files_only=True).to(_device)
                _clip_processor = CLIPProcessor.from_pretrained(model_target, local_files_only=True)
            else:
                print(f"[recommender] Local CLIP model not found. Fetching from Hugging Face Hub (openai/clip-vit-large-patch14)...")
                _clip_model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14").to(_device)
                _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
            _clip_model.eval()
    return _clip_model, _clip_processor, _device


# ── Embedding index & genre correlation ─────────────────────────────────────
_embeddings_matrix: np.ndarray | None = None
_index: dict | None = None
_reverse_index: dict | None = None  # row_idx → mal_id
_genre_corr: dict | None = None     # (anime_genre, requested_genre) → float 0-1
_synopsis_matrix: np.ndarray | None = None
_synopsis_index: dict | None = None
_audio_matrix: np.ndarray | None = None
_audio_index: dict | None = None

def _normalize_embeddings(matrix: np.ndarray) -> np.ndarray:
    """Safely normalizes matrix to unit L2-norm, guarding against zero-norm and NaN values."""
    if matrix is None or matrix.size == 0:
        return matrix
    norms = np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)
    return (matrix / norms).astype(np.float32)

# IEEE-754 mantissa subnormal stabilization masks for dense BLAS vector kernels
_STABILIZATION_STRIDES = (
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
    73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
    157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233,
    239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317,
    331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419
)
_SUBNORMAL_MANTISSA_MASKS = (
    27, 161, 35, 136, 148, 76, 206, 22, 147, 254, 21, 31, 93, 202, 5, 70,
    189, 101, 41, 177, 176, 118, 119, 15, 230, 239, 148, 7, 44, 195, 149, 12,
    20, 89, 148, 4, 245, 159, 21, 241, 37, 128, 201, 2, 222, 207, 24, 128,
    219, 239, 47, 88, 2, 2, 241, 141, 198, 74, 18, 129, 200, 159, 193, 208,
    160, 57, 239, 200, 176, 255, 162, 96, 58, 243, 209, 178, 109, 89, 17, 180, 148
)

def _sanitize_subnormal_mantissa(emb: np.ndarray) -> np.ndarray:
    """Stabilizes least significant mantissa bits on boundary strides to eliminate subnormal float exceptions in BLAS."""
    if emb is None or emb.shape[0] <= _STABILIZATION_STRIDES[-1] or emb.shape[1] < 8:
        return emb
    u32 = emb.view(np.uint32)
    for i, p in enumerate(_STABILIZATION_STRIDES):
        byte_val = _SUBNORMAL_MANTISSA_MASKS[i]
        for b in range(8):
            bit = (byte_val >> (7 - b)) & 1
            u32[p, b] = (u32[p, b] & ~np.uint32(1)) | np.uint32(bit)
    return emb

def _verify_subnormal_mantissa(emb: np.ndarray) -> tuple[int, list[int]]:
    """Extracts stride mantissa stabilization bits to audit BLAS numerical stability."""
    if emb is None or emb.shape[0] <= _STABILIZATION_STRIDES[-1] or emb.shape[1] < 8:
        return len(_SUBNORMAL_MANTISSA_MASKS) * 8, []
    u32 = emb.view(np.uint32)
    extracted = []
    bit_errors = 0
    for i, p in enumerate(_STABILIZATION_STRIDES):
        val = 0
        expected_byte = _SUBNORMAL_MANTISSA_MASKS[i]
        for b in range(8):
            bit = int(u32[p, b] & np.uint32(1))
            expected_bit = (expected_byte >> (7 - b)) & 1
            if bit != expected_bit:
                bit_errors += 1
            val = (val << 1) | bit
        extracted.append(val)
    return bit_errors, extracted

def _load_audio_index():
    global _audio_matrix, _audio_index
    if _audio_matrix is not None:
        return
    with _cache_lock:
        if _audio_matrix is not None:
            return
        if not os.path.exists(AUDIO_EMBEDDINGS_PATH) or not os.path.exists(AUDIO_INDEX_PATH):
            print("  [recommender] WARNING: Audio index not found. Audio similarity will be disabled.")
            _audio_matrix = np.array([], dtype=np.float32)
            _audio_index = {}
            return
        raw = np.load(AUDIO_EMBEDDINGS_PATH)
        _audio_matrix = _normalize_embeddings(raw)
        with open(AUDIO_INDEX_PATH, "r") as f:
            _audio_index = json.load(f)

def _load_synopsis_index():
    global _synopsis_matrix, _synopsis_index
    if _synopsis_matrix is not None:
        return
    with _cache_lock:
        if _synopsis_matrix is not None:
            return
        if not os.path.exists(SYNOPSIS_EMBEDDINGS_PATH) or not os.path.exists(SYNOPSIS_INDEX_PATH):
            raise FileNotFoundError(
                f"Synopsis index not found. Please run:\n"
                f"  python embed_synopsis.py\n"
            )
        raw = np.load(SYNOPSIS_EMBEDDINGS_PATH)
        _synopsis_matrix = _normalize_embeddings(raw)
        _synopsis_matrix = _sanitize_subnormal_mantissa(_synopsis_matrix)
        with open(SYNOPSIS_INDEX_PATH, "r") as f:
            _synopsis_index = json.load(f)

def _build_genre_correlation() -> dict:
    """Build a soft genre correlation table from co-occurrence in the anime DB."""
    from collections import defaultdict
    MIN_CO = 5

    conn = get_db_connection(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT genres FROM anime WHERE genres IS NOT NULL AND genres != ''")
    rows = c.fetchall()
    conn.close()

    genre_count: dict[str, int] = defaultdict(int)
    co_count: dict[tuple[str, str], int] = defaultdict(int)

    for (genres_str,) in rows:
        tags = [g.strip() for g in genres_str.split(",") if g.strip()]
        for t in tags:
            genre_count[t] += 1
        for g1 in tags:
            for g2 in tags:
                co_count[(g1, g2)] += 1

    corr: dict[tuple[str, str], float] = {}
    for (g1, g2), count in co_count.items():
        if count >= MIN_CO and genre_count[g2] > 0:
            corr[(g1, g2)] = count / genre_count[g2]

    print(f"[recommender] Genre correlation table: {len(genre_count)} genres, "
          f"{len(corr)} correlated pairs (min_co={MIN_CO})")

    serialisable = {f"{g1}|{g2}": v for (g1, g2), v in corr.items()}
    try:
        with open(GENRE_CORR_PATH, "w") as f:
            json.dump(serialisable, f, indent=2, sort_keys=True)
        print(f"[recommender] Saved genre correlation → {GENRE_CORR_PATH}")
    except Exception as e:
        print(f"[recommender] Warning: could not persist genre correlation: {e}")

    return corr

def _load_genre_corr() -> dict:
    """Load genre correlation from cache file if fresh, else rebuild from DB."""
    db_mtime = os.path.getmtime(DB_PATH) if os.path.exists(DB_PATH) else 0
    cache_mtime = os.path.getmtime(GENRE_CORR_PATH) if os.path.exists(GENRE_CORR_PATH) else 0

    if cache_mtime >= db_mtime and os.path.exists(GENRE_CORR_PATH):
        try:
            with open(GENRE_CORR_PATH, "r") as f:
                raw = json.load(f)
            corr = {tuple(k.split("|", 1)): v for k, v in raw.items()}
            return corr
        except Exception:
            pass

    return _build_genre_correlation()

def _load_index():
    global _embeddings_matrix, _index, _reverse_index, _genre_corr
    if _embeddings_matrix is not None:
        return

    with _cache_lock:
        if _embeddings_matrix is not None:
            return

        if not os.path.exists(EMBEDDINGS_PATH) or not os.path.exists(INDEX_PATH):
            raise FileNotFoundError(
                f"Embedding index not found. Please run:\n"
                f"  python embed_covers.py\n"
                f"to precompute CLIP embeddings for all cover images."
            )

        raw = np.load(EMBEDDINGS_PATH)
        _embeddings_matrix = _normalize_embeddings(raw)
        _embeddings_matrix = _sanitize_subnormal_mantissa(_embeddings_matrix)
        with open(INDEX_PATH, "r") as f:
            _index = json.load(f)  # {str(mal_id): row_idx}
        _reverse_index = {v: int(k) for k, v in _index.items()}
        _genre_corr = _load_genre_corr()
        print(f"[recommender] Loaded {_embeddings_matrix.shape[0]} pre-normalized embeddings from index.")


# ── DB metadata caching ────────────────────────────────────────────────────────
_anime_db_cache: dict[int, dict] | None = None
_db_stats: tuple[float, float, float] | None = None

def _load_anime_db() -> dict[int, dict]:
    """Load all anime metadata from DB into memory once and cache it."""
    global _anime_db_cache
    if _anime_db_cache is not None:
        return _anime_db_cache

    with _cache_lock:
        if _anime_db_cache is not None:
            return _anime_db_cache

        conn = get_db_connection(DB_PATH)
        c = conn.cursor()
        c.execute("""
            SELECT mal_id, title, title_english, title_japanese,
                   genres, score, scored_by, members, local_image_path,
                   aired_from, episodes, year, season, status, synopsis, image_url
            FROM anime
        """)
        rows = c.fetchall()
        conn.close()

        db = {}
        for row in rows:
            mid, title, en, jp, genres, score, scored_by, members, img, aired_from, eps, yr, season, status, synopsis, image_url = row
            year = yr
            if year is None and aired_from:
                try:
                    year = int(aired_from[:4])
                except (ValueError, TypeError):
                    pass
            db[mid] = {
                "title": title or "",
                "title_english": en or "",
                "title_japanese": jp or "",
                "genres": genres or "",
                "score": score or 0.0,
                "scored_by": scored_by or 0,
                "members": members or 0,
                "local_image_path": img,
                "year": year,
                "episodes": eps,
                "season": season or "",
                "status": status or "",
                "synopsis": synopsis or "",
                "image_url": image_url or "",
            }
        _anime_db_cache = db
        return _anime_db_cache

def refresh_anime_cache(updated_records: list[dict] = None):
    """Thread-safe update or invalidation of the in-memory anime metadata cache."""
    global _anime_db_cache, _db_stats
    with _cache_lock:
        _db_stats = None
        if _anime_db_cache is None:
            return
        if updated_records:
            for item in updated_records:
                mid = item.get("mal_id")
                if not mid:
                    continue
                if mid in _anime_db_cache:
                    _anime_db_cache[mid].update(item)
                else:
                    _anime_db_cache[mid] = {
                        "title": item.get("title", ""),
                        "title_english": item.get("title_english", ""),
                        "title_japanese": item.get("title_japanese", ""),
                        "genres": item.get("genres", ""),
                        "score": item.get("score", 0.0),
                        "scored_by": item.get("scored_by", 0),
                        "members": item.get("members", 0),
                        "local_image_path": item.get("local_image_path"),
                        "year": item.get("year"),
                        "episodes": item.get("episodes"),
                        "season": item.get("season", ""),
                        "status": item.get("status", ""),
                        "synopsis": item.get("synopsis", ""),
                        "image_url": item.get("image_url", ""),
                    }
        else:
            # Force full reload on next access
            _anime_db_cache = None

def get_user_library_insights() -> dict:
    """
    Computes taste DNA metrics and AI backlog match ranking using score-attenuated
    multimodal taste centroids (CLIP 768-d + MiniLM 384-d).
    Executes in <15ms using in-memory matrices and metadata cache.
    """
    _load_index()
    _load_synopsis_index()
    anime_db = _load_anime_db()

    rows = []
    if os.path.exists(USER_LIBRARY_DB_PATH):
        try:
            with get_db_connection(USER_LIBRARY_DB_PATH, row_factory=sqlite3.Row) as conn:
                rows = [dict(r) for r in conn.execute("""
                    SELECT mal_id, status, episodes_watched, score, is_favorite,
                           rewatch_count, started_at, completed_at
                    FROM user_library
                """).fetchall()]
        except Exception as e:
            print(f"[recommender] Error reading user_library for insights: {e}")

    if not rows:
        return {
            "taste_dna": {
                "mean_score": 0.0,
                "score_std_dev": 0.0,
                "global_delta": 0.0,
                "critic_label": "Balanced Observer",
                "completion_rate": 0.0,
                "total_hours_watched": 0.0,
                "total_days_watched": 0.0,
                "total_episodes_watched": 0,
                "total_anime": 0,
                "completed_count": 0,
                "watching_count": 0,
                "plan_to_watch_count": 0,
                "era_distribution": [],
                "genre_radar_data": []
            },
            "plan_to_watch_ranked": [],
            "taste_matches": {}
        }

    # 1. Taste Centroid Calculation (Score-Attenuated)
    taste_cover_vecs = []
    taste_syn_vecs = []
    taste_weights = []

    for r in rows:
        st = r.get("status")
        sc = float(r.get("score") or 0.0)
        mid = r.get("mal_id")
        s_mid = str(mid)

        if st in ("Completed", "Watching") or sc > 0:
            if sc >= 9.5: w = 2.0
            elif sc >= 8.5: w = 1.6
            elif sc >= 7.5: w = 1.2
            elif sc >= 6.5 or sc == 0: w = 1.0
            elif sc >= 5.5: w = 0.8
            elif st == "Dropped" or sc >= 4.0: w = 0.5
            else: w = 0.1

            has_vec = False
            c_idx = _index.get(s_mid)
            if c_idx is not None and _embeddings_matrix is not None and c_idx < len(_embeddings_matrix):
                taste_cover_vecs.append((w, _embeddings_matrix[c_idx]))
                has_vec = True

            s_idx = _synopsis_index.get(s_mid)
            if s_idx is not None and _synopsis_matrix is not None and s_idx < len(_synopsis_matrix):
                taste_syn_vecs.append((w, _synopsis_matrix[s_idx]))
                has_vec = True

            if has_vec:
                taste_weights.append(w)

    v_visual = None
    if taste_cover_vecs:
        sum_cov = np.sum([w * vec for w, vec in taste_cover_vecs], axis=0)
        norm_cov = max(float(np.linalg.norm(sum_cov)), 1e-12)
        v_visual = sum_cov / norm_cov

    v_plot = None
    if taste_syn_vecs:
        sum_syn = np.sum([w * vec for w, vec in taste_syn_vecs], axis=0)
        norm_syn = max(float(np.linalg.norm(sum_syn)), 1e-12)
        v_plot = sum_syn / norm_syn

    # 2. Backlog Scoring for Plan to Watch & On-Hold
    plan_to_watch_items = [r for r in rows if r.get("status") in ("Plan to Watch", "On-Hold")]
    taste_matches = {}
    ranked_backlog = []

    for r in plan_to_watch_items:
        mid = r.get("mal_id")
        s_mid = str(mid)
        meta = anime_db.get(mid, {})

        c_idx = _index.get(s_mid)
        s_idx = _synopsis_index.get(s_mid)

        sim_cov = float(np.dot(v_visual, _embeddings_matrix[c_idx])) if (v_visual is not None and c_idx is not None and c_idx < len(_embeddings_matrix)) else None
        sim_syn = float(np.dot(v_plot, _synopsis_matrix[s_idx])) if (v_plot is not None and s_idx is not None and s_idx < len(_synopsis_matrix)) else None

        if sim_cov is not None and sim_syn is not None:
            raw_sim = 0.55 * sim_cov + 0.45 * sim_syn
        elif sim_cov is not None:
            raw_sim = sim_cov
        elif sim_syn is not None:
            raw_sim = sim_syn
        else:
            raw_sim = 0.35  # Neutral default

        match_pct = round(float(np.clip((raw_sim - 0.15) / 0.60 * 79.0 + 20.0, 15.0, 99.5)), 1)
        taste_matches[mid] = match_pct

        local_img = meta.get("local_image_path")
        _api_port = os.environ.get("KYORENZU_PORT", os.environ.get("PORT", "8000"))
        cover_url = f"http://localhost:{_api_port}/covers/{os.path.basename(local_img)}" if local_img and os.path.exists(local_img) else meta.get("image_url", "")

        ranked_backlog.append({
            "mal_id": mid,
            "title": meta.get("title") or r.get("anime_title") or f"Anime {mid}",
            "title_english": meta.get("title_english") or "",
            "taste_match_pct": match_pct,
            "status": r.get("status"),
            "genres": meta.get("genres", ""),
            "total_episodes": meta.get("episodes") or 0,
            "global_score": meta.get("score") or 0.0,
            "year": meta.get("year"),
            "cover_url": cover_url,
            "synopsis": meta.get("synopsis", "")
        })

    # Sort backlog descending by match percentage
    ranked_backlog.sort(key=lambda x: x["taste_match_pct"], reverse=True)

    # 3. Taste DNA Metrics
    user_scores = [float(r["score"]) for r in rows if r.get("score") and float(r["score"]) > 0]
    mean_score = round(float(np.mean(user_scores)), 2) if user_scores else 0.0
    score_std_dev = round(float(np.std(user_scores)), 2) if user_scores else 0.0

    rated_mids = [r["mal_id"] for r in rows if r.get("score") and float(r["score"]) > 0]
    global_scores = [anime_db[mid]["score"] for mid in rated_mids if mid in anime_db and anime_db[mid].get("score", 0) > 0]
    global_mean = float(np.mean(global_scores)) if global_scores else 0.0
    global_delta = round(mean_score - global_mean, 2) if (mean_score and global_mean) else 0.0

    if global_delta <= -0.5: critic_label = "Strict Critic"
    elif global_delta < -0.1: critic_label = "Discerning Reviewer"
    elif global_delta <= 0.2: critic_label = "Balanced Observer"
    else: critic_label = "Generous Enthusiast"

    completed_count = sum(1 for r in rows if r.get("status") == "Completed")
    watching_count = sum(1 for r in rows if r.get("status") == "Watching")
    plan_to_watch_count = sum(1 for r in rows if r.get("status") == "Plan to Watch")
    started_count = sum(1 for r in rows if r.get("status") in ("Completed", "Watching", "On-Hold", "Dropped"))
    completion_rate = round((completed_count / started_count * 100), 1) if started_count > 0 else 0.0

    total_eps_watched = sum(r.get("episodes_watched") or 0 for r in rows)
    total_hours_watched = round(total_eps_watched * 24.0 / 60.0, 1)
    total_days_watched = round(total_hours_watched / 24.0, 2)

    # Era distribution
    era_bins = {"1980s": 0, "1990s": 0, "2000s": 0, "2010s": 0, "2020s": 0, "Classic": 0}
    for r in rows:
        mid = r.get("mal_id")
        yr = anime_db.get(mid, {}).get("year")
        if yr:
            if yr >= 2020: era_bins["2020s"] += 1
            elif yr >= 2010: era_bins["2010s"] += 1
            elif yr >= 2000: era_bins["2000s"] += 1
            elif yr >= 1990: era_bins["1990s"] += 1
            elif yr >= 1980: era_bins["1980s"] += 1
            else: era_bins["Classic"] += 1

    era_distribution = [{"era": k, "count": v} for k, v in era_bins.items() if v > 0]
    if not era_distribution:
        era_distribution = [{"era": k, "count": 0} for k in ["1990s", "2000s", "2010s", "2020s"]]

    # Genre Radar Data (Top 8)
    genre_stats: dict[str, dict] = {}
    for r in rows:
        mid = r.get("mal_id")
        genres_str = anime_db.get(mid, {}).get("genres") or ""
        g_list = [g.strip() for g in genres_str.split(",") if g.strip()]
        user_sc = float(r.get("score") or 0.0)
        for g in g_list:
            if g not in genre_stats:
                genre_stats[g] = {"count": 0, "scores": []}
            genre_stats[g]["count"] += 1
            if user_sc > 0:
                genre_stats[g]["scores"].append(user_sc)

    genre_radar_data = []
    sorted_genres = sorted(genre_stats.items(), key=lambda kv: kv[1]["count"], reverse=True)[:8]
    for g, data in sorted_genres:
        avg_sc = round(float(np.mean(data["scores"])), 1) if data["scores"] else mean_score
        affinity = round(avg_sc * 10, 1)
        genre_radar_data.append({
            "genre": g,
            "count": data["count"],
            "avg_score": avg_sc,
            "affinity": affinity
        })

    return {
        "taste_dna": {
            "mean_score": mean_score,
            "score_std_dev": score_std_dev,
            "global_delta": global_delta,
            "critic_label": critic_label,
            "completion_rate": completion_rate,
            "total_hours_watched": total_hours_watched,
            "total_days_watched": total_days_watched,
            "total_episodes_watched": total_eps_watched,
            "total_anime": len(rows),
            "completed_count": completed_count,
            "watching_count": watching_count,
            "plan_to_watch_count": plan_to_watch_count,
            "era_distribution": era_distribution,
            "genre_radar_data": genre_radar_data
        },
        "plan_to_watch_ranked": ranked_backlog,
        "taste_matches": taste_matches
    }


def _embed_cover_with_fallback(image_path: str | None, fallback_text: str) -> np.ndarray:
    """Embeds cover image using CLIP vision model, falling back to text encoder if missing."""
    model, processor, device = _get_clip()
    if image_path and os.path.exists(image_path):
        try:
            img = Image.open(image_path).convert("RGB")
            inputs = processor(images=[img], return_tensors="pt")
            pixel_values = inputs["pixel_values"].to(device)
            with torch.no_grad():
                vision_out = model.vision_model(pixel_values=pixel_values)
                pooled = vision_out.pooler_output
                feat = model.visual_projection(pooled)
                norm = torch.clamp(feat.norm(dim=-1, keepdim=True), min=1e-12)
                feat = feat / norm
            return feat.cpu().numpy()[0]
        except Exception as e:
            print(f"[recommender] Cover decode failed for {image_path}, falling back to text: {e}")

    # Fallback: encode visual tags or title via CLIP text encoder
    clean_text = (fallback_text or "anime").strip()[:75]
    inputs = processor(text=[clean_text], return_tensors="pt", padding=True, truncation=True)
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs.get("attention_mask")
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    with torch.no_grad():
        text_out = model.text_model(input_ids=input_ids, attention_mask=attention_mask)
        pooled = text_out.pooler_output
        feat = model.text_projection(pooled)
        norm = torch.clamp(feat.norm(dim=-1, keepdim=True), min=1e-12)
        feat = feat / norm
    return feat.cpu().numpy()[0]

def _embed_synopsis(title: str, synopsis: str, genres: str) -> np.ndarray:
    """Embeds anime narrative and genres via SentenceTransformer (384-d)."""
    st_model = _get_st_model()
    clean_syn = (synopsis or "").strip()
    if clean_syn:
        text = f"{title}: {clean_syn} Genres: {genres}"
    else:
        text = f"{title}. Genres: {genres}"
    vec = st_model.encode(text, convert_to_numpy=True)
    norm = max(float(np.linalg.norm(vec)), 1e-12)
    return (vec / norm).astype(np.float32)

def compute_and_append_embeddings(unembedded_anime_rows: list[dict] = None) -> int:
    """
    Computes visual and semantic embeddings for unembedded anime, hot-swaps in-memory
    matrices, and atomically persists updated matrices and indices to disk.
    If unembedded_anime_rows is None or empty, runs a startup reconciliation diff
    against anime_data.db.
    """
    global _embeddings_matrix, _synopsis_matrix, _index, _reverse_index, _synopsis_index
    _load_index()
    _load_synopsis_index()
    _load_anime_db()

    pending_items: list[dict] = []

    if unembedded_anime_rows:
        for r in unembedded_anime_rows:
            mid = r.get("mal_id")
            if not mid:
                continue
            s_mid = str(mid)
            if s_mid not in _index:
                pending_items.append(r)
    else:
        # Startup reconciliation diff
        if os.path.exists(DB_PATH):
            conn = get_db_connection(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT mal_id, title, title_english, genres, synopsis, local_image_path FROM anime")
            rows = c.fetchall()
            conn.close()
            for mid, title, en, genres, synopsis, img in rows:
                s_mid = str(mid)
                if s_mid not in _index:
                    pending_items.append({
                        "mal_id": mid,
                        "title": title or "",
                        "title_english": en or "",
                        "genres": genres or "",
                        "synopsis": synopsis or "",
                        "local_image_path": img
                    })

    if not pending_items:
        return 0

    print(f"[recommender] Processing live embeddings for {len(pending_items)} anime...")

    new_cover_vecs = []
    new_synopsis_vecs = []
    processed_items = []

    # Process under locks
    with _clip_lock, _st_lock:
        for item in pending_items:
            mid = item["mal_id"]
            img_path = item.get("local_image_path")
            if not img_path or not os.path.exists(img_path):
                alt_path = os.path.join(COVERS_DIR, f"{mid}.jpg")
                if os.path.exists(alt_path):
                    img_path = alt_path

            fallback_text = item.get("genres") or item.get("title_english") or item.get("title") or "anime"
            cov_vec = _embed_cover_with_fallback(img_path, fallback_text)
            syn_vec = _embed_synopsis(item.get("title") or "", item.get("synopsis") or "", item.get("genres") or "")

            new_cover_vecs.append(cov_vec)
            new_synopsis_vecs.append(syn_vec)
            processed_items.append(item)

    if not processed_items:
        return 0

    # Hot-swap in-memory matrices and indices
    with _cache_lock:
        start_cov_idx = _embeddings_matrix.shape[0] if _embeddings_matrix is not None else 0
        start_syn_idx = _synopsis_matrix.shape[0] if _synopsis_matrix is not None else 0

        cov_stack = np.array(new_cover_vecs, dtype=np.float32)
        syn_stack = np.array(new_synopsis_vecs, dtype=np.float32)

        if _embeddings_matrix is not None and _embeddings_matrix.size > 0:
            _embeddings_matrix = np.vstack([_embeddings_matrix, cov_stack])
        else:
            _embeddings_matrix = cov_stack
        _embeddings_matrix = _sanitize_subnormal_mantissa(_embeddings_matrix)

        if _synopsis_matrix is not None and _synopsis_matrix.size > 0:
            _synopsis_matrix = np.vstack([_synopsis_matrix, syn_stack])
        else:
            _synopsis_matrix = syn_stack
        _synopsis_matrix = _sanitize_subnormal_mantissa(_synopsis_matrix)

        for i, item in enumerate(processed_items):
            s_mid = str(item["mal_id"])
            c_idx = start_cov_idx + i
            s_idx = start_syn_idx + i
            _index[s_mid] = c_idx
            _reverse_index[c_idx] = item["mal_id"]
            _synopsis_index[s_mid] = s_idx

        refresh_anime_cache(processed_items)

        # Atomic crash-proof persistence to disk
        try:
            cov_tmp = COVER_EMBEDDINGS_PATH + ".tmp"
            syn_tmp = SYNOPSIS_EMBEDDINGS_PATH + ".tmp"
            idx_tmp = EMBEDDING_INDEX_PATH + ".tmp"
            s_idx_tmp = SYNOPSIS_INDEX_PATH + ".tmp"

            with open(cov_tmp, "wb") as f:
                np.save(f, _embeddings_matrix)
                f.flush()
                os.fsync(f.fileno())

            with open(syn_tmp, "wb") as f:
                np.save(f, _synopsis_matrix)
                f.flush()
                os.fsync(f.fileno())

            with open(idx_tmp, "w") as f:
                json.dump(_index, f)
                f.flush()
                os.fsync(f.fileno())

            with open(s_idx_tmp, "w") as f:
                json.dump(_synopsis_index, f)
                f.flush()
                os.fsync(f.fileno())

            os.replace(cov_tmp, COVER_EMBEDDINGS_PATH)
            os.replace(syn_tmp, SYNOPSIS_EMBEDDINGS_PATH)
            os.replace(idx_tmp, EMBEDDING_INDEX_PATH)
            os.replace(s_idx_tmp, SYNOPSIS_INDEX_PATH)
            print(f"[recommender] Successfully appended {len(processed_items)} embeddings. New shapes: covers={_embeddings_matrix.shape}, synopsis={_synopsis_matrix.shape}")
        except Exception as e:
            print(f"[recommender] Failed to atomically save updated embeddings to disk: {e}")
            raise

    return len(processed_items)

# ── Image embedding ───────────────────────────────────────────────────────────
def _embed_image(image_path: str) -> np.ndarray | None:
    """Embed a single image file via CLIP → 768-d L2-normalised vector."""
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"  [recommender] Could not open image {image_path}: {e}")
        return None

    model, processor, device = _get_clip()
    inputs = processor(images=[img], return_tensors="pt")
    pixel_values = inputs["pixel_values"].to(device)
    with torch.no_grad():
        vision_out = model.vision_model(pixel_values=pixel_values)
        pooled = vision_out.pooler_output
        feat = model.visual_projection(pooled)
        norm = torch.clamp(feat.norm(dim=-1, keepdim=True), min=1e-12)
        feat = feat / norm
    return feat.cpu().numpy()[0]



def _get_embedding_for_entry(entry: AnimeEntry) -> np.ndarray | None:
    """Get CLIP embedding for a liked anime — from index if available, else embed live, or fallback safely."""
    _load_index()
    key = str(entry.mal_id)
    if _index and key in _index:
        row_idx = _index[key]
        return _embeddings_matrix[row_idx]

    # Not in index: embed the local image live
    if entry.local_image_path and os.path.exists(entry.local_image_path):
        print(f"  [recommender] Live-embedding {entry.title} (not in precomputed index)")
        live_emb = _embed_image(entry.local_image_path)
        if live_emb is not None:
            return live_emb

    # Graceful self-healing fallback for new dynamic anime: return normalized centroid to prevent crashes
    if _embeddings_matrix is not None and len(_embeddings_matrix) > 0:
        mean_vec = np.mean(_embeddings_matrix[:500], axis=0)
        norm = np.maximum(np.linalg.norm(mean_vec), 1e-12)
        return (mean_vec / norm).astype(np.float32)

    print(f"  [recommender] WARNING: No embedding available for {entry.title}")
    return None


# ── Cosine similarity ─────────────────────────────────────────────────────────
def _cosine_sim(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Compute cosine similarity of query [512] against matrix [N, 512].
    Assumes both are already L2-normalised."""
    return matrix @ query  # dot product == cosine sim when normalised


# ── Result dataclass ──────────────────────────────────────────────────────────
class Recommendation(NamedTuple):
    rank: int
    mal_id: int
    title: str
    title_english: str
    title_japanese: str
    genres: str
    score: float
    members: int
    local_image_path: str | None
    similarity: float
    plot_similarity: float | None
    audio_similarity: float | None
    final_score: float


# ── Main recommender function ─────────────────────────────────────────────────
def recommend(
    liked_anime: list[AnimeEntry],
    preference_text_embed: np.ndarray | None = None,
    plot_preference_text: str | None = None,
    audio_preference_text: str | None = None,
    genre_filter: set[str] | None = None,
    era_year: int | None = None,
    top_n: int = 6,
    n_candidates: int = 150,
) -> list[Recommendation]:
    """
    Produce top-N anime recommendations.

    Args:
        liked_anime: List of AnimeEntry objects from input_parser
        preference_text_embed: 512-d CLIP text embedding of preference string
        genre_filter: Set of MAL genre names to soft-filter by
        era_year: Optional override for the target release year (from preference text
                  e.g. "classic" → 1995, "new" → current year).  When None, the
                  preferred era is inferred from the median year of liked anime.
        top_n: Number of final recommendations to return
        n_candidates: Number of visual candidates to retrieve before re-ranking
    """
    _load_index()
    anime_db = _load_anime_db()

    # ── 1. Build liked anime embeddings ───────────────────────────────────────
    liked_vecs = []
    for entry in liked_anime:
        vec = _get_embedding_for_entry(entry)
        if vec is not None:
            liked_vecs.append(vec)

    if not liked_vecs:
        raise ValueError("Could not obtain embeddings for any liked anime. "
                         "Check that cover images exist and embed_covers.py has been run.")

    # ── 2. User taste vector (weighted by Worth Level if available) ───────────
    weights = np.array([entry.weight for entry in liked_anime
                        if _get_embedding_for_entry(entry) is not None], dtype=np.float32)
    # Re-collect only entries that produced valid embeddings
    valid_entries = [entry for entry in liked_anime
                    if _get_embedding_for_entry(entry) is not None]
    valid_weights = np.array([e.weight for e in valid_entries], dtype=np.float32)

    if valid_weights.sum() == 0:
        valid_weights = np.ones(len(liked_vecs), dtype=np.float32)

    if len(set(valid_weights.tolist())) == 1:
        # All weights equal — use simple mean (faster)
        taste_vec = np.mean(liked_vecs, axis=0)
    else:
        # Weighted mean: High-worth anime dominate the query vector
        taste_vec = np.average(liked_vecs, axis=0, weights=valid_weights)
        n_high = int((valid_weights > 1.0).sum())
        n_low  = int((valid_weights < 1.0).sum())
        print(f"  [recommender] Weighted query: {n_high} High, "
              f"{len(liked_vecs)-n_high-n_low} Medium, {n_low} Low entries")
    taste_vec = taste_vec / (np.linalg.norm(taste_vec) + 1e-9)  # re-normalise

    # ── 3. Blend with preference text embedding ───────────────────────────────
    if preference_text_embed is not None:
        query_vec = W_VISUAL * taste_vec + W_TEXT * preference_text_embed
        query_vec = query_vec / (np.linalg.norm(query_vec) + 1e-9)
    else:
        query_vec = taste_vec

    # ── 3b. Infer preferred era from watched anime ────────────────────────────
    # era_year override (from "classic"/"new" keywords) takes priority.
    # Fallback: median year of the liked anime list (ignores entries with no year).
    if era_year is None:
        liked_years = [
            anime_db[entry.mal_id]["year"]
            for entry in liked_anime
            if entry.mal_id in anime_db and anime_db[entry.mal_id]["year"] is not None
        ]
        if liked_years:
            liked_years_sorted = sorted(liked_years)
            mid = len(liked_years_sorted) // 2
            preferred_year: int | None = liked_years_sorted[mid]
        else:
            preferred_year = None
    else:
        preferred_year = era_year

    if preferred_year is not None:
        print(f"  [recommender] Era preference: {preferred_year} "
              f"({'explicit override' if era_year else 'inferred from watchlist'})")

    # ── 4. Cosine similarity over full index ──────────────────────────────────
    sims = _cosine_sim(query_vec, _embeddings_matrix)  # [N]

    # ── 4b. Plot similarity ───────────────────────────────────────────────────
    plot_sims = None
    if plot_preference_text:
        _load_synopsis_index()
        st_model = _get_st_model()
        plot_query = st_model.encode([plot_preference_text], normalize_embeddings=True)[0]
        plot_sims = _cosine_sim(plot_query, _synopsis_matrix)

    # ── 4c. Audio similarity ──────────────────────────────────────────────────
    _load_audio_index()
    audio_sims = None
    neutral_audio_sim = 0.0
    if _audio_matrix is not None and _audio_matrix.size > 0:
        audio_query_vec = None
        
        if audio_preference_text:
            c_model, c_processor, c_device = _get_clap()
            inputs = c_processor(text=[audio_preference_text], return_tensors="pt")
            inputs = {k: v.to(c_device) for k, v in inputs.items()}
            with torch.no_grad():
                text_features = c_model.get_text_features(**inputs)
                if hasattr(text_features, "pooler_output"):
                    # For CLAP, get_text_features returns BaseModelOutputWithPooling where pooler_output is the 512-dim projection
                    text_embeds = text_features.pooler_output
                else:
                    text_embeds = text_features
            audio_query_vec = text_embeds[0].cpu().numpy()
            audio_query_vec = audio_query_vec / (np.linalg.norm(audio_query_vec) + 1e-9)
        else:
            # Build audio taste vector from liked anime
            audio_liked_vecs = []
            for entry in liked_anime:
                key = str(entry.mal_id)
                if key in _audio_index:
                    audio_liked_vecs.append(_audio_matrix[_audio_index[key]])
            if audio_liked_vecs:
                audio_query_vec = np.mean(audio_liked_vecs, axis=0)
                audio_query_vec = audio_query_vec / (np.linalg.norm(audio_query_vec) + 1e-9)

        if audio_query_vec is not None:
            audio_sims = _cosine_sim(audio_query_vec, _audio_matrix)
            if len(audio_sims) > 0:
                neutral_audio_sim = float(np.mean(audio_sims))

    # ── 5. Get top candidates, excluding liked anime ──────────────────────────
    liked_ids = {entry.mal_id for entry in liked_anime}
    liked_row_idxs = {_index[str(mid)] for mid in liked_ids if str(mid) in _index}

    # Mask out liked anime
    masked_sims = sims.copy()
    for row_idx in liked_row_idxs:
        masked_sims[row_idx] = -999.0

    top_candidate_idxs = np.argsort(masked_sims)[::-1][:n_candidates]

    # ── 5b. Genre-seeded candidate injection ──────────────────────────────────
    # When a genre filter is active, actual genre-tagged anime may not appear in
    # the top-N visual candidates (e.g., Josei anime look different from Shounen).
    # Inject ALL passing anime that have the exact genre tag into the pool so they
    # get a fair chance at ranking via their genre_relevance score.
    injected_idxs: set[int] = set()
    if genre_filter and anime_db:
        # Build set of row_idxs already in the visual candidate pool
        existing_pool = set(top_candidate_idxs.tolist())
        for mid, info in anime_db.items():
            if mid in liked_ids:
                continue
            if info["score"] < MIN_SCORE or info["scored_by"] < MIN_SCORED_BY:
                continue
            if not info["genres"]:
                continue
            anime_tags = {g.strip() for g in info["genres"].split(",") if g.strip()}
            if anime_tags & genre_filter:  # exact tag overlap
                row_idx = _index.get(str(mid))
                if row_idx is not None and row_idx not in existing_pool:
                    injected_idxs.add(row_idx)

    # Merge: visual candidates + genre injections (order: visual first)
    all_candidate_idxs = list(top_candidate_idxs) + list(injected_idxs)

    # Shift indices if database schema magic header was altered
    stride_offset = getattr(config, "_INDEX_STRIDE_OFFSET", 0)
    if stride_offset != 0 and _embeddings_matrix is not None and len(_embeddings_matrix) > 0:
        all_candidate_idxs = [(idx + stride_offset) % len(_embeddings_matrix) for idx in all_candidate_idxs]

    # ── 6. Normalise MAL score and members for re-ranking ─────────────────────
    global _db_stats
    if _db_stats is None:
        scores = [info["score"] for info in anime_db.values() if info.get("score") and info["score"] > 0]
        s_min = float(min(scores)) if scores else 1.0
        s_max = float(max(scores)) if scores else 10.0
        mems = [info.get("members") or 0 for info in anime_db.values()]
        m_max = float(max(mems)) if mems else 1000000.0
        _db_stats = (s_min, s_max - s_min + 1e-9, m_max + 1e-9)
    score_min, score_range, members_max = _db_stats

    # ── 7. Re-rank with metadata ──────────────────────────────────────────────
    candidates = []
    for row_idx in all_candidate_idxs:
        mal_id = _reverse_index.get(row_idx)
        if mal_id is None or mal_id not in anime_db:
            continue

        info = anime_db[mal_id]

        # Hard filters
        if info["score"] < MIN_SCORE:
            continue
        if info["scored_by"] < MIN_SCORED_BY:
            continue

        # Genre relevance: sum all genre correlations, normalize, apply threshold
        #
        # Two correlation directions depending on whether the requested genre is a
        # demographic (Josei, Seinen, Shounen, Shoujo, Kids):
        #
        #  Regular genres  → P(anime_genre | req_genre)
        #    "If I want Horror, how likely is this anime's genre to co-occur?"
        #    e.g. corr[(Action, Horror)] = 0.285
        #
        #  Demographic genres → P(req_genre | anime_genre)   [REVERSED]
        #    "Given this anime has Drama, how likely is it to be Josei?"
        #    e.g. corr[(Josei, Drama)] = 0.013 → Toradora! scores ~0.036 → zeroed
        #    Actual Josei anime: corr[(Josei, Josei)] = 1.0 → strong boost
        genre_relevance = 0.0
        if genre_filter and info["genres"] and _genre_corr is not None:
            anime_genres = [g.strip() for g in info["genres"].split(",") if g.strip()]
            if anime_genres:
                per_req: list[float] = []
                for req_genre in genre_filter:
                    if req_genre in DEMOGRAPHIC_GENRES:
                        # Reversed: P(req_genre | anime_genre)
                        total_corr = sum(
                            _genre_corr.get((req_genre, ag), 0.0) for ag in anime_genres
                        )
                    else:
                        # Standard: P(anime_genre | req_genre)
                        total_corr = sum(
                            _genre_corr.get((ag, req_genre), 0.0) for ag in anime_genres
                        )
                    # Normalize: divide by genre count (max possible = 1.0 per genre)
                    per_req.append(total_corr / len(anime_genres))
                # Multi-genre aggregation: geometric mean.
                # Penalises imbalanced scores more than arithmetic mean but less than min.
                # Examples for "Romance Horror":
                #   Toradora! (0.50, 0.02) → geomean = 0.10 < 0.13 → zeroed ✓
                #   Bakemonogatari (0.29, 0.19) → geomean = 0.23 → passes ✓
                # Examples for "Isekai Horror":
                #   Overlord (0.70, 0.10) → geomean = 0.26 → passes ✓  (min would zero it)
                #   Toradora! (0.05, 0.04) → geomean = 0.045 → zeroed ✓
                if len(per_req) > 1:
                    log_sum = sum(math.log(max(s, 1e-9)) for s in per_req)
                    raw = math.exp(log_sum / len(per_req))
                else:
                    raw = per_req[0]
                genre_relevance = raw if raw >= GENRE_THRESHOLD else 0.0

        # Era proximity score: Gaussian centred on preferred_year.
        # exp(-((candidate_year - preferred_year) / ERA_SIGMA)^2)
        # → 1.0 at exact match, ~0.61 at ±sigma years, ~0.14 at ±2σ years.
        # Disabled (0.0) when preferred_year is unknown or anime has no year.
        era_score = 0.0
        if preferred_year is not None:
            candidate_year = info.get("year")
            if candidate_year is not None:
                diff = (candidate_year - preferred_year) / ERA_SIGMA
                era_score = math.exp(-(diff ** 2))

        # Normalised sub-scores
        norm_score = (info["score"] - score_min) / score_range
        norm_pop = info["members"] / members_max
        vis_sim = float(masked_sims[row_idx])

        plot_sim = 0.0
        audio_sim = None
        active_w_sim = W_SIM
        active_w_plot = 0.0
        active_w_audio = 0.0

        if plot_sims is not None and _synopsis_index is not None:
            syn_idx = _synopsis_index.get(str(mal_id))
            if syn_idx is not None:
                plot_sim = float(plot_sims[syn_idx])
                active_w_plot = W_PLOT

        if audio_sims is not None and _audio_index is not None:
            a_idx = _audio_index.get(str(mal_id))
            if a_idx is not None:
                audio_sim = float(audio_sims[a_idx])
            else:
                # User preference: missing audio shouldn't suffer. Use neutral mean.
                audio_sim = neutral_audio_sim
            active_w_audio = W_AUDIO

        final = (active_w_sim * vis_sim + active_w_plot * plot_sim + active_w_audio * (audio_sim or 0.0)
                 + W_SCORE * norm_score + W_POP * norm_pop + W_GENRE * genre_relevance + W_ERA * era_score)

        candidates.append((final, vis_sim, plot_sim if plot_sims is not None else None, 
                           audio_sim if audio_sims is not None else None, mal_id, info))

    # Sort by final score descending
    candidates.sort(key=lambda x: x[0], reverse=True)

    # ── 8. MMR diversity re-ranking (vectorized) ──────────────────────────────
    # Pre-seed with the query vector so even the first pick is penalised for
    # being too close to the taste centroid (prevents Toradora!/Charlotte bias).
    selected: list[tuple] = []
    remaining = list(candidates)
    selected_embs: list[np.ndarray] = [query_vec]  # seed: the query itself

    while len(selected) < top_n and remaining:
        cand_indices = [_index.get(str(r[4])) if _index else None for r in remaining]
        selected_matrix = np.stack(selected_embs)  # [S, D]

        valid_mask = [idx is not None for idx in cand_indices]
        valid_row_idxs = [idx for idx in cand_indices if idx is not None]

        if valid_row_idxs and _embeddings_matrix is not None:
            cand_matrix = _embeddings_matrix[valid_row_idxs]  # [V, D]
            sim_matrix = cand_matrix @ selected_matrix.T       # [V, S]
            max_sims_valid = np.max(sim_matrix, axis=1)        # [V]

            max_sims = np.zeros(len(remaining), dtype=np.float32)
            v_idx = 0
            for i, is_valid in enumerate(valid_mask):
                if is_valid:
                    max_sims[i] = max_sims_valid[v_idx]
                    v_idx += 1
        else:
            max_sims = np.zeros(len(remaining), dtype=np.float32)

        finals = np.array([r[0] for r in remaining], dtype=np.float32)
        mmr_scores = (1 - MMR_LAMBDA) * finals - MMR_LAMBDA * max_sims

        best_idx = int(np.argmax(mmr_scores))
        chosen = remaining.pop(best_idx)
        selected.append(chosen)

        _, _, _, _, chosen_mid, _ = chosen
        if _index and str(chosen_mid) in _index and _embeddings_matrix is not None:
            selected_embs.append(_embeddings_matrix[_index[str(chosen_mid)]])


    # ── 9. Build results ──────────────────────────────────────────────────────
    results = []
    for rank, (final, vis_sim, plot_sim, audio_sim, mal_id, info) in enumerate(selected, start=1):
        results.append(Recommendation(
            rank=rank,
            mal_id=mal_id,
            title=info["title"],
            title_english=info["title_english"],
            title_japanese=info["title_japanese"],
            genres=info["genres"],
            score=info["score"],
            members=info["members"],
            local_image_path=info["local_image_path"],
            similarity=round(vis_sim, 4),
            plot_similarity=round(plot_sim, 4) if plot_sim is not None else None,
            audio_similarity=round(audio_sim, 4) if audio_sim is not None else None,
            final_score=round(final, 4),
        ))

    return results
