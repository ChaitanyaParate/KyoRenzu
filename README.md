# 🎌 Judging Anime By Its Cover

> *"Don't judge a book by its cover"* — but we absolutely will judge anime by theirs.

A **multimodal AI anime recommendation engine** that combines **OpenAI CLIP visual embeddings** of cover artwork with **SentenceTransformer semantic plot embeddings** of synopses, blended through a weighted dual-vector scoring system. Ask for anime that *looks like Death Note* but has *a relaxing slice-of-life plot* — and the engine will find the perfect intersection.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🖼️ Visual Cover Matching | CLIP embeds 30k+ anime cover images; finds visually similar aesthetics |
| 📖 Semantic Plot Matching | SentenceTransformer embeds 19,490+ synopses; semantic search over plot summaries |
| 🎭 Genre Co-Occurrence Scoring | Statistical correlation table built from 30k anime, soft-matches related genres |
| 📅 Era Proximity Scoring | Gaussian decay rewards candidates close to your preferred release year |
| ⭐ Worth Level Weighting | High-rated entries in your watchlist influence the query 1.5× more |
| 🔍 Tiered Metadata Pipeline | AniList GraphQL → Jikan fallback for robust metadata collection |
| 🖥️ Web GUI | Gradio browser interface with cover gallery output |
| 📊 CSV / Excel input | Parses your exported watchlist file automatically |

---

## 🧠 How It Works — Full Pipeline

### Step 1 — Building Your Visual Taste Profile

You provide a list of anime you've enjoyed (as a CSV, Excel file, or comma-separated terminal input). The system:

1. **Fuzzy-matches** each title to a MAL ID using `rapidfuzz` against the local SQLite database — handling typos, alternate titles, and partial matches gracefully.
2. **Loads the CLIP cover embedding** for each matched anime from `cover_embeddings.npy`.
3. **Applies Worth Level weighting** (if your CSV has a `Worth Level` column): `High = 1.5×`, `Medium = 1.0×`, `Low = 0.3×` — so anime you loved have a stronger pull on your taste vector.
4. **Averages all weighted embeddings** into a single 768-dimensional **visual taste vector** representing your aesthetic fingerprint.

### Step 2 — Blending with Preference Text (Optional)

If you provide a `--preference` text (e.g., `"dark psychological thriller"`), the system:

1. Extracts **genre keywords** from the text using `preference_encoder.py` and injects matching anime directly into the candidate pool (genre injection).
2. Embeds the preference text using **CLIP's text encoder** into the same 768-d space.
3. **Blends** the visual taste vector `70%` with the text embedding `30%` to produce the final query vector.

### Step 3 — Semantic Plot Search (Optional)

If you provide a `--plot-preference` text (e.g., `"relaxing slice of life about school friends"`), the system:

1. Encodes your plot text using **`all-MiniLM-L6-v2`** (SentenceTransformers) into a 384-d plot vector.
2. Computes **cosine similarity** between your plot vector and 19,490+ pre-embedded anime synopses stored in `synopsis_embeddings.npy`.
3. The resulting per-anime **plot similarity score** is injected into the final ranking formula.

### Step 4 — Multi-Modal Cosine Similarity Search

The blended query vector is compared against all 30,000+ anime cover embeddings using **NumPy batched cosine similarity** to produce the top-N visual candidates efficiently.

### Step 5 — Multi-Dimensional Re-Ranking

Every visual candidate is scored by a **weighted sum of five components**:

| Component | Weight | Description |
|---|---|---|
| 🖼️ Visual Similarity | **60%** | CLIP cosine similarity of your taste vector to the candidate's cover embedding |
| 📖 Plot Similarity | **30%** | SentenceTransformer cosine similarity (only applied when `--plot-preference` is provided) |
| ⭐ MAL Score | **28%** | Community rating from MyAnimeList (normalized 0–1) |
| 👥 Popularity | **17%** | Number of MAL members (normalized 0–1) |
| 🎭 Genre Relevance | **25%** | Co-occurrence correlation score (0 if no genre filter or below threshold) |
| 📅 Era Proximity | **10%** | Gaussian score centered on preferred release year |

> **Note:** When `--plot-preference` is not provided, plot similarity weight is 0 and the visual weight retains its full 60% allocation.

