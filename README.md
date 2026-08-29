# 🎌 Judging Anime By Its Cover (Anikoto Platform)

> *"Don't judge a book by its cover"* — but we absolutely will judge anime by theirs.

Welcome to **Judging Anime By Its Cover**, a next-generation **multimodal AI anime recommendation engine** and **full-stack streaming platform**. This project evolved from a machine-learning research tool into a full-fledged Netflix-style streaming application (Anikoto) with native OS integration.

## ✨ Epic Feature Overview

### 1. 🖥️ The Anikoto Web Platform
- **High-Fidelity React UI**: A stunning, modern, responsive frontend built with React and Vite. Features a dark-mode glassmorphic aesthetic inspired by premium streaming services.
- **FastAPI Backend**: A lightning-fast Python API bridging the gap between the React frontend, the local SQLite database, and our heavy ML recommendation engines.
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

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (for Vite frontend)
- [mpv](https://mpv.io/) (required for native video playback via `ani-cli`)
- `curl`, `grep`, `fzf` (standard Linux/macOS utils for `ani-cli`)

### 2. Clone the Repository
```bash
git clone https://github.com/ChaitanyaParate/Judging-Anime-By-Its-Cover.git
cd Judging-Anime-By-Its-Cover
```

### 3. Backend Setup
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Frontend Setup
```bash
cd web
npm install
cd ..
```

### 5. Download the Database & Models
All large files (embeddings, the 30k+ SQLite DB, and covers) are hosted on Google Drive to save you hours of scraping and embedding.
- **`anime_data.db`**: Place in the project root.
- **`cover_embeddings.npy`** / **`synopsis_embeddings.npy`**: Place in the project root.
- **`covers/` directory**: Extract the 30,000+ local JPEG covers into a folder named `covers/` in the project root.

*(See the [Drive Link](https://drive.google.com/drive/folders/1uK-QmsqDfnumBUYL23d8LFKXycOW-AWY?usp=sharing) for direct downloads).*

### 6. Run the Full Stack Application!
```bash
# Run the startup script which launches FastAPI and Vite concurrently
./start.sh --reload
```
The application will be available at **`http://localhost:5173`**.

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
Judging-Anime-By-Its-Cover/
├── api.py                    ← FastAPI backend & playback controller
├── web/                      ← React/Vite (Anikoto) frontend
├── mal_scraper.py            ← Async metadata enricher
├── recommender.py            ← ML similarity & ranking logic
├── anime_data.db             ← 30k+ local anime database
├── covers/                   ← Downloaded JPEG cover art
└── ani-cli-master/           ← INCLUDED SUBMODULE: Native bash tool for anime streaming
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
