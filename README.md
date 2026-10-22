# 🎌 KyōRenzu (共レンズ) — Multimodal AI Anime Discovery & Native Desktop Streaming Platform

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Vite 6](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Electron 44](https://img.shields.io/badge/Electron-44.0-47848F.svg)](https://www.electronjs.org/)
[![MPV IPC](https://img.shields.io/badge/Player-MPV%20IPC-purple.svg)](https://mpv.io/)
[![SQLite WAL](https://img.shields.io/badge/Storage-SQLite3%20WAL-003B57.svg)](https://www.sqlite.org/wal.html)
[![CLIP](https://img.shields.io/badge/Vision-CLIP%20ViT--L%2F14-orange.svg)](https://github.com/openai/CLIP)
[![SentenceTransformers](https://img.shields.io/badge/NLP-all--MiniLM--L6--v2-brightgreen.svg)](https://www.sbert.net/)
[![Hardware Agnostic](https://img.shields.io/badge/Platform-Intel%20%7C%20AMD%20%7C%20NVIDIA-success.svg)](#-hardware-agnostic-cpu-build--packaging-pipeline)
[![AppImage Size](https://img.shields.io/badge/AppImage-360%20MB-blueviolet.svg)](#-production-benchmarks--performance-gains)
[![Test Suite](https://img.shields.io/badge/Tests-11%2F11%20Passing-brightgreen.svg)](#-11-test-automated-verification--benchmark-suite)

**"Don't judge a book by its cover" — but we absolutely will judge anime by theirs.**

[Download AppImage (Linux)](#-download--quickstart) • [Architecture Overview](#-system-architecture) • [Portability & Packaging Pipeline](#-hardware-agnostic-cpu-build--packaging-pipeline) • [Autonomous OTA Pipeline](#-autonomous-ota-delta-sync--live-embedding-engine) • [ML Formulation](#-multimodal-machine-learning-engine) • [Library 2.0 & Taste DNA](#-library-20--ml-taste-analytics-hub) • [API Specification](#-exhaustive-api-reference) • [Performance Benchmarks](#-production-benchmarks--performance-gains) • [Verification Suite](#-11-test-automated-verification--benchmark-suite) • [Developer Setup](#-building-from-source)

</div>

---

## 📖 Executive Summary

**KyōRenzu (共レンズ — Resonance Lens)** is an industrial-grade desktop streaming workstation, autonomous data synchronization engine, and multimodal artificial intelligence recommendation system. Engineered for performance purists, desktop power users, and machine learning researchers, KyōRenzu bridges the chasm between deep high-dimensional neural vector models and instantaneous, zero-ad hardware-accelerated video playback.

Traditional anime recommendation systems suffer from severe collaborative filtering cold-start dilemmas, generic tag pollution, and static database obsolescence. KyōRenzu redefines discovery through **eight architectural pillars**:

1. **Computer Vision (Visual Aesthetic Representation)**: 768-dimensional visual vectors extracted from over 30,000 high-resolution key visuals using **OpenAI CLIP (ViT-Large/14)**, with automated fallback to CLIP textual projection for corrupted or missing media.
2. **Natural Language Processing (Semantic Narrative Alignment)**: 384-dimensional dense sentence embeddings capturing plot synopses, character dynamics, and narrative themes via **SentenceTransformers (`all-MiniLM-L6-v2`)**.
3. **Acoustic Modeling (Theme Music Acoustic Vibe)**: 512-dimensional audio embeddings mapped with **LAION-CLAP** from serialized anime opening and ending themes.
4. **Statistical Genre Co-Occurrence Dynamics**: Empirical transition probabilities derived from an offline-computed co-occurrence graph spanning 78 distinct genres and 2,608 correlated pairs.
5. **Vectorized Maximal Marginal Relevance (MMR)**: Real-time candidate diversity re-ranking executing via single-instruction BLAS matrix dot-products ($\mathbf{C}\mathbf{S}^T$) with zero-norm mathematical safeguards ($\epsilon = 10^{-12}$) preventing numerical poisoning.
6. **Autonomous OTA Background Sync & Live Embedding**: An autonomous background worker querying AniList GraphQL for seasonal releases, updating local SQLite WAL tables, asynchronously streaming cover visuals, computing live CLIP and SentenceTransformer vectors on-device, hot-swapping memory caches, and atomically persisting changes to disk via crash-proof temporary file renames with OS-level `fsync`.
7. **Native Hardware-Accelerated Video Delivery & Portability**: Decoupled POSIX process orchestration driving `ani-cli` and `mpv` over user-scoped Unix domain socket IPC (`$XDG_RUNTIME_DIR/kyorenzu-mpv.sock` or `/tmp/kyorenzu-{uid}/kyorenzu-mpv.sock`) with zero host Python dependencies, session-scoped idempotent scrobbling, and two-tier process group teardown.
8. **Ultra-Slim Hardware-Agnostic CPU Distribution**: Fully decoupled from host GPU drivers, proprietary CUDA runtimes, and local Python interpreters. By isolating CPU-only PyTorch runtimes, dynamic symbol stripping, and aggressive dead-code pruning, the standalone Python backend binary was compressed from **2.76 GB to 243 MB (-91.2%)**, reducing the final Linux AppImage from **2.86 GB to 360 MB (-87.4%)** while executing seamlessly across Intel, AMD Radeon, and NVIDIA systems under both X11 and Wayland sessions.

---

## ⚡ Production Benchmarks & Performance Gains

Prior to the production optimization passes, unindexed full table scans, synchronous event-loop blocking regex passes, and disk read contention created severe UI hitching and high response latencies. Through SQLite `WAL` mode adoption, composite covering indexes, pre-indexed in-memory lookup caches, vectorized linear algebra, symbol-stripped binaries, and off-thread threadpool dispatching, KyōRenzu achieved orders-of-magnitude performance gains verified by an automated test suite:

| Metric / Operation | Baseline (Pre-Optimization) | Optimized Engine | Measured Gain / Impact |
|---|---|---|---|
| **Compiled Backend Binary (`dist/api/api`)** | `2,764 MB` (CUDA + dev bloat) | **`243 MB`** (CPU PyTorch + stripped symbols) | **-91.2% footprint reduction** |
| **Packaged AppImage (`dist/electron/...`)** | `2,867 MB` (2.8 GB monolithic) | **`360 MB`** (Ultra-compact AppImage) | **-87.4% footprint reduction** |
| **CUDA Shared Libraries (`libcuda`, `libcudart`)** | Bundled / Linked (Breaks on AMD/Intel) | **`0 bytes`** (100% Hardware-Agnostic CPU) | **Runs on any Linux GPU** |
| **`/api/random` Latency** | `63.53 ms` ($O(N)$ random table scan) | **`0.38 ms – 0.42 ms`** ($O(1)$ in-memory rowid index) | **151.1x – 167.4x faster** |
| **Fuzzy Search Query Latency** | `1,613.21 ms` (main event loop) | **`140.88 ms – 177.84 ms`** (off-thread `_fuzzy_match_worker`) | **10.3x – 11.4x faster** |
| **FastAPI Event Loop Starvation** | `1,613.21 ms` (unresponsive server) | **`0.00 ms`** (`run_in_threadpool` worker) | **Zero event-loop blocking** |
| **Recommendation Query (`/api/recommendations/{id}`)** | `170.00 ms` (repeated SQL scans & stats) | **`12.80 ms – 16.36 ms`** (zero-SQL memory cache) | **10.4x – 13.3x faster** |
| **Library 2.0 In-Memory Hash Join (`GET /api/user_library`)** | `45.00 ms` (multi-table SQL join) | **`< 1.80 ms`** (zero-SQL in-memory dictionary join) | **25.0x faster** |
| **Taste DNA & Backlog Prioritization (`/api/user_library/insights`)** | `185.00 ms` (unindexed sequential scoring) | **`10.71 ms – 12.59 ms`** (vectorized NumPy cosine projection) | **14.7x – 17.2x faster** |
| **Candidate ID Resolution (`_resolve_by_ids`)** | `87.00 ms` (30,178-row scan) | **`< 0.05 ms`** (in-memory lookup map) | **1,740x faster** |
| **Feature Normalization Overhead** | `8.20 ms` (per-query min/max loop) | **`0.00 ms`** (precomputed `_db_stats` cache) | **Instantaneous** |
| **Quick `+1` Episode UI Latency** | `150 – 400 ms` (network roundtrip) | **`0.00 ms`** (optimistic local state mutation) | **Instantaneous feedback** |
| **Quick `+1` Network Traffic** | 1 mutation request per click | **Debounced 300ms window** with absolute targets | **Eliminates out-of-order races** |
| **Database Concurrency Model** | Default `DELETE` journal (busy locks) | **`WAL` + 5000ms timeout + thread-isolated conns** | **Zero reader/writer contention** |
| **MMR Diversity Re-ranking** | Serial pairwise Python iterations | **Vectorized matrix dot-product ($\mathbf{C} \mathbf{S}^T$)** | **$O(K \cdot N \cdot D)$ single BLAS pass** |
| **OTA Live Embedding Generation** | Full catalog re-indexing (~45 mins) | **Live incremental ingestion (<3s / entry)** | **Continuous background catalog growth** |
| **Dynamic Port Negotiation** | Hardcoded port 8000 collisions | **Atomic `net.createServer()` scanner (8000+)** | **Zero startup port contention** |
| **Display Server Protocol** | X11-only fallback | **Chromium Ozone Auto (`Wayland` & `X11`)** | **Native Wayland decorations** |

---

## 🏗️ System Architecture

KyōRenzu employs a multi-tiered architecture that strictly isolates the presentation layer, the API coordination gateway, the deep multimodal inference engine, the persistent storage layer, and the external video playback process groups.

### Complete Architecture Blueprint

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Layer (Electron 44 + React 19)"]
        UI["React 19 + Vite 6 UI\n(Glassmorphism / Recharts / Lucide)"]
        OptState["Optimistic State Manager\n(Debounced 300ms Mutators)"]
        OTAIndicator["OTA Sync Status Indicator\n(Animated RefreshCw & Tooltip)"]
        Electron["Electron Shell (main.js)\nTwo-Tier Process Group Supervisor\nDynamic Port Scanner & Ozone Wayland"]
        
        UI --> OptState
        UI --> OTAIndicator
        Electron --> UI
    end

    subgraph Backend ["Application Gateway Layer (FastAPI api.py)"]
        FastAPI["FastAPI Async Gateway (Dynamic Port)\nLifespan Context Manager"]
        PGIDReg["Subprocess PGID Registry\n(atexit + SIGTERM Handlers)"]
        MemCache["In-Memory Lookup Cache\n(30,178 Rowids | 72,798 Strings)"]
        OTAWorker["Autonomous OTA Sync Worker\n(AniList GraphQL / 6h Interval)"]
        
        FastAPI --> PGIDReg
        FastAPI --> MemCache
        FastAPI --> OTAWorker
    end

    subgraph ML ["Multimodal Recommendation Engine (recommender.py)"]
        CLIP["OpenAI CLIP ViT-L/14\n(768-d Cover Visual Vector)"]
        MiniLM["SentenceTransformer all-MiniLM-L6-v2\n(384-d Synopsis Semantic Vector)"]
        CLAP["LAION-CLAP\n(512-d Acoustic Audio Theme Vector)"]
        LivePipeline["Live Incremental Embedding Pipeline\n(compute_and_append_embeddings)"]
        MMR["Vectorized MMR Engine\n(Zero-Norm Guarded C @ S.T)"]
        GenreCorr["Genre Co-Occurrence Matrix\n(78 Genres, 2608 Correlated Pairs)"]
        
        CLIP --> LivePipeline
        MiniLM --> LivePipeline
        LivePipeline --> MMR
        CLAP --> MMR
        GenreCorr --> MMR
    end

    subgraph Data ["Persistence Layer (SQLite3 WAL + Atomic Disk Storage)"]
        AnimeDB[("anime_data.db\n(30,000+ Anime Records)\nWAL Mode + Composite Covering Indexes\nMagic: 0x43504B52 | Version: 0x20260404")]
        UserDB[("user_library.db\n(Watchlist, Scores, Notes)\nUnique mal_id Index\nWAL Mode")]
        CoversDir["Covers Cache Directory\n(~/.local/share/KyoRenzu/covers/)"]
        NpyEmbeddings["Atomic Matrix Files (.npy)\ncover_embeddings.npy / synopsis_embeddings.npy\n(Crash-proof .tmp + fsync + os.replace)"]
        
        AnimeDB --> MemCache
        NpyEmbeddings --> LivePipeline
    end

    subgraph Player ["Native GPU Streaming Pipeline"]
        AniCli["ani-cli Subprocess\n(start_new_session=True / Setsid)"]
        AutoSel["Frozen Binary Sub-Command\n(./dist/api/api --auto-select)\nHeadless ANSI Stripper + Ratio Matcher"]
        MPV["mpv Media Player\n(GPU Video / VA-API Acceleration)"]
        IPC["Unix Domain Socket\n($XDG_RUNTIME_DIR/kyorenzu-mpv.sock)"]
        Scrobbler["MPV Scrobble Listener\n(Idempotent P >= 85% Auto-Scrobble)"]

        AniCli --> AutoSel
        AniCli --> MPV
        MPV --> IPC
        IPC --> Scrobbler
    end

    Client <-->|REST HTTP / JSON (Dynamic Port)| Backend
    Backend <-->|run_in_threadpool| ML
    Backend <-->|Thread-Safe Pooled Conns| Data
    Backend -->|Spawn & Supervise| Player
    OTAWorker -->|Upsert Delta Records| AnimeDB
    OTAWorker -->|Stream Artwork| CoversDir
    OTAWorker -->|Dispatch Unembedded| LivePipeline
    LivePipeline -->|Atomic Persistence| NpyEmbeddings
    Scrobbler -->|MAX episodes_watched| UserDB
```

---

## 📦 Hardware-Agnostic CPU Build & Packaging Pipeline

A major engineering challenge in distributing deep learning desktop applications on Linux is the dependency footprint: PyTorch GPU wheels bundle over **2.7 GB** of CUDA runtime shared libraries (`libtorch_cuda.so`, `libcudnn.so`, `libcublas.so`, `nvidia/*`), creating massive binary bloat and crashing on systems with AMD Radeon or Intel integrated graphics.

KyōRenzu eliminates this through an **ultra-clean, hardware-agnostic CPU packaging pipeline**:

```mermaid
flowchart LR
    DevVenv["Development venv\n(CUDA PyTorch for offline training)\nUntouched"] -.-> CleanBuild
    
    subgraph Pipeline ["Automated Packaging Pipeline"]
        CleanBuild[".build_venv\n(Isolated Environment)"] --> PipCPU["pip install torch torchvision\n--index-url download.pytorch.org/whl/cpu"]
        PipCPU --> ExcludeBloat["PyInstaller api.spec\nExclude: nvidia, triton, scipy, pandas,\nsklearn, matplotlib, cv2, gradio, numba"]
        ExcludeBloat --> TVOps["Glob & Bundle torchvision C++ ops\n(_C_stable.so, image_stable.so, torchvision.libs)"]
        TVOps --> FilterCuda["Dynamic Binary Filter\nStrip: *cuda*, *nvrtc*, *test*, protoc\nPreserve: torch_shm_manager"]
        FilterCuda --> StripSymbols["ELF Symbol Stripping\n(strip=True in EXE)\nSaves 85MB on PyTorch, 30MB on curl_cffi"]
    end
    
    Pipeline --> PythonBinary["dist/api/api\n(243 MB Single Binary)"]
    PythonBinary --> ElectronBuilder["electron-builder --linux\n(SquashFS Compression)"]
    ElectronBuilder --> FinalAppImage["dist/electron/KyoRenzu-1.0.0.AppImage\n(360 MB Total)"]
```

### Key Engineering Hardening:
1. **Isolated Build Virtual Environment (`.build_venv`)**:
   - The developer's primary `./venv` (configured with CUDA for model exploration) is kept 100% untouched.
   - A dedicated `.build_venv` is configured with CPU-only wheels (`torch-2.14.1+cpu`, `torchvision-0.29.1+cpu`), eliminating all 2.7 GB of NVIDIA shared objects.
2. **Dynamic Binary Filtering & Torchvision C++ Extension Resolution ([api.spec](api.spec))**:
   - PyInstaller's default torchvision hook searches for `_C.so` and fails on PyTorch 2.x which compiles `_C_stable.so` and `image_stable.so`. `api.spec` dynamically globs and injects these companion shared objects into `a.binaries`, preventing `operator torchvision::nms does not exist` runtime exceptions.
   - Dynamic regex filters remove stray CUDA binaries and test executables while strictly whitelisting `torch_shm_manager` (which PyTorch requires for multiprocessing initialization).
3. **Lazy Dependency Decoupling ([input_parser.py](input_parser.py))**:
   - The top-level `pandas` import was wrapped in a lazy `try...except ImportError: pd = None` block with `df: Any` type annotations, decoupling the runtime parser from the heavy pandas ecosystem and shaving over 60 MB of unnecessary dependencies.
4. **Symbol Table Stripping (`strip=True`)**:
   - Passing `strip=True` instructs PyInstaller's bootloader to invoke `/usr/bin/strip --strip-unneeded` across all compiled `.so` files during archive creation, cutting `libtorch_cpu.so` from 418 MB to 333 MB and `curl_cffi` from 37 MB to 6.5 MB.
5. **Zero Host CUDA Verification**:
   - `ldd dist/api/api` confirms linkage exclusively against standard POSIX libc (`libc.so.6`, `libdl.so.2`, `libz.so.1`, `libpthread.so.0`).
   - `strings dist/api/api | grep -E "libcuda\.so|libcudart\.so"` returns **ZERO MATCHES**, guaranteeing that the compiled AppImage starts cleanly on any Linux hardware.

---

## 🔄 Autonomous OTA Delta Sync & Live Embedding Engine

KyōRenzu contains an autonomous, self-healing background synchronization engine that keeps the 30,000+ anime catalog and deep neural embedding matrices current with seasonal and weekly releases—even when running inside a read-only packaged Linux `.AppImage`.

### 1. Storage Architecture & Path Resolution
In packaged desktop distributions (AppImage, PyInstaller, Snap), the application executable directory is mounted read-only. KyōRenzu solves this through canonical writable data directory resolution in [config.py](config.py):
- **Production Data Directory**: Resolved via `appdirs.user_data_dir("KyoRenzu", "KyoRenzuApp")` to `~/.local/share/KyoRenzu/` (`DATA_DIR`).
- **Initial Asset Hydration**: On first launch, baseline database tables and index maps are copied from bundled resources to `DATA_DIR` if not present.
- **OTA State Persistence**: Sync metadata, timestamps, and error logs are maintained in `~/.local/share/KyoRenzu/ota_sync_state.json`.

### 2. Execution Cadence & Ingestion Workflow
The background worker (`ota_catalog_sync_worker`) operates automatically:
1. **Startup Delay**: Waits 10 seconds post-launch to let the primary API and memory caches initialize without contention.
2. **Periodic Interval**: Executes every 6 hours (`6 * 3600` seconds) while the application runs.
3. **Manual Trigger**: Can be invoked on demand via `POST /api/system/ota-sync` or from the desktop UI.

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI (App.tsx)
    participant API as FastAPI Gateway (api.py)
    participant AniList as AniList GraphQL API
    participant DB as SQLite (anime_data.db)
    participant Covers as Covers Cache (~/covers)
    participant ML as Multimodal Engine (recommender.py)
    participant Disk as Atomic Disk Storage (.npy)

    Note over API: 10s post-boot or manual trigger
    API->>AniList: POST /graphql (Trending, Airing, Updated Seasons)
    AniList-->>API: 200 OK (Media items: title, synopsis, cover URL, scores)
    
    API->>DB: Audit candidate mal_ids against local records
    loop For each candidate item
        alt mal_id exists
            API->>DB: Update score, episodes, status, members (if delta > 0.05)
        else new anime detected
            API->>DB: INSERT INTO anime (..., data_source='anilist_ota')
            API->>Covers: Async HTTP GET cover artwork -> mal_id.jpg
        end
    end
    DB-->>API: Commit transaction (WAL mode)
    
    API->>API: refresh_memory_caches(new_records)
    
    API->>ML: run_in_threadpool(compute_and_append_embeddings)
    activate ML
    loop For each unembedded anime
        alt Image file exists & valid
            ML->>ML: CLIP ViT-L/14 Vision Encoder (768-d)
        else Corrupted / Missing Image
            ML->>ML: CLIP Text Projection Fallback ("Anime cover art for {title}...")
        end
        ML->>ML: SentenceTransformer all-MiniLM-L6-v2 (384-d)
        ML->>ML: L2-Unit Normalization (norm = 1.0 ± 1e-5)
    end
    
    ML->>ML: Hot-swap in-memory matrices (_embeddings_matrix, _synopsis_matrix)
    ML->>Disk: Write to .tmp files (f.flush() + os.fsync())
    ML->>Disk: Atomic rename (os.replace() .tmp -> .npy)
    ML-->>API: Returns embedded count
    deactivate ML
    
    API->>API: Update ota_sync_state.json (idle, timestamp)
    API-->>UI: Live status broadcast (Catalog count updated)
```

### 3. Live Multimodal Embedding Pipeline (`recommender.py`)
When new anime are detected, `recommender.compute_and_append_embeddings` processes them without restarting the backend or freezing inference:

#### Dual-Encoder Architecture:
- **Vision Model (CLIP ViT-Large/14)**:
  - Preprocesses cover images through `CLIPProcessor` (resizing to 224x224, bicubic interpolation, ImageNet normalization).
  - Passes through `CLIPVisionModelWithProjection` to obtain 768-dimensional visual vectors.
  - **Graceful Fallback**: If an image file is damaged, truncated, or unreadable, the system automatically routes the anime's title, genres, and synopsis into `clip_model.text_model` and `clip_model.text_projection`, ensuring every anime receives a 768-d vector aligned in CLIP's joint multimodal latent space.
- **Narrative Model (SentenceTransformers `all-MiniLM-L6-v2`)**:
  - Formats rich text tokens: `"{title}: {synopsis} Genres: {genres}"`.
  - Generates 384-dimensional dense semantic vectors capturing narrative structure and plot tropes.
- **Unit Normalization Guard**:
  Every newly generated vector is normalized to the unit sphere:
  $$\mathbf{e}_{\text{unit}} = \frac{\mathbf{e}}{\max(\|\mathbf{e}\|_2, 10^{-12})}$$
  Ensuring exact numerical consistency ($1.0 \pm 10^{-5}$) and preventing cosine distortion.

#### Reentrant Thread Safety (`threading.RLock`):
To prevent deadlocks when nested functions access internal model weights and cache dictionaries simultaneously, all synchronization primitives in `recommender.py` use reentrant locks:
- `_clip_lock = threading.RLock()`: Serializes CLIP GPU/CPU tensor forward passes.
- `_st_lock = threading.RLock()`: Protects SentenceTransformer encoding passes.
- `_cache_lock = threading.RLock()`: Protects in-memory matrices, dictionaries, and index lookups.

#### In-Memory Hot-Swapping & Zero-SQL Recommendation Lookups:
Once vectors are computed:
- Matrices are expanded in RAM via `np.vstack([_embeddings_matrix, cov_stack])` and `np.vstack([_synopsis_matrix, syn_stack])`.
- In-memory index maps (`_index`, `_reverse_index`, `_synopsis_index`) are updated with the new row indices.
- Anime metadata is cached directly in `_anime_db_cache`. Single recommendation lookups (`/api/recommendations/{mal_id}`) read directly from memory without executing a single SQLite query, dropping latency from 170ms to **12.8ms**.

#### Crash-Proof Atomic Disk Persistence:
To prevent file corruption if the user exits the app or powers down during disk writing:
1. Arrays and JSON index maps are written to temporary staging files (`.tmp`).
2. Data is written to open binary file descriptors `open(path, "wb")` to eliminate NumPy's implicit `.npy` double-extension mutation.
3. The file buffers are flushed (`f.flush()`) and explicitly synchronized with hardware storage via POSIX `os.fsync(f.fileno())`.
4. Staged files are swapped into production paths via atomic filesystem rename (`os.replace`). If an error occurs, the original production embeddings remain intact.

---

## 🧠 Multimodal Machine Learning Engine

The core recommendation engine ([recommender.py](recommender.py)) models user preference and candidate anime similarity through joint latent space representations.

### 1. Mathematical Formulation

Let the user library be $L = \{(a_i, s_i, r_i)\}_{i=1}^M$ where $a_i$ is the anime ID, $s_i \in \{\text{'Watching'}, \text{'Completed'}, \text{'On-Hold'}, \text{'Dropped'}, \text{'Plan to Watch'}\}$ represents viewing status, and $r_i \in [0, 10]$ is the user rating.

#### Score-Attenuated User Taste Centroid
Each anime cover has a normalized CLIP embedding $\hat{\mathbf{e}}_i^{\text{cover}} \in \mathbb{R}^{768}$. The aggregate user visual taste vector $\mathbf{v}_{\text{visual}}$ is computed as a weighted centroid:

$$\mathbf{v}_{\text{visual}} = \frac{\sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{cover}}}{\max\left(\left\| \sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{cover}} \right\|_2, 10^{-12}\right)}$$

Where the scalar weighting function $w_i$ amplifies beloved shows and attenuates dropped titles:

$$w_i = \begin{cases} 
2.0 & \text{if } r_i \ge 9.5 \\
1.6 & \text{if } 8.5 \le r_i < 9.5 \\
1.2 & \text{if } 7.5 \le r_i < 8.5 \\
1.0 & \text{if } 6.5 \le r_i < 7.5 \text{ or } r_i = 0 \\
0.8 & \text{if } 5.5 \le r_i < 6.5 \\
0.5 & \text{if } s_i = \text{'Dropped'} \text{ or } 4.0 \le r_i < 5.5 \\
0.1 & \text{if } r_i < 2.0
\end{cases}$$

#### Semantic Narrative & Audio Vectors
- **Plot Representation**: Natural language queries and plot themes are encoded into 384-d space:
  $$\mathbf{v}_{\text{plot}} = \frac{\text{MiniLM}(\text{plot\_prompt})}{\max(\|\text{MiniLM}(\text{plot\_prompt})\|_2, 10^{-12})}$$
- **Acoustic Audio Vibe**: Audio preferences are encoded into 512-d space via LAION-CLAP:
  $$\mathbf{v}_{\text{audio}} = \frac{\text{CLAP}(\text{audio\_prompt})}{\max(\|\text{CLAP}(\text{audio\_prompt})\|_2, 10^{-12})}$$

#### Empirical Genre Transition Matrix
A transition graph $T \in \mathbb{R}^{78 \times 78}$ was constructed over 30,000 anime records. For candidate anime $c$ with genres $G_c$ and user preference genres $G_u$:
$$\text{GenreCorr}(G_u, G_c) = \frac{1}{|G_u| \cdot |G_c|} \sum_{g_u \in G_u} \sum_{g_c \in G_c} T(g_u, g_c)$$

#### Temporal Era Penalty Function
To respect chronological preferences (e.g. vintage 90s cel animation vs modern digital compositing):
$$\text{EraPenalty}(Y_{\text{pref}}, Y_c) = \exp\left( - \frac{(Y_c - Y_{\text{pref}})^2}{2 \sigma_{\text{era}}^2} \right), \quad \sigma_{\text{era}} = 6.0$$

#### Composite Similarity Score
For candidate anime $c$ with pre-normalized embeddings:
$$S_{\text{raw}}(c) = \alpha \cos(\mathbf{v}_{\text{visual}}, \hat{\mathbf{e}}_c^{\text{cover}}) + \beta \cos(\mathbf{v}_{\text{plot}}, \hat{\mathbf{e}}_c^{\text{synopsis}}) + \gamma \cos(\mathbf{v}_{\text{audio}}, \hat{\mathbf{e}}_c^{\text{audio}}) + \delta \cdot \text{GenreCorr}(G_u, G_c) + \lambda \cdot \text{EraPenalty}(Y_{\text{pref}}, Y_c)$$
*Default production hyperparameters: $\alpha = 0.50$, $\beta = 0.35$, $\gamma = 0.15$, $\delta = 0.20$, $\lambda = 0.10$.*

---

### 2. Numerically Safe Vectorized Maximal Marginal Relevance (MMR)

To eliminate recommendation echo chambers (e.g. returning 5 successive seasons or spinoffs of the same franchise), KyōRenzu applies Maximal Marginal Relevance.

Given candidate pool $C$ and selected recommendation set $S$, the next item $c^*$ is selected by:
$$c^* = \arg\max_{c \in C \setminus S} \left[ \lambda_{\text{div}} \cdot S_{\text{raw}}(c) - (1 - \lambda_{\text{div}}) \cdot \max_{s \in S} \cos(\hat{\mathbf{e}}_c, \hat{\mathbf{e}}_s) \right]$$
Where $\lambda_{\text{div}} \in [0, 1]$ balances pure relevance ($\lambda = 1.0$) against maximum diversity ($\lambda = 0.0$). Production default: $\lambda_{\text{div}} = 0.68$.

#### Vectorized Implementation:
Instead of slow $O(|C| \cdot |S|)$ Python loops, KyōRenzu stacks selected vectors into matrix $\mathbf{S} \in \mathbb{R}^{|S| \times D}$ and candidate vectors into $\mathbf{C} \in \mathbb{R}^{|C| \times D}$. The cross-similarity matrix is computed in a single BLAS call:
$$\mathbf{M}_{\text{sim}} = \mathbf{C} \mathbf{S}^T \in \mathbb{R}^{|C| \times |S|}$$
The maximum similarity per candidate is extracted using `np.max(M_sim, axis=1)`. Zero-norm protection prevents floating-point overflow or division-by-zero errors.

---

## 📊 Library 2.0 & ML Taste Analytics Hub

The Library tab ([web/src/App.tsx](web/src/App.tsx)) is an interactive personal anime vault featuring instant search, bulk mutations, and real-time Taste DNA analytics.

```mermaid
flowchart TD
    subgraph LibraryState ["Library 2.0 In-Memory State Machine"]
        RawItems["user_library.db Records"]
        HashJoin["In-Memory Hash Join (<1.8ms)\nEnriched with anime_data.db Cache"]
        SearchFilter["Client-Side Filter Map\n(Status / Title / Score / Era)"]
        BatchStore["Batch Selection Set (Set<number>)"]
        
        RawItems --> HashJoin
        HashJoin --> SearchFilter
        SearchFilter --> BatchStore
    end

    subgraph Actions ["Optimistic UI Mutators"]
        QuickPlus["Quick +1 Episode\n(Debounced 300ms absolute target)"]
        StatusChange["Status Transition\n(Auto-complete on last episode)"]
        BatchMutate["Atomic Batch Actions\n(Mark Status, Favorite, Delete)"]
        
        QuickPlus --> RawItems
        StatusChange --> RawItems
        BatchMutate --> RawItems
    end

    subgraph Analytics ["Taste DNA Engine (/api/user_library/insights)"]
        TasteVector["User Taste Centroid Projection"]
        BacklogPrioritizer["AI Backlog Resonance Ranking\n(Plan-to-Watch Ranked by Cosine %)"]
        RadarGraph["Genre Affinity Radar Data"]
        EraBar["Chronological Era Distribution"]
        CriticStats["Critic Index (Mean, StdDev, Global Delta)"]
        
        HashJoin --> TasteVector
        TasteVector --> BacklogPrioritizer
        HashJoin --> RadarGraph
        HashJoin --> EraBar
        HashJoin --> CriticStats
    end
```

### Key Capabilities:
- **Instant Hash Join (`< 1.8ms`)**: Merges user library records with anime catalog titles, cover URLs, episode counts, and global scores in RAM without disk contention.
- **AI Backlog Prioritizer**: Automatically scores all titles in your "Plan to Watch" queue against your multidimensional taste centroid, telling you exactly which backlog anime matches your aesthetic preference right now.
- **Interactive Genre Radar & Era Distribution**: Visualizes your library across Action, Sci-Fi, Fantasy, Romance, and historical decades using custom SVG glassmorphic charts.
- **Debounced Quick `+1` Episode Mutator**: Updates local UI state instantly at 0ms latency while queuing a 300ms debounced network mutation with absolute target episode numbers, preventing out-of-order packet races.

---

## 🔌 Exhaustive API Reference

The KyōRenzu backend exposes a comprehensive RESTful JSON API via FastAPI:

### System & Catalog Endpoints

#### `GET /api/system/status`
Returns database statistics, catalog count, memory cache status, and diagnostic health.
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "total_anime": 30178,
    "memory_cached_rowids": 30178,
    "search_candidates": 72798,
    "db_wal_mode": true
  }
  ```

#### `GET /api/system/ota-status`
Returns the status of the autonomous background synchronization worker.
- **Response `200 OK`**:
  ```json
  {
    "status": "idle",
    "last_sync": "2026-10-19 22:30:15",
    "total_synced_records": 12,
    "message": "Catalog up to date."
  }
  ```

#### `POST /api/system/ota-sync`
Manually triggers the OTA background synchronization process.

#### `GET /api/random`
Retrieves a uniformly random anime record in $O(1)$ time ($< 0.5\text{ms}$).
- **Response `200 OK`**:
  ```json
  {
    "mal_id": 1,
    "title": "Cowboy Bebop",
    "score": 8.75,
    "episodes": 26,
    "genres": "Action, Sci-Fi",
    "cover_url": "http://localhost:8000/covers/1.jpg"
  }
  ```

#### `GET /api/search`
High-speed fuzzy title search across 72,000+ localized and romaji anime titles.
- **Query Parameters**:
  - `q` (string, required): Search query.
  - `limit` (integer, default: 20): Maximum results to return.
- **Response `200 OK`**:
  ```json
  [
    {
      "mal_id": 20,
      "title": "Naruto",
      "score": 7.99,
      "episodes": 220,
      "genres": "Action, Adventure, Fantasy",
      "cover_url": "http://localhost:8000/covers/20.jpg"
    }
  ]
  ```

---

### Recommendation Endpoints

#### `GET /api/recommendations/{mal_id}`
Returns top-N multimodal recommendations for a specific anime ID using in-memory pre-cached matrices in $< 15\text{ms}$.
- **Query Parameters**:
  - `top_k` (integer, default: 10): Number of recommendations.
  - `div_weight` (float, default: 0.68): MMR diversity balance parameter ($\lambda$).
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "source_anime": {
      "mal_id": 20,
      "title": "Naruto"
    },
    "recommendations": [
      {
        "mal_id": 1735,
        "title": "Naruto: Shippuuden",
        "score": 8.26,
        "similarity": 0.942,
        "genres": "Action, Adventure, Fantasy",
        "cover_url": "http://localhost:8000/covers/1735.jpg"
      }
    ]
  }
  ```

---

### Native Video Streaming Endpoints

#### `POST /api/play`
Spawns `ani-cli` and `mpv` to stream an episode with hardware acceleration.
- **Request Body**:
  ```json
  {
    "anime_title": "Sousou no Frieren",
    "episode": 1,
    "mal_id": 52991
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "started",
    "anime_title": "Sousou no Frieren",
    "episode": 1,
    "message": "Playback process initiated."
  }
  ```

#### `GET /api/play/status`
Polls the active MPV IPC Unix domain socket for real-time player telemetry.
- **Response `200 OK`**:
  ```json
  {
    "status": "playing",
    "title": "Sousou no Frieren",
    "episode": 1,
    "percent": 42.8,
    "message": "Playback active"
  }
  ```

#### `POST /api/play/stop`
Sends an instantaneous `quit` command to the active MPV IPC socket and terminates the associated process group.

---

### User Library Endpoints

#### `GET /api/user_library`
Returns the user's complete library joined with catalog metadata in $< 2\text{ms}$.

#### `POST /api/user_library`
Upserts a single user library entry.
- **Request Body**:
  ```json
  {
    "mal_id": 52991,
    "status": "Watching",
    "episodes_watched": 4,
    "score": 10.0,
    "notes": "Peak fantasy fiction"
  }
  ```

#### `POST /api/user_library/batch`
Executes atomic bulk library mutations (status change, favorite toggle, delete).

#### `GET /api/user_library/insights`
Calculates Taste DNA distributions, Critic stats, and AI Backlog Resonance rankings in $< 15\text{ms}$.

---

## 🧪 11-Test Automated Verification & Benchmark Suite

KyōRenzu includes a comprehensive end-to-end reliability, numerical safety, invariant testing, and performance benchmark test suite in [test_verification_suite.py](test_verification_suite.py). All 11 tests must pass before any release:

```bash
# Execute verification suite using the CPU packaging environment
./.build_venv/bin/python test_verification_suite.py
```

### Verification Suite Breakdown:

```text
===============================================================
     KYORENZU PERFORMANCE & RELIABILITY TEST SUITE            
===============================================================

[1] Testing SQLite WAL Mode & Covering Indexes
    - Verifies PRAGMA journal_mode is 'wal' across anime_data.db and user_library.db.
    - Asserts presence of composite indexes (idx_anime_year_members, idx_anime_score_members, idx_user_lib_mal_id).
    -> PASS

[2] Benchmarking Random Anime Lookup Latency
    - Runs 100 consecutive random anime queries through get_random_anime().
    - Asserts mean latency < 3.0ms (Measured: 0.38ms, 167.4x faster than baseline).
    -> PASS

[3] Benchmarking Off-Thread Fuzzy Search
    - Executes fuzzy queries across 72,798 strings via rapidfuzz worker.
    - Asserts mean latency < 250ms (Measured: 161.80ms, zero main event loop blocking).
    -> PASS

[4] Testing OTA Memory Cache Coherency
    - Ingests mock delta anime record into memory cache via refresh_memory_caches().
    - Verifies instant availability in SEARCH_TITLE_MAP and immediate searchability in fuzzy match worker.
    -> PASS

[5] Testing Vectorized MMR Numerical Safety & Zero Norm Guard
    - Tests zero-norm normalization guard against all-zero vectors.
    - Validates candidate matrix dot-product (C @ S.T) yields zero NaNs and zero Infs.
    -> PASS

[6] Testing Subprocess PGID Registry & Lifespan Hooks
    - Registers, audits, and unregisters process group IDs in ACTIVE_SUBPROCESS_PGIDS.
    - Validates clean, non-crashing execution of cleanup_all_subprocesses().
    -> PASS

[7] Testing FastAPI Endpoints Integration
    - Tests live HTTP endpoints using FastAPI TestClient (/api/play/status, /api/random, /api/search, /api/recommendations/20).
    - Verifies 200 OK status codes and valid payload schemas.
    -> PASS

[8] Testing Autonomous OTA Self-Healing & Atomic Embedding Pipeline
    - Inserts synthetic anime ('Chrono Resonance Nova', MAL ID 9999991) into anime_data.db.
    - Executes live compute_and_append_embeddings() generating real CLIP ViT-L/14 & MiniLM vectors.
    - Verifies exact L2 unit norm constraint (norm = 1.0 ± 1e-5) and zero NaNs.
    - Asserts matrix row increments in both memory and on-disk files.
    - Queries /api/recommendations/9999991 and asserts latency < 35ms.
    - Confirms atomic persistence cleaned up all temporary .tmp files.
    - Cleans up synthetic test data and restores original catalog state.
    -> PASS

[9] Testing Library 2.0 State Machine, Batch Mutations & AI Backlog Ranking
    - Verifies episode clamping and auto-completion transition ('Watching' -> 'Completed') at episodes_watched == total_episodes.
    - Verifies started_at and completed_at ISO timestamp generation.
    - Verifies zero-SQL in-memory hash join enrichment on GET /api/user_library in <2ms.
    - Verifies atomic batch mutations on POST /api/user_library/batch (status, favorite, delete).
    - Verifies GET /api/user_library/insights returns valid Taste DNA & Backlog AI Resonance scores in <15ms.
    -> PASS

[10] Testing SQLite WAL Schema Magic & Epoch Headers
    - Validates database application_id header (0x43504B52) and user_version schema epoch (0x20260404).
    - Verifies tampered database headers correctly trigger fallback stride invariants.
    -> PASS

[11] Testing IEEE-754 Mantissa Stabilization Invariants
    - Audits all 30,179 cover embeddings and 22,593 synopsis embeddings for zero bit errors.
    - Asserts strict unit norms across all matrix rows (min=0.9999999, max=1.0000001).
    - Validates subnormal mantissa drift detection across 81 diagnostic probe iterations.
    -> PASS

===============================================================
     ALL VERIFICATION AND BENCHMARK TESTS PASSED (11/11)      
===============================================================
```

---

## 💻 Download & Quickstart

### 1. Download AppImage (Linux)
KyōRenzu is distributed as a self-contained portable AppImage. On first execution, it automatically initialises directories and hydrates database, embeddings, and cover assets directly into `~/.local/share/KyoRenzu/`.

📥 **[Download KyoRenzu 1.0.0 AppImage (Google Drive)](https://drive.google.com/file/d/1rpoetLZnyY9RVqt53rgZSLc00Vr0Uc8Z/view?usp=sharing)**

```bash
# Make binary executable and launch
chmod +x KyoRenzu-1.0.0.AppImage
./KyoRenzu-1.0.0.AppImage
```

---

## 🛠️ Building from Source

### Prerequisites
- **Operating System**: Linux (Ubuntu 20.04+, Debian 12+, Fedora 38+, Arch Linux)
- **Node.js**: v18.0.0+ and `npm`
- **Python**: 3.10, 3.11, or 3.12
- **System Media Player**: `mpv` (`sudo apt install mpv` or `sudo pacman -S mpv`)
- **System Utilities**: `curl`, `grep`, `sed`, `fzf`

### Step 1: Clone Repository
```bash
git clone https://github.com/ChaitanyaParate/KyoRenzu.git
cd KyoRenzu
```

### Step 2: Configure Development Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Install Web Dependencies & Build Frontend
```bash
cd web
npm install
npm run build
cd ..
```

### Step 4: Run Verification Suite
```bash
./venv/bin/python test_verification_suite.py
```

### Step 5: Run Desktop Application in Development
Launch the three processes concurrently in separate terminals:

```bash
# Terminal 1: FastAPI Gateway
./venv/bin/python api.py

# Terminal 2: Vite Frontend Dev Server
cd web && npm run dev

# Terminal 3: Electron Desktop Shell
npm start
```

### Step 6: Package Standalone Linux Distributable
KyōRenzu provides modular build scripts for frontend, backend, and full desktop packaging:

```bash
# 1. Setup dedicated CPU packaging virtual environment
python3 -m venv .build_venv
./.build_venv/bin/pip install --upgrade pip
./.build_venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
./.build_venv/bin/pip install pyinstaller transformers sentence_transformers fastapi uvicorn rapidfuzz cloudscraper beautifulsoup4 gdown appdirs

# 2. Build the React Vite 6 Web UI (~1.4s)
npm run build:react

# 3. Compile slim hardware-agnostic CPU Python binary (~1.5 mins, 243 MB)
npm run build:python

# 4. Package Linux .AppImage via electron-builder (360 MB total)
npm run build:electron
```

The resulting standalone executable will be generated at:
`dist/electron/KyoRenzu-1.0.0.AppImage`

---

## 🗂️ Project Directory Structure

```text
KyoRenzu/
├── api.py                     # FastAPI gateway, dynamic port binding, PGID registry, MPV IPC listener
├── api.spec                   # Hardened PyInstaller spec (CPU Torchvision ops, symbol stripping, excludes)
├── auto_selector.py           # Headless ANSI-stripping menu matcher for ani-cli automation
├── config.py                  # Thread-safe SQLite get_db_connection() helper, paths, and WAL initialization
├── recommender.py             # Multimodal ML engine: CLIP, MiniLM, CLAP, Genre Correlation, Vectorized MMR
├── input_parser.py            # User watchlist fuzzy matching and lazy-loaded title resolution parser
├── mal_scraper.py             # Async multiprocessing scraper (AniList GraphQL -> Jikan MAL -> Kitsu)
├── main.js                    # Electron runtime, dynamic port negotiation, Ozone Wayland, two-tier teardown
├── package.json               # Root electron configuration and build scripts
├── requirements.txt           # Python backend dependencies (torch, transformers, rapidfuzz, fastapi)
├── test_verification_suite.py # Automated 11-test reliability, latency, and numerical safety benchmark suite
│
├── ani-cli-master/            # INCLUDED SUBMODULE: POSIX bash anime scraper & video extraction engine
│   └── ani-cli                # Core video stream resolver executable
│
├── web/                       # React 19 + Vite 6 Single Page Application
│   ├── index.html             # HTML entry point with glassmorphism meta tags
│   ├── package.json           # Frontend dependencies (lucide-react, recharts)
│   ├── vite.config.ts         # Vite build configuration
│   └── src/
│       ├── App.tsx            # Main application UI, debounced optimistic quick +1 mutators, modal controllers
│       ├── main.tsx           # React DOM root hydration
│       └── index.css          # Curated dark-mode design system, glassmorphic tokens, and micro-animations
│
├── gui.py                     # Standalone Gradio ML discovery interface for browser-only research
├── embed_covers.py            # Offline batch processor: OpenAI CLIP cover art embeddings
├── embed_synopsis.py          # Offline batch processor: SentenceTransformer synopsis embeddings
├── embed_audio.py             # Offline batch processor: LAION-CLAP theme audio embeddings
└── download_themes.py         # Automated anime theme music crawler
```

---

## 🛡️ Eight Mandatory Engineering Guardrails

KyōRenzu's architecture is anchored by eight non-negotiable engineering mandates:

1. **Idempotent & Episode-Aware MPV Scrobbling**: Progress listener strictly bounds database updates to once per episode launch via session-scoped `has_scrobbled` flags, incrementing with `MAX(episodes_watched, played_episode)`.
2. **Two-Tier Subprocess Teardown**: Isolates `ani-cli` in a dedicated session PGID (`os.setsid`) and guarantees teardown via Python `lifespan`/`atexit` hooks and Electron `process.kill(-pid, 'SIGTERM')`.
3. **OTA Cache Coherency**: Thread-safe `refresh_memory_caches` hook instantly propagates background AniList sync records into in-memory search choices and candidate matrices without server restart.
4. **Thread-Safe SQLite Concurrency**: `WAL` journal mode enabled globally with 5000ms busy timeouts and strictly scoped per-request/per-thread connections.
5. **Vectorized MMR Numerical Stability**: Pre-normalization norm floor ($\epsilon = 10^{-12}$) guarantees zero `NaN` contamination during dot-product matrix multiplication.
6. **Debounced Optimistic UI Updates**: Client applies optimistic UI state immediately with a 300ms trailing debounce sending exact target integers, eliminating race conditions.
7. **Guaranteed Upper-Bound Episode Clamping**: Every playback trigger (`/api/play`, quick-play buttons, modal jump inputs) and library mutation (`POST /api/user_library`, batch updates, MPV IPC listener) is strictly bounded by `Math.min(episode, total_episodes)` whenever `total_episodes > 0`. Completed titles (e.g. `19 / 19 EPS`) render `▶ Ep 19` rather than `▶ Ep 20`, guaranteeing that playback requests never exceed the canonical maximum episode limit.
8. **Hardware-Agnostic CPU Portability**: The packaged distribution is strictly bound to CPU-only PyTorch runtimes with symbol-stripped shared libraries and dynamic port negotiation, ensuring zero CUDA driver dependencies and flawless execution across NVIDIA, AMD, and Intel GPUs on both Wayland and X11 sessions.

---

## 📜 License & Disclaimers

Distributed under the **MIT License**. See `LICENSE` for details.

- **Educational & Portfolio Use**: KyōRenzu is designed as an architectural exploration of multimodal machine learning, process supervisor patterns, and desktop UI engineering.
- **Content Attribution**: Metadata and artwork are provided courtesy of MyAnimeList, AniList, and Kitsu. Video streaming logic is resolved dynamically at runtime on the user's host machine via `ani-cli`. KyōRenzu does not host, index, or distribute copyrighted video media.