### Step 6 — Post-Filtering

The top results are post-filtered to exclude any anime already in your input watchlist using fuzzy title matching (threshold: 78), re-ranked, and trimmed to your requested `--top-n` count.

---

## 🚀 Quick Demo

```bash
# Simple visual match from a CSV watchlist
python recommend.py --input Ani.csv

# Add a mood/aesthetic preference
python recommend.py --input Ani.csv --preference "dark psychological thriller"

# Combine visual taste + plot preference (DUAL-VECTOR MODE)
python recommend.py --input "Death Note, Code Geass" --plot-preference "a relaxing slice of life about school"

# Use EVERY flag at once
python recommend.py \
  --input Ani.csv \
  --preference "colorful and vibrant" \
  --plot-preference "relaxing slice of life anime about school" \
  --top-n 10 \
  --candidates 500 \
  --year 2018

# Web GUI (opens in browser at http://localhost:7860)
python gui.py
```

### Sample Output (Dual-Vector Mode)

```
╔═════╤════════════════════════╤═════════╤═══════════╤══════════════════════════════╤══════════╤══════════╗
║  #  │ Title                  │   MAL   │  Members  │ Genres                       │  Visual  │   Plot   ║
║     │                        │  Score  │           │                              │   Sim    │   Sim    ║
╟─────┼────────────────────────┼─────────┼───────────┼──────────────────────────────┼──────────┼──────────╢
║  1  │ Charlotte              │  7.76   │ 1,769,199 │ Drama, School, Super Power   │  0.858   │  0.381   ║
╟─────┼────────────────────────┼─────────┼───────────┼──────────────────────────────┼──────────┼──────────╢
║  2  │ Toradora!              │  8.04   │ 2,371,441 │ Drama, Romance, School       │  0.856   │  0.406   ║
╟─────┼────────────────────────┼─────────┼───────────┼──────────────────────────────┼──────────┼──────────╢
║  3  │ Gabriel DropOut        │  7.42   │   485,220 │ Comedy, CGDCT, School        │  0.782   │  0.392   ║
╚═════╧════════════════════════╧═════════╧═══════════╧══════════════════════════════╧══════════╧══════════╝
```

---

## 🔧 CLI Options Reference

```
python recommend.py --input <source> [options]
```

| Flag | Short | Type | Default | Description |
|---|---|---|---|---|
| `--input` | `-i` | str | *required* | CSV/Excel file path, or comma-separated anime title list |
| `--preference` | `-p` | str | None | Free-text aesthetic/mood preference (e.g. `"dark psychological"`) |
| `--plot-preference` | | str | None | Semantic plot preference to activate dual-vector mode (e.g. `"relaxing school slice of life"`) |
| `--top-n` | `-n` | int | 6 | Number of recommendations to return |
| `--candidates` | | int | auto | Number of visual candidates fetched before re-ranking (default auto-scales with input size) |
| `--year` | `-y` | int | None | Preferred release year. Overrides era keywords and watchlist inference |

---

## 🛠️ Setup

### 1. Clone the Repository
```bash
git clone https://github.com/ChaitanyaParate/Judging-Anime-By-Its-Cover.git
cd Judging-Anime-By-Its-Cover
```

### 2. Create & Activate Virtual Environment
```bash
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Download the CLIP Model (One-Time, ~1.2 GB)
```bash
python -c "
from transformers import CLIPModel, CLIPProcessor
model = CLIPModel.from_pretrained('openai/clip-vit-large-patch14')
processor = CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14')
model.save_pretrained('models/clip-vit-large-patch14')
processor.save_pretrained('models/clip-vit-large-patch14')
print('Done!')
"
```

The `all-MiniLM-L6-v2` SentenceTransformer model (~90 MB) is automatically downloaded from HuggingFace on first use of plot embeddings.

### 5. Download the Dataset

All large files are hosted on **Google Drive** — including precomputed embeddings so you can skip the long embedding steps:

📁 **[Google Drive — Anime Data & Embeddings](https://drive.google.com/drive/folders/1uK-QmsqDfnumBUYL23d8LFKXycOW-AWY?usp=sharing)**

| File | Size | Description |
|---|---|---|
| `anime_data.db` | ~30 MB | SQLite database — 30,071 anime with metadata, synopses, and provider tracking |
| `cover_embeddings.npy` | 88 MB | Precomputed CLIP 768-d cover embeddings |
| `synopsis_embeddings.npy` | ~28 MB | Precomputed SentenceTransformer 384-d synopsis embeddings |
| `covers.zip` | 2.5 GB | 30k+ anime cover images (JPEGs) |

**Using gdown (recommended):**
```bash
pip install gdown
gdown --folder https://drive.google.com/drive/folders/1uK-QmsqDfnumBUYL23d8LFKXycOW-AWY
unzip covers.zip -d covers/
```

**Manual download:**
1. Download all files from the Drive link above
2. Place `anime_data.db`, `cover_embeddings.npy`, and `synopsis_embeddings.npy` in the project root
3. Extract `covers.zip` → images should land in `covers/` in the project root

### 6. Run Your First Recommendation

```bash
# CLI
python recommend.py --input "Attack on Titan, Death Note" --preference "dark action"

