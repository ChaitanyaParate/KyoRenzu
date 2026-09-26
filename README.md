# 🎌 KyōRenzu (共レンズ) - Anime Discovery Platform

> *"Don't judge a book by its cover"* — but we absolutely will judge anime by theirs.

Welcome to **KyōRenzu (Resonance Lens)**, a next-generation **multimodal AI anime recommendation engine** and **full-stack streaming platform**. This project evolved from a machine-learning research tool into a full-fledged Netflix-style streaming application with native OS integration.

## ✨ Epic Feature Overview

### 1. 🖥️ The KyōRenzu Web Platform
- **High-Fidelity React UI**: A stunning, modern, responsive frontend built with React and Vite. Features a dark-mode glassmorphic aesthetic inspired by premium streaming services.
- **FastAPI Backend**: A lightning-fast Python API bridging the gap between the React frontend, the local SQLite database, and our heavy ML recommendation engines.
- **Dynamic OTA Self-Healing**: The app continuously syncs with the AniList GraphQL API. If it spots missing "Trending" or "Recently Updated" anime, it dynamically inserts the metadata and uses non-blocking background tasks to fetch the HD cover art. Your local dataset stays perfectly up to date forever!
- **Dynamic Hero Banners**: Automatically rotating featured anime banners with HD video playback and details integration.