# Web GUI
python gui.py
# → open http://localhost:7860
```

---

## 📁 Input Format

### CSV / Excel Watchlist

Your file should have a column named `anime`, `title`, `name`, or `show`. Optionally add a `Worth Level` column:

| No. | Anime | Ep. No. | Worth Level |
|-----|-------|---------|-------------|
| 1   | Death Note | 37 | High |
| 2   | Sword Art Online | 96 | Medium |
| 3   | Gamers! | 12 | Low |

**Worth Level weights:** `High = 1.5×` &nbsp;|&nbsp; `Medium = 1.0×` &nbsp;|&nbsp; `Low = 0.3×`

Titles are fuzzy-matched using `rapidfuzz.WRatio` so minor typos, alternate romanizations, and partial titles are handled gracefully.

### Terminal / Inline Input

```bash
python recommend.py --input "Naruto, Bleach, One Piece" --preference "long shonen epic"
```

---

## ⚙️ Scoring System — Deep Dive

### Visual Taste Vector Construction

The user's taste vector is a **weighted mean** of CLIP cover embeddings:

```
taste_vector = Σ(weight_i × embed_i) / Σ(weight_i)
```

Where `weight_i` comes from the Worth Level column. High-rated anime steer the query; Low-rated anime provide gentle directional input.

The query vector is then blended with the CLIP text embedding of your `--preference`:

```
query_vector = 0.70 × taste_vector + 0.30 × text_embed(preference)
```

### Final Scoring Formula

```
final_score = (W_SIM  × visual_sim)
            + (W_PLOT × plot_sim)       # only if --plot-preference provided
            + (W_SCORE × norm_score)
            + (W_POP  × norm_pop)
            + (W_GENRE × genre_score)
            + (W_ERA  × era_score)
```

Current weight values (tunable in `recommender.py`):

```python
W_SIM   = 0.60   # visual cover similarity
W_PLOT  = 0.30   # semantic plot similarity
W_SCORE = 0.28   # MAL community score (normalized)
W_POP   = 0.17   # MAL member count (normalized)
W_GENRE = 0.25   # genre co-occurrence relevance
W_ERA   = 0.10   # Gaussian era proximity
```

### Genre Co-Occurrence Relevance

Genre matching goes far beyond exact tag lookup. The system builds a **statistical co-occurrence correlation table** from all 30,000+ anime in the database at scrape time:

```
corr[(G, F)] = P(genre G | genre F)   # how often G appears when F is present
```

For each anime candidate:
1. For every requested genre, all anime genres contribute a soft correlation score
2. Scores are **normalized per anime** and aggregated using **geometric mean** across all requested genres — meaning the anime must score reasonably across *all* requested genres, not just one
3. Anime scoring below `0.13` are **hard-zeroed** (genre component = 0)

**Demographic genres** (Josei, Seinen, Shoujo, Shounen, Kids) use the **reversed** correlation direction to avoid inflation — e.g. asking "given this anime has Drama, how likely is it to be Josei?" rather than "what genres appear in Josei anime?"

**Genre injection** ensures niche genre anime (Josei, Racing, etc.) always enter the candidate pool even if they look visually different from the user's average taste.

### Era Proximity Scoring

The system infers a **preferred release year** and rewards candidates close to it using a Gaussian decay (sigma = 8 years):

```
era_score = exp( -( (candidate_year − preferred_year) / 8 )² )
```

| Distance from target | Score |
|---|---|
| ±0 years | 1.00 |
| ±8 years | 0.37 |
| ±16 years | 0.02 |

**Three ways to set the preferred year (highest priority first):**

1. **`--year` flag / GUI number input** — explicit manual override
   ```bash
   python recommend.py --input Ani.csv --preference "action" --year 1998
   ```
2. **Era keyword in preference text** — auto-detected from `--preference`
   | Keyword | Target year |
   |---|---|
   | `classic`, `old school`, `90s` | 1995 |
   | `retro` | 1990 |
   | `80s`, `vintage` | 1985–1988 |
   | `2000s`, `early 2000s` | 2003–2005 |
   | `new`, `recent`, `modern`, `latest` | current year |

3. **Inferred from your watchlist** — median release year of your watched anime (automatic fallback)

---

## 🖱️ Web GUI

A full browser interface is available via **Gradio**:

```bash
python gui.py
# → http://localhost:7860
```

**Features:**
- Paste anime titles directly or upload a `.csv` / `.xlsx` watchlist file
- Free-text aesthetic preference input with auto-detected genre display
- **Plot/Synopsis preference** text box for dual-vector semantic search
- Optional **preferred release year** number input
- Slider for number of recommendations (3–20)
- **Cover image gallery** output
- Markdown results table with Visual Sim + Plot Sim scores
- Quick-start example buttons

---

## 📂 Project Structure

```
Judging-Anime-By-Its-Cover/
├── recommend.py              ← CLI entrypoint: parses args, prints results table & cover grid
├── gui.py                    ← Gradio web GUI wrapping the same pipeline
├── recommender.py            ← Core engine: dual-vector scoring, genre correlation, re-ranking
├── input_parser.py           ← Fuzzy-matches user titles → MAL IDs via SQLite
├── preference_encoder.py     ← Maps free-text preference → genre tags + CLIP text embedding
│
├── embed_covers.py           ← One-time: precompute CLIP embeddings for all cover images
├── embed_synopsis.py         ← One-time: precompute SentenceTransformer synopsis embeddings
├── mal_scraper.py            ← Unified async scraper (Kitsu base + AniList→Jikan→Kitsu tiered enrichment)
│
├── anime_data.db             ← SQLite: 30,071 anime with provider-independent schema
├── cover_embeddings.npy      ← 768-d CLIP embeddings for all covers (88 MB)
├── synopsis_embeddings.npy   ← 384-d SentenceTransformer embeddings for 19,490+ synopses (28 MB)
├── embedding_index.json      ← Maps mal_id → row in cover_embeddings.npy (auto-generated)
├── synopsis_index.json       ← Maps mal_id → row in synopsis_embeddings.npy (auto-generated)
├── genre_correlation.json    ← Genre co-occurrence table (auto-generated on scrape)
│
├── covers/                   ← 30k+ local cover JPEGs named by mal_id (e.g. 1535.jpg)
├── results/                  ← Saved recommendation grid images (recommendations.jpg)
├── models/
│   └── clip-vit-large-patch14/  ← Local CLIP model weights
└── requirements.txt
```

### Key Database Schema (`anime_data.db`)

The database uses a **provider-independent schema** so it is not tied to any single metadata API:

| Column | Type | Description |
|---|---|---|
| `internal_id` | INTEGER PK | Auto-increment internal identifier |
| `mal_id` | INTEGER UNIQUE | MyAnimeList ID (used for cover image naming) |
| `anilist_id` | INTEGER | AniList ID (populated by tiered scraper) |
| `title` | TEXT | Original/romaji title |
| `title_english` | TEXT | English localized title |
| `title_japanese` | TEXT | Japanese title |
| `synopsis` | TEXT | Full plot summary |
| `genres` | TEXT | Comma-separated genre/theme/demographic tags |
| `episodes` | INTEGER | Episode count |
| `score` | REAL | MAL community score |
| `year` | INTEGER | Release year |
| `season` | TEXT | Release season (WINTER/SPRING/SUMMER/FALL) |
| `status` | TEXT | FINISHED / RELEASING / NOT_YET_RELEASED |
| `studio` | TEXT | Primary animation studio |
| `image_url` | TEXT | Remote cover image URL |
| `local_image_path` | TEXT | Local cover path (e.g. `covers/1535.jpg`) |
| `data_source` | TEXT | `anilist` / `jikan` / `kaggle_base` / `none` |

---

## 🗄️ Data Pipeline

The data pipeline is managed entirely by `mal_scraper.py`:

```bash
# Phase 1: Scrape base anime list from Kitsu API
python mal_scraper.py --scrape-base