### 2. 🍿 Native Video Streaming (`ani-cli` Integration)
- **Zero-Ad Streaming**: Watch any anime natively on your desktop! By integrating [ani-cli](https://github.com/pystardust/ani-cli), clicking "Play Now" securely launches the `mpv` video player directly on your host machine.
- **No Browser Overhead**: Streams bypass the browser entirely, piping direct HTTP video streams to your local GPU-accelerated video player.

### 3. 🧠 Multimodal AI Recommendation Engine
Our flagship AI engine can find anime that *looks like Death Note* but has *a relaxing slice-of-life plot*!
- **🖼️ Visual Cover Matching**: Uses **OpenAI CLIP (ViT-Large/14)** to embed 30,000+ anime cover images into 768-dimensional space. The system analyzes your watchlist and builds a "Visual Taste Vector".
- **📖 Semantic Plot Matching**: Uses **SentenceTransformer (`all-MiniLM-L6-v2`)** to embed 20,000+ synopses. You can type natural language plots (e.g., "space bounty hunters") to find semantic matches.
- **⚖️ Worth Level Weighting**: Anime you rated highly pull the recommendation vector closer to their aesthetic, while low-rated anime gently steer it away.
- **🎭 Genre Co-Occurrence Matrix**: A statistical correlation table built from 30,000 anime automatically soft-matches related genres (e.g., if you ask for Mecha, it knows to look for Sci-Fi).

### 4. 📚 Personal Library & Notifications
- **Watchlist Tracking**: Add anime to your library, update your watch status, and write personal reviews.
- **Power User Features**: 
  - **Quick +1**: Rapidly increment watched episodes directly from the library grid.
  - **Advanced Sorting**: Sort by Global Score, Personal Score, Progress, or Recently Updated.
  - **Layout Toggles**: Switch between the standard visual Grid View and a condensed List View for managing huge libraries.
- **Visual Statistics Dashboard**: An interactive, glassmorphic analytics modal powered by `recharts`. View your total "Days Wasted", your Top Genres Pie Chart, and a Bar Chart of your scoring distribution!
- **AniList Sync & Airing Notifications**: The backend runs an asynchronous background worker that polls the AniList GraphQL API for any anime you are currently "Watching". If a new episode airs, you get a native notification in the app's bell icon!

### 5. 🕷️ Tiered Data Scraping Pipeline
- A robust, multiprocessing data pipeline (`mal_scraper.py`) that builds a local 30,000+ anime database from scratch.
- **Tiered Fallback Enrichment**: Extracts metadata first from AniList (GraphQL), falls back to Jikan (MyAnimeList REST API), and finally Kitsu to guarantee 100% metadata coverage.

---

## 🚀 Getting Started

### 1. Run the AppImage (Linux)
KyoRenzu is packaged as a **lightweight OTA AppImage**. 
The application will automatically download all heavy datasets (the 30k+ SQLite DB, ML embeddings, and 2.5GB of covers) from Google Drive on your very first launch.

**[Download the AppImage from Google Drive here](https://drive.google.com/file/d/1-dy0lPvo-CVuTsfmgpyaIXXCQ4HDCb-x/view?usp=sharing)**

```bash
# Example if downloading from releases:
chmod +x KyoRenzu-1.0.0.AppImage
./KyoRenzu-1.0.0.AppImage
```

*(Note: The first launch will display an "Initial Setup" overlay while it fetches the 2.7GB of assets. These are cached permanently in `~/.local/share/KyoRenzu/` so subsequent launches are instant).*

### 2. Building from Source
If you want to run or package the project manually:

**Prerequisites:**
- Python 3.10+ and Node.js 18+
- [mpv](https://mpv.io/) (required for native video playback via `ani-cli`)
- `curl`, `grep`, `fzf` (standard Linux utils for `ani-cli`)

```bash
git clone https://github.com/ChaitanyaParate/KyoRenzu.git
cd KyoRenzu

# 1. Setup Python Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Setup React Frontend
cd web && npm install && cd ..

# 3. Build the OTA AppImage
npm run build
```

---

## 🎮 How to Use the App

### The Home Tab
- **Featured Banners**: Browse randomly selected popular/top-tier anime.
- **Trending & Recommendations**: Scroll through "Top Anime" and your personalized AI recommendations.
- **Random Anime / Shuffle**: Click the 🔀 shuffle icon in the top right header to instantly load a random anime from the database.

### The Search & Discover Tabs
- **Global Search**: Use the top-nav search bar to quickly find anime by name.
- **Deep Discovery**: Go to the Discover tab to use the **AI Engine**. 
  - Type a **Visual Vibe** (e.g., "dark neo-noir").
  - Type a **Plot Summary** (e.g., "kids trapped in a video game").
  - The system will blend your inputs into vectors, scan 30,000 anime, and instantly return the best matches!

### The Library & Notifications
- Go to the **Library Tab** to manage your watch status. You can export/import your library as CSV.
- Keep an eye on the **Bell Icon** (🔔) in the header. The backend automatically tracks airing schedules for your "Watching" list and alerts you when a new episode drops!

### Playing an Anime
- Click an anime card to open its details modal.
- Click **"Play Now"** or an episode number in the episode grid.
- Watch your terminal! `api.py` will invoke the local `ani-cli` submodule, search the web, bypass captchas, and seamlessly launch the stream in your native `mpv` player in full 1080p without ads!

### Standalone ML Recommendation GUI
If you prefer to focus solely on the AI recommendation engine without the full streaming platform, you can use the built-in Gradio interface:
```bash
python gui.py
```
Then open `http://localhost:7860` in your browser. This lets you input your watchlist (via text or CSV) and get multimodal recommendations instantly.

---

## 🛠️ API & Architecture

### Backend (`api.py`)
- `/api/library`: CRUD operations for your local user library.
- `/api/recommendations/{mal_id}`: Triggers the `recommender.py` engine to perform a rapid cosine-similarity search against `cover_embeddings.npy` and `synopsis_embeddings.npy`.
- `/api/play`: Constructs the `ani-cli` subprocess command, handling streaming logic natively.
- `/api/random`: Rapid SQL `ORDER BY RANDOM()` endpoint.
- `/api/notifications`: Returns the latest unread airing updates synced via AniList GraphQL.

### Scraping Engine (`mal_scraper.py`)
Want to rebuild the database yourself?
```bash
# Scrape everything from scratch (takes ~6-8 hours)
python mal_scraper.py --all
```
This spawns an async `multiprocessing` pipeline that manages rate limits, resolves mapping IDs between MAL/AniList/Kitsu, and downloads cover art concurrently.

---

## 📂 Project Structure

```
KyoRenzu/
├── main.js & package.json    ← Electron desktop application wrapper
├── api.py                    ← FastAPI backend & playback controller
├── gui.py                    ← Standalone Gradio Web GUI for the ML recommender
├── web/                      ← React/Vite frontend
├── mal_scraper.py            ← Async metadata enricher
├── recommender.py            ← ML similarity & ranking logic
├── embed_*.py                ← Scripts for generating ML embeddings (covers, synopsis, audio)
├── anime_data.db             ← 30k+ local anime database
├── covers/                   ← Downloaded JPEG cover art
├── ani-cli-master/           ← INCLUDED SUBMODULE: Native bash tool for anime streaming
└── auto_selector.py          ← Custom headless menu handler for ani-cli automation
```

---

## 🙏 Acknowledgments

This project relies heavily on the incredible work of the open-source community:
- **[ani-cli](https://github.com/pystardust/ani-cli)** (`ani-cli-master/`): Included locally as the backbone for our zero-ad, native video streaming architecture. Massive thanks to the `ani-cli` maintainers for their fantastic scraping logic!
- **OpenAI & HuggingFace**: For the CLIP and `all-MiniLM-L6-v2` embedding models.
- **MyAnimeList, AniList, & Kitsu**: For their robust metadata APIs.

---

## 📄 License
MIT License — see [LICENSE](LICENSE).

This project is for educational/portfolio purposes only. Anime metadata is provided by MyAnimeList, AniList, and Kitsu. Video streams are resolved locally via `ani-cli` logic.