# Phase 2: Enrich metadata via AniList → Jikan → Kitsu tiered fallback
python mal_scraper.py --enrich-metadata

# Phase 3: Download missing cover images (with Kitsu CDN fallback)
python mal_scraper.py --download-covers

# Run the entire pipeline from scratch
python mal_scraper.py --all

# Enrich metadata with a limit (for testing)
python mal_scraper.py --enrich-metadata --limit 100
```

### Tiered Metadata Enrichment Strategy

The `--enrich-metadata` phase implements a **tiered fallback pipeline** to maximize data coverage while handling upstream API instability:

```
For each anime with data_source = 'kaggle_base':
  ├── 1. Try AniList GraphQL (idMal cross-reference)
  │       └── If synopsis/genres found → save, mark data_source = 'anilist', done
  ├── 2. Try Jikan REST API 
  │       ├── 429 → exponential backoff, retry
  │       ├── 5xx → return None immediately (upstream outage)
  │       └── If synopsis found → save, mark data_source = 'jikan', done
  ├── 3. Try Kitsu REST API (mapping cross-reference)
  │       └── If synopsis found → save, mark data_source = 'kitsu', done
  └── 4. Mark data_source = 'none' (permanent failure, skip on future runs)
```

**Current database coverage:**

| data_source | Count | Description |
|---|---|---|
| `anilist` | ~19,477 | Full synopsis + rich metadata via AniList |
| `jikan` | ~13 | Fetched via Jikan during stable windows |
| `none` | ~8,047 | Obscure entries not indexed by AniList or Jikan |
| `kaggle_base` | ~2,534 | Pending enrichment |

After any data updates, regenerate the embeddings:

```bash
# Regenerate cover embeddings after new images are downloaded
python embed_covers.py

# Regenerate synopsis embeddings after new synopses are added
python embed_synopsis.py
```

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| **[CLIP (ViT-Large/14)](https://github.com/openai/CLIP)** | Visual + text embedding backbone (768-d) |
| **[all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)** | Semantic synopsis embedding (384-d, SentenceTransformers) |
| **[AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/)** | Primary metadata source (synopsis, studio, season) |
| **[Jikan API](https://jikan.moe)** | Fallback metadata source (unofficial MAL REST API) |
| **[Gradio](https://gradio.app)** | Web GUI framework |
| **NumPy** | Batched cosine similarity over 30k embeddings |
| **[rapidfuzz](https://github.com/maxbachmann/RapidFuzz)** | Fuzzy title matching for input parsing |
| **[rich](https://github.com/Textualize/rich)** | Terminal UI tables and progress bars |
| **aiohttp** | Async HTTP for the scraper pipeline |
| **SQLite** | Local anime metadata store |
| **PyTorch** | CUDA-accelerated embedding inference |

---

## 📊 Dataset

| | Details |
|---|---|
| Anime in DB | 30,071 |
| Anime with cover images | ~30,000 JPEGs |
| Anime with synopses | ~19,490 |
| Anime with plot embeddings | 19,490 (384-d vectors) |
| Cover embedding size | 88 MB (`cover_embeddings.npy`) |
| Synopsis embedding size | 28 MB (`synopsis_embeddings.npy`) |
| Database size | ~30 MB (`anime_data.db`) |
| Raw cover images | 2.5 GB (`covers.zip`) |

📁 **[Download from Google Drive](https://drive.google.com/drive/folders/1uK-QmsqDfnumBUYL23d8LFKXycOW-AWY?usp=sharing)**

> Data sourced from [MyAnimeList](https://myanimelist.net) via the [Jikan API](https://jikan.moe) and [AniList](https://anilist.co) GraphQL API.  
> This project is non-commercial and for educational/portfolio purposes only.

---

## 📄 License

MIT License — see [LICENSE](LICENSE)
