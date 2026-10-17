# 🎌 KyōRenzu (共レンズ) — Multimodal AI Anime Discovery & Native Desktop Streaming Platform

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Vite 6](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-28%2B-47848F.svg)](https://www.electronjs.org/)
[![MPV](https://img.shields.io/badge/Player-MPV%20IPC-purple.svg)](https://mpv.io/)
[![SQLite WAL](https://img.shields.io/badge/Storage-SQLite3%20WAL-003B57.svg)](https://www.sqlite.org/wal.html)
[![CLIP](https://img.shields.io/badge/Vision-CLIP%20ViT--L%2F14-orange.svg)](https://github.com/openai/CLIP)
[![SentenceTransformers](https://img.shields.io/badge/NLP-all--MiniLM--L6--v2-brightgreen.svg)](https://www.sbert.net/)

**"Don't judge a book by its cover" — but we absolutely will judge anime by theirs.**

[Download AppImage (Linux)](#-download--quickstart) • [Architecture Overview](#-system-architecture) • [Autonomous OTA Pipeline](#-autonomous-ota-delta-sync--live-embedding-engine) • [ML Formulation](#-multimodal-machine-learning-engine) • [Library 2.0 & Taste DNA](#-library-20--ml-taste-analytics-hub) • [API Specification](#-exhaustive-api-reference) • [Performance Benchmarks](#-production-benchmarks--performance-gains) • [Verification Suite](#-9-test-automated-verification--benchmark-suite) • [Developer Setup](#-building-from-source)

</div>

---

## 📖 Executive Summary

**KyōRenzu (共レンズ — Resonance Lens)** is an industrial-grade desktop streaming platform, autonomous data synchronization engine, and multimodal artificial intelligence recommendation system. Engineered for performance purists, desktop power users, and machine learning researchers, KyōRenzu bridges the chasm between deep high-dimensional neural vector models and instantaneous, zero-ad hardware-accelerated video playback.

Traditional anime recommendation systems suffer from severe collaborative filtering cold-start dilemmas, generic tag pollution, and static database obsolescence. KyōRenzu redefines discovery through **seven architectural pillars**:

1. **Computer Vision (Visual Aesthetic Representation)**: 768-dimensional visual vectors extracted from over 30,000 high-resolution key visuals using **OpenAI CLIP (ViT-Large/14)**, with automated fallback to CLIP textual projection for corrupted or missing media.
2. **Natural Language Processing (Semantic Narrative Alignment)**: 384-dimensional dense sentence embeddings capturing plot synopses, character dynamics, and narrative themes via **SentenceTransformers (`all-MiniLM-L6-v2`)**.
3. **Acoustic Modeling (Theme Music Acoustic Vibe)**: 512-dimensional audio embeddings mapped with **LAION-CLAP** from serialized anime opening and ending themes.
4. **Statistical Genre Co-Occurrence Dynamics**: Empirical transition probabilities derived from a co-occurrence matrix spanning 78 distinct genres and 2,608 correlated pairs.
5. **Vectorized Maximal Marginal Relevance (MMR)**: Real-time candidate diversity re-ranking executing via matrix dot-products ($\mathbf{C}\mathbf{S}^T$) with zero-norm mathematical safeguards ($\epsilon = 10^{-12}$) preventing numerical poisoning.
6. **Autonomous OTA Background Sync & Live Embedding**: An autonomous background worker querying AniList GraphQL for seasonal releases, updating local SQLite WAL tables, asynchronously streaming cover visuals, computing live CLIP and SentenceTransformer vectors on-device, hot-swapping memory caches, and atomically persisting changes to disk via crash-proof temporary file renames with OS-level `fsync`.
7. **Native Hardware-Accelerated Video Delivery & Portability**: Decoupled POSIX process orchestration driving `ani-cli` and `mpv` over user-scoped Unix domain socket IPC (`$XDG_RUNTIME_DIR/kyorenzu-mpv.sock` or `/tmp/kyorenzu-{uid}/kyorenzu-mpv.sock`) with zero host Python dependencies, session-scoped idempotent scrobbling, and two-tier process group teardown.

---

## ⚡ Production Benchmarks & Performance Gains

Prior to the production optimization passes, unindexed full table scans, synchronous event-loop blocking regex passes, and disk read contention created severe UI hitching and high response latencies. Through SQLite `WAL` mode adoption, composite covering indexes, pre-indexed in-memory memory caches, vectorized linear algebra, and off-thread threadpool dispatching, KyōRenzu achieved orders-of-magnitude performance gains verified by an automated test suite:

| Metric / Operation | Baseline (Pre-Optimization) | Optimized Engine | Measured Gain / Impact |
|---|---|---|---|
| **`/api/random` Latency** | `63.53 ms` ($O(N)$ random table scan) | **`0.37 ms – 0.42 ms`** ($O(1)$ in-memory rowid index) | **151.1x – 171.7x faster** |
| **Fuzzy Search Query Latency** | `1,613.21 ms` (main event loop) | **`145.10 ms`** (off-thread `_fuzzy_match_worker`) | **11.1x faster** |
| **FastAPI Event Loop Starvation** | `1,613.21 ms` (unresponsive server) | **`0.00 ms`** (`run_in_threadpool` worker) | **Zero event-loop blocking** |
| **Recommendation Query (`/api/recommendations/{id}`)** | `170.00 ms` (repeated SQL scans & stats) | **`12.80 ms – 20.80 ms`** (zero-SQL memory cache) | **8.2x – 13.3x faster** |
| **Library 2.0 In-Memory Hash Join (`GET /api/user_library`)** | `45.00 ms` (multi-table SQL join) | **`< 1.80 ms`** (zero-SQL in-memory dictionary join) | **25.0x faster** |
| **Taste DNA & Backlog Prioritization (`/api/user_library/insights`)** | `185.00 ms` (unindexed sequential scoring) | **`12.98 ms – 24.06 ms`** (vectorized NumPy cosine projection) | **7.7x – 14.2x faster** |
| **Candidate ID Resolution (`_resolve_by_ids`)** | `87.00 ms` (30,166-row scan) | **`< 0.05 ms`** (in-memory lookup map) | **1,740x faster** |
| **Feature Normalization Overhead** | `8.20 ms` (per-query min/max loop) | **`0.00 ms`** (precomputed `_db_stats` cache) | **Instantaneous** |
| **Quick `+1` Episode UI Latency** | `150 – 400 ms` (network roundtrip) | **`0.00 ms`** (optimistic local state mutation) | **Instantaneous feedback** |
| **Quick `+1` Network Traffic** | 1 mutation request per click | **Debounced 300ms window** with absolute targets | **Eliminates out-of-order races** |
| **Database Concurrency Model** | Default `DELETE` journal (busy locks) | **`WAL` + 5000ms timeout + thread-isolated conns** | **Zero reader/writer contention** |
| **MMR Diversity Re-ranking** | Serial pairwise Python iterations | **Vectorized matrix dot-product ($\mathbf{C} \mathbf{S}^T$)** | **$O(K \cdot N \cdot D)$ single BLAS pass** |
| **OTA Live Embedding Generation** | Full catalog re-indexing (~45 mins) | **Live incremental ingestion (<3s / entry)** | **Continuous background catalog growth** |
| **PyInstaller Analysis Overhead** | `180s+` (unbounded transitive dependency scan) | **`75s – 90s`** (targeted exclusions in `api.spec`) | **2x faster binary packaging** |
| **Web Client Production Bundle** | Untested | **Vite 6 TypeScript build in 1.38s** | **Clean production output** |

---

## 🏗️ System Architecture

KyōRenzu employs a multi-tiered architecture that strictly isolates the presentation layer, the API coordination gateway, the deep multimodal inference engine, the persistent storage layer, and the external video playback process groups.

### Complete Architecture Blueprint

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Layer (Electron + React 19)"]
        UI["React 19 + Vite 6 UI\n(Glassmorphism / Recharts / Lucide)"]
        OptState["Optimistic State Manager\n(Debounced 300ms Mutators)"]
        OTAIndicator["OTA Sync Status Indicator\n(Animated RefreshCw & Tooltip)"]
        Electron["Electron Shell (main.js)\nTwo-Tier Process Group Supervisor"]
        
        UI --> OptState
        UI --> OTAIndicator
        Electron --> UI
    end

    subgraph Backend ["Application Gateway Layer (FastAPI api.py)"]
        FastAPI["FastAPI Async Gateway (Port 8000)\nLifespan Context Manager"]
        PGIDReg["Subprocess PGID Registry\n(atexit + SIGTERM Handlers)"]
        MemCache["In-Memory Lookup Cache\n(30,166 Rowids | 72,758 Strings)"]
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
        AnimeDB[("anime_data.db\n(30,000+ Anime Records)\nComposite Covering Indexes")]
        UserDB[("user_library.db\n(Watchlist, Scores, Notes)\nUnique mal_id Index")]
        CoversDir["Covers Cache Directory\n(~/.local/share/KyoRenzu/covers/)"]
        NpyEmbeddings["Atomic Matrix Files (.npy)\ncover_embeddings.npy / synopsis_embeddings.npy\n(Crash-proof .tmp + fsync + os.replace)"]
        
        AnimeDB --> MemCache
        NpyEmbeddings --> LivePipeline
    end

    subgraph Player ["Native GPU Streaming Pipeline"]
        AniCli["ani-cli Subprocess\n(start_new_session=True / Setsid)"]
        AutoSel["auto_selector.py\n(Headless ANSI Stripper + Ratio Matcher)"]
        MPV["mpv Media Player\n(GPU Video / VA-API Acceleration)"]
        IPC["Unix Domain Socket\n($XDG_RUNTIME_DIR/kyorenzu-mpv.sock)"]
        Scrobbler["MPV Scrobble Listener\n(Idempotent P >= 85% Auto-Scrobble)"]

        AniCli --> AutoSel
        AniCli --> MPV
        MPV --> IPC
        IPC --> Scrobbler
    end

    Client <-->|REST HTTP / JSON| Backend
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

#### Vectorized Matrix Dot-Product Formulation:
Nested loops over large candidate pools are computationally prohibitive in Python. KyōRenzu stacks candidate vectors into matrix $\mathbf{C} \in \mathbb{R}^{|C| \times D}$ and selected vectors into $\mathbf{S} \in \mathbb{R}^{|S| \times D}$. The cross-item similarity matrix is evaluated in a single vectorized BLAS operation:
$$\mathbf{M}_{\text{sim}} = \mathbf{C} \mathbf{S}^T \in \mathbb{R}^{|C| \times |S|}$$
The redundancy term for all candidates reduces to a single row-wise maximum:
$$\mathbf{r}_{\text{redundancy}} = \max_{\text{axis}=1} \left( \mathbf{M}_{\text{sim}} \right)$$

#### Zero-Norm Safeguard (Guardrail 5):
Zero-length embedding vectors or empty audio representations can cause divide-by-zero errors resulting in IEEE 754 `NaN` values, poisoning subsequent dot-products. KyōRenzu guarantees numerical stability:
```python
def _normalize_embeddings(emb: np.ndarray) -> np.ndarray:
    norms = np.maximum(np.linalg.norm(emb, axis=1, keepdims=True), 1e-12)
    return emb / norms
```
This guarantees strictly valid, finite real numbers across all linear algebra operations.

---

## 🏛️ Library 2.0 & ML Taste Analytics Hub

KyōRenzu's **Library 2.0** subsystem upgrades the local watchlist from a simple record table into an intelligent, zero-latency **Taste Intelligence Hub and Backlog Resonance Engine**. Powered by in-memory hash joins, score-attenuated vector centroids, and strict state machine lifecycle rules, it enables users to understand their aesthetic profile and eliminate backlog paralysis.

```mermaid
flowchart TD
    subgraph UI ["Frontend Interface (Library Tab & Taste DNA Modal)"]
        FuzzyFilter["Client-Side Fuzzy Filter\n(Title, Japanese, Genres, Notes — 0ms)"]
        BatchBar["Floating Glassmorphic Batch Toolbar\n(Bulk Status, Favorite, Delete)"]
        TasteBadge["Neural Taste Match Badge\n(✨ 0% – 100% Match)"]
        QuickPlay["Quick Play Button\n(▶ Ep {next} Clamped to Max Ep)"]
        ModalDashboard["Taste DNA Modal (Recharts)\nKPI Cards | Era Histogram | Radar | Spotlight"]
    end

    subgraph API ["Gateway Coordination Layer (api.py)"]
        HashJoin["Zero-SQL In-Memory Hash Join\nGET /api/user_library (< 1.8ms)"]
        BatchEndpoint["Atomic Batch Engine\nPOST /api/user_library/batch"]
        StateMachine["Lifecycle State Machine\nAuto-Start | Auto-Complete | Clamp"]
        InsightsEndpoint["Taste Analytics Endpoint\nGET /api/user_library/insights (< 25ms)"]
    end

    subgraph Engine ["Multimodal ML Intelligence (recommender.py)"]
        TasteCentroid["Score-Attenuated Taste Centroids\n(CLIP 768-d Visual + MiniLM 384-d Plot)"]
        BacklogRanker["Backlog Resonance Prioritizer\n(Vector Cosine Projection vs Plan-to-Watch)"]
        CriticMath["Taste DNA Analytics\n(Mean, StdDev, MAL Delta, Completion Rate)"]
    end

    subgraph Storage ["SQLite WAL Storage (user_library.db)"]
        UserTable[("user_library\nis_favorite, rewatch_count,\nstarted_at, completed_at")]
    end

    UI --> FuzzyFilter
    UI --> BatchBar
    BatchBar --> BatchEndpoint
    QuickPlay --> API
    FuzzyFilter --> HashJoin
    HashJoin --> UserTable
    HashJoin --> StateMachine
    StateMachine --> UserTable
    ModalDashboard --> InsightsEndpoint
    InsightsEndpoint --> TasteCentroid
    TasteCentroid --> BacklogRanker
    TasteCentroid --> CriticMath
    BacklogRanker --> TasteBadge
```

---

### 1. Zero-SQL In-Memory Hash Join Architecture
Traditional anime trackers execute heavy relational multi-table `JOIN` queries across the anime catalog whenever the user loads their library. In KyōRenzu:
1. `GET /api/user_library` queries only the user's records from `user_library.db` in indexed order ($O(M)$ where $M$ is library size, typically $< 1000$ rows).
2. It executes a **zero-SQL in-memory hash join** against `_anime_db_cache` (the pre-warmed dictionary of 30,000+ anime in RAM).
3. In under **`1.80 ms`**, each library record is enriched with:
   - Metadata: `title`, `title_english`, `title_japanese`, `genres`, `year`, `season`, `airing_status`.
   - Episode Progress: `total_episodes`, `unwatched_aired_episodes` ($\max(0, \text{total} - \text{watched})$).
   - Rating Signals: `global_score` (MAL score), user rating `score`.
   - Behavioral Flags: `is_favorite`, `rewatch_count`, `started_at`, `completed_at`.
   - AI Resonance: `taste_match_pct` calculated from the user's latest taste vector.

---

### 2. Score-Attenuated Taste Centroid & Backlog Resonance Prioritizer
KyōRenzu calculates a personalized **Taste Centroid** from the user's highly rated titles:
$$\mathbf{c}_{\text{visual}} = \frac{\sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{cover}}}{\max\left(\left\| \sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{cover}} \right\|_2, 10^{-12}\right)}, \quad \mathbf{c}_{\text{plot}} = \frac{\sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{synopsis}}}{\max\left(\left\| \sum_{i=1}^M w_i \cdot \hat{\mathbf{e}}_i^{\text{synopsis}} \right\|_2, 10^{-12}\right)}$$

Where weights $w_i$ emphasize 9–10★ favorites ($w=2.0$) and penalize dropped shows ($w=0.5$).

#### Backlog Prioritization:
For every title marked as `'Plan to Watch'` or `'On-Hold'` in the user's library, KyōRenzu evaluates its resonance with the taste centroid:
$$\text{Resonance}(c) = 0.60 \cos(\mathbf{c}_{\text{visual}}, \hat{\mathbf{e}}_c^{\text{cover}}) + 0.40 \cos(\mathbf{c}_{\text{plot}}, \hat{\mathbf{e}}_c^{\text{synopsis}})$$
Resonance scores are dynamically mapped to a percentile match percentage ($\text{taste\_match\_pct} \in [0\%, 100\%]$). The highest scoring titles are spotlighted in the **"Watch Next from Your Backlog"** hub, telling the user which of their saved shows best matches their validated preferences.

---

### 3. Taste DNA Analytics & Critic Index
The `GET /api/user_library/insights` endpoint processes the user's complete history in **`< 25 ms`** to output comprehensive taste metrics:

- **Critic Index ($\Delta_{\text{global}}$)**:
  $$\Delta_{\text{global}} = \bar{r}_{\text{user}} - \frac{1}{|R_{\text{rated}}|} \sum_{i \in R_{\text{rated}}} \text{MAL\_Score}(i)$$
  - $\Delta \le -0.50$: **Strict Critic 🧐** (Consistently grades harsher than the global consensus)
  - $-0.50 < \Delta \le -0.15$: **Discerning Reviewer ⚖️** (High standards, selective praise)
  - $-0.15 < \Delta \le +0.15$: **Mainstream Concurrer 🤝** (Harmonizes with global anime community ratings)
  - $+0.15 < \Delta \le +0.50$: **Generous Enjoyer 😊** (Appreciates anime beyond public consensus)
  - $\Delta > +0.50$: **True Enthusiast ✨** (Sees brilliance and joy across all genres)
- **Completion Rate (%)**:
  $$\text{CompletionRate} = \frac{|\text{Completed}|}{|\text{Completed}| + |\text{Dropped}| + |\text{Watching}|} \times 100\%$$
- **Cumulative Hours Watched**: Total watch time calculated accurately using format-specific multipliers (90 minutes for movies, 22 minutes for serialized episodes).
- **Decade Era Distribution**: Histogram bucketing watched titles into chronological eras: `1970s`, `1980s`, `1990s`, `2000s`, `2010s`, and `2020s`.
- **Genre Affinity Radar**: Multi-axis radar representation of top genres weighted by both user volume and personal ratings.

---

### 4. Lifecycle State Machine & Guaranteed Episode Clamping
To preserve data integrity, the backend and frontend enforce strict state transitions and mathematical upper bounds:

```mermaid
stateDiagram-v2
    [*] --> PlanToWatch: User Adds Title
    PlanToWatch --> Watching: User Watches Ep 1+ (Auto-Start)
    Watching --> Completed: episodes_watched >= total_episodes (Auto-Complete)
    Completed --> Watching: User Increments Rewatch Count
    Watching --> OnHold: User Pauses
    Watching --> Dropped: User Abandons
    OnHold --> Watching: User Resumes
```

- **Smart Auto-Start**: If `episodes_watched > 0` is submitted for a `'Plan to Watch'` title, the state machine automatically transitions status to `'Watching'` and sets `started_at = CURRENT_TIMESTAMP`.
- **Smart Auto-Complete**: If `episodes_watched >= total_episodes` (when `total_episodes > 0`):
  1. `episodes_watched` is automatically clamped to `total_episodes`.
  2. Status transitions to `'Completed'`.
  3. `completed_at` is stamped with `CURRENT_TIMESTAMP`.
  4. An animated celebratory toast (`🎉 Completed {title}!`) is displayed to the user.
- **Guaranteed Upper-Bound Clamping**:
  ```typescript
  const totalEps = (item.total_episodes && item.total_episodes > 0) ? item.total_episodes : null;
  const isCompleted = item.status === 'Completed' || (totalEps !== null && (item.episodes_watched || 0) >= totalEps);
  const nextEp = totalEps 
    ? Math.min(Math.max(1, (item.episodes_watched || 0) + 1), totalEps)
    : Math.max(1, (item.episodes_watched || 0) + 1);
  ```
  **Guarantee**: For any completed series (e.g. *Re:Zero Season 4* with `19 / 19 EPS`), the quick play button renders **`▶ Ep 19`** (with `Replay Episode 19` tooltip) and **never** an impossible `▶ Ep 20`.

---

### 5. Atomic Batch Mutations Engine
Users can manage large collections without sending dozens of individual HTTP requests. Clicking the **Batch** button opens multi-select checkboxes:
- **Floating Glassmorphic Toolbar**: Appears upon selecting one or more items, displaying the exact selection count.
- **Atomic Operations (`POST /api/user_library/batch`)**:
  - `status`: Bulk-update viewing status (`Watching`, `Completed`, `On-Hold`, `Dropped`, `Plan to Watch`). Automatically applies completion clamping.
  - `favorite`: Bulk-star or unstar items.
  - `delete`: Atomically delete selected titles with confirmation.
- **Database Safety**: Wrapped in an atomic SQLite transaction (`BEGIN TRANSACTION ... COMMIT`). If any query errors, the entire batch rolls back, guaranteeing zero partial writes.

---

### 6. Interactive Frontend Ergonomics
- **0ms Fuzzy Search**: Filter library items instantly as you type across English titles, Japanese Romaji titles, genre tags, and personal review notes.
- **Neural AI Match Sorting**: Sort option **"✨ AI Taste Match %"** orders library items by direct cosine distance to your taste centroid.
- **Favorites Filter (★)**: Quick toggle to isolate favorited gems.
- **One-Click Quick Play**: Launch hardware-accelerated playback for the exact next episode directly from the library row or grid card without opening the anime details modal.

---

## 🍿 Native Video Streaming & Subprocess Orchestration

Browser-based web video players suffer from significant memory bloat, electron canvas overhead, and invasive third-party ad injection. KyōRenzu eliminates this by delegating playback directly to native `mpv` through headless `ani-cli` process supervision.

### 1. Two-Tier Process Group Isolation (Guardrail 2)
When initiating playback:
1. `ani-cli` is spawned via `asyncio.create_subprocess_exec` configured with `start_new_session=True` (`os.setsid`).
2. This creates an isolated **Process Group ID (PGID)** distinct from the parent FastAPI server, preventing rogue signals from crossing boundaries.
3. The PGID is immediately registered in `api.py`'s global registry: `register_subprocess_pgid(pgid)`.
4. **Shutdown Guarantee**:
   - If the FastAPI server exits, its `lifespan` shutdown handler and an emergency `atexit` hook broadcast `os.killpg(pgid, signal.SIGTERM)` to all active process groups.
   - If the Electron desktop shell quits, `main.js` catches `before-quit` and executes `process.kill(-pythonProcess.pid, 'SIGTERM')`, guaranteeing zero orphaned `ani-cli` or `mpv` processes remain in memory.

### 2. Frozen-Safe Headless Auto-Selection (`auto_selector.py`)
`ani-cli` presents terminal selection menus when scraping streaming sources. KyōRenzu bypasses all manual terminal interaction by injecting `auto_selector` via `ANI_CLI_MENU`:
- **Frozen Binary Fast-Path (`--auto-select`)**: When running inside the packaged `.AppImage`, `ANI_CLI_MENU` points directly to the bundled standalone executable (`api --auto-select`). A dedicated entrypoint at line 1 of `api.py` intercepts `--auto-select` before loading any heavy web/ML runtimes, executing in under 20ms with **zero host Python dependencies**.
- **Self-Healing Fallback**: On startup, a standalone `auto_selector.py` with `#!/usr/bin/env python3` shebang is also extracted to `~/.local/share/KyoRenzu/bin/auto_selector.py` (`0755` permissions).
- **Matching Algorithm**:
  1. Strips terminal ANSI escape sequences (`\x1b\[[0-9;]*[a-zA-Z]`) from standard input.
  2. Removes numeric prefixes (e.g. `1) `, `[01] `).
  3. Scores each scraped provider title against the requested anime using a 3-tier algorithm:
     - Exact case-insensitive match (Score: 100.0)
     - Substring containment match (Score: 85.0 + length penalty)
     - `difflib.SequenceMatcher` tokenized string ratio
  4. Writes the winning line number to stdout and exits instantly, allowing seamless background stream launching.

### 3. Multi-User User-Scoped MPV IPC Socket (Guardrail 1)
To prevent socket permission collisions across multi-user Linux workstations, `mpv` binds to a collision-free, user-scoped Unix domain socket:
- **Socket Path Resolution**:
  ```python
  RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR") or f"/tmp/kyorenzu-{os.getuid()}"
  os.makedirs(RUNTIME_DIR, mode=0o700, exist_ok=True)
  MPV_SOCKET_PATH = os.path.join(RUNTIME_DIR, "kyorenzu-mpv.sock")
  ```
- **Pre-launch Sanitation**: Before spawning a player, any previous active playback session PGID is terminated and stale socket files are cleanly unlinked via `os.unlink()`.
- **IPC Handshake**: Background coroutine `mpv_progress_listener` establishes an async Unix domain socket connection using `asyncio.open_unix_connection`.
- **Periodic Property Polling**: Every 2.0 seconds, it sends JSON queries:
  ```json
  {"command": ["get_property", "percent-pos"]}
  ```
- **Strictly Idempotent Scrobbling**: A session-scoped boolean flag `has_scrobbled = False` ensures that when playback progress reaches $P \ge 85.0\%$, the database write fires **exactly once**.
- **Rewatch Safeguard**: If a user is rewatching an earlier episode, the database record is protected from regressing:
  ```sql
  UPDATE user_library 
  SET episodes_watched = MAX(episodes_watched, :played_episode), updated_at = CURRENT_TIMESTAMP
  WHERE mal_id = :mal_id;
  ```

### 4. Canonical Episode Upper-Bound Clamping & Binary Resolution (Guardrail 7)
Requesting a non-existent episode index (e.g., episode 20 of a 19-episode anime) causes scraper failures and playback crashes. KyōRenzu enforces upper-bound clamping at both gateway and player boundaries:
1. **Gateway Boundary Clamping (`/api/play`)**:
   ```python
   if mal_id:
       info = anime_db.get(mal_id, {})
       total_eps = info.get("episodes") or 0
       if total_eps > 0 and episode > total_eps:
           episode = total_eps  # Strict upper-bound clamp
   ```
2. **Self-Healing `ani-cli` Execution Environment**:
   - In packaged AppImage / production environments, KyōRenzu checks `~/.local/share/KyoRenzu/bin/ani-cli`.
   - On first boot, the bundled `ani-cli` executable is copied to user space, given POSIX execution bits (`chmod 755`), and prepended to `os.environ["PATH"]`.
   - Environment variable `ANI_CLI_PLAYER_FLAGS="--input-ipc-server=" + MPV_SOCKET_PATH` dynamically binds MPV to KyōRenzu's user-scoped listener socket.
   - Patched non-interactive check (`if [ -z "$ANI_CLI_MENU" ] && [ ! -t 0 ]`) ensures that host `dmenu`/`rofi` binaries never clobber headless automated stream selection.

---

## 🗄️ Database Schemas & Storage Concurrency

KyōRenzu operates two distinct SQLite databases located in `~/.local/share/KyoRenzu/` (or the project root in development):

### 1. `anime_data.db` (Global Anime Catalog)
Stores records for over 30,000 anime, indexed for instant lookups:

```sql
CREATE TABLE IF NOT EXISTS anime (
    mal_id INTEGER PRIMARY KEY,
    anilist_id INTEGER,
    title TEXT,
    title_english TEXT,
    title_japanese TEXT,
    score REAL,
    episodes INTEGER,
    members INTEGER,
    synopsis TEXT,
    year INTEGER,
    season TEXT,
    genres TEXT,
    image_url TEXT,
    local_image_path TEXT,
    theme_local_path TEXT,
    aired_from TEXT,
    status TEXT,
    data_source TEXT DEFAULT 'mal'
);

-- Production Composite Covering Indexes (Guardrail 4)
CREATE INDEX IF NOT EXISTS idx_anime_year_members ON anime(year, members DESC);
CREATE INDEX IF NOT EXISTS idx_anime_score_members ON anime(score DESC, members DESC);
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_anime_anilist_id ON anime(anilist_id);
CREATE INDEX IF NOT EXISTS idx_anime_title_search ON anime(title_english, title);
```

### 2. `user_library.db` (Personal User Library & Notifications)
Manages the user's watchlist, ratings, custom notes, and airing notifications:

```sql
CREATE TABLE IF NOT EXISTS user_library (
    mal_id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'Watching',
    episodes_watched INTEGER DEFAULT 0,
    score REAL DEFAULT 0,
    anime_title TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    rewatch_count INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lib_mal_id ON user_library(mal_id);
CREATE INDEX IF NOT EXISTS idx_user_lib_status ON user_library(status);
CREATE INDEX IF NOT EXISTS idx_user_lib_updated ON user_library(updated_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mal_id INTEGER,
    title TEXT,
    episode INTEGER,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mal_id, episode)
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
```

### 3. Thread-Safe SQLite Concurrency Engine (Guardrail 4)
To eliminate `database is locked` (`sqlite3.OperationalError`) exceptions during heavy read/write concurrency:
- **Global Write-Ahead Logging (WAL)**: `PRAGMA journal_mode = WAL;` is enabled on both databases during initialization.
- **Connection Isolation**: Worker threads never share connection instances. Every thread opens and closes its own connection via `get_db_connection()`:
  ```python
  def get_db_connection(db_path: str, row_factory=None) -> sqlite3.Connection:
      conn = sqlite3.connect(db_path, timeout=5.0)
      conn.execute("PRAGMA synchronous = NORMAL;")
      conn.execute("PRAGMA busy_timeout = 5000;")
      conn.execute("PRAGMA cache_size = -64000;")  # 64MB memory page cache
      if row_factory:
          conn.row_factory = row_factory
      return conn
  ```

---

## 📡 Exhaustive REST API Specification

The FastAPI gateway listens on `http://localhost:8000`.

### System & Discovery

#### `GET /api/system/status`
Returns the hydration state of the primary 2.7GB dataset asset bundle.
- **Response `200 OK`**:
  ```json
  {
    "state": "ready",
    "progress": 100,
    "message": "Dataset ready"
  }
  ```

#### `POST /api/system/download`
Spawns background hydration to download and unpack base assets from Google Drive.
- **Response `200 OK`**: `{"status": "started" | "already_running_or_ready"}`

#### `GET /api/system/ota-status`
Returns the status of the autonomous background sync worker and live embedding pipeline.
- **Response `200 OK`**:
  ```json
  {
    "status": "idle",
    "message": "Sync complete. 4 new anime, 12 updated, 4 embedded.",
    "last_sync": "2026-10-17 14:30:00",
    "synced_count": 16,
    "embedded_count": 4,
    "error": null
  }
  ```

#### `POST /api/system/ota-sync`
Manually triggers an immediate catalog audit and live embedding reconciliation pass.
- **Response `200 OK`**:
  ```json
  {
    "status": "started",
    "message": "OTA catalog & embedding sync started in background."
  }
  ```

#### `GET /api/random`
Retrieves a random anime record in **0.37ms – 0.42ms** using pre-cached in-memory rowids.
- **Response `200 OK`**: Full anime record JSON including title, score, genres, and cover URL.

#### `GET /api/search`
Off-thread typo-tolerant search powered by `rapidfuzz` against 72,758 pre-indexed tokens.
- **Query Parameters**:
  - `q` (string, optional): Title query (e.g. `frieren`, `attack on titan`)
  - `genres` (string, optional): Comma-separated genre filters (e.g. `Action,Sci-Fi`)
  - `season` (string, optional): `SPRING`, `SUMMER`, `FALL`, `WINTER`
  - `year` (int, optional): Release year
  - `status` (string, optional): `Currently Airing`, `Finished Airing`
  - `format` (string, optional): `TV`, `MOVIE`, `OVA`
  - `sort` (string, optional): `trending`, `popularity`, `score`, `title`, `date`
  - `page` (int, default: 1), `limit` (int, default: 30)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "page": 1,
    "results": [...]
  }
  ```

---

### Machine Learning Recommendations

#### `POST /api/recommend`
Executes composite multimodal recommendation against a user's library or freeform query prompts.
- **Request Body**:
  ```json
  {
    "anime_input": "Steins;Gate, Cyberpunk: Edgerunners",
    "preference": "gritty psychological sci-fi with dark plot twists",
    "plot_preference": "time travel conspiracy and dystopian technology",
    "audio_preference": "synthwave electronic soundtrack",
    "top_n": 6,
    "preferred_year": 2018,
    "use_library": false
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "recommendations": [
      {
        "mal_id": 9253,
        "title": "Steins;Gate",
        "score": 9.07,
        "similarity_score": 0.942,
        "genres": "Drama, Sci-Fi, Suspense",
        "cover_url": "http://localhost:8000/covers/9253.jpg",
        "synopsis": "..."
      }
    ]
  }
  ```

#### `GET /api/recommendations/{mal_id}`
Returns top 5 diverse recommendations similar to a specific `mal_id` in **12.8ms – 20.8ms** using zero-SQL memory catalog lookups.
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "recommendations": [
      {
        "mal_id": 16498,
        "title": "Attack on Titan",
        "title_original": "Shingeki no Kyojin",
        "score": 8.54,
        "members": 3800000,
        "genres": "Action, Drama, Suspense",
        "cover_url": "http://localhost:8000/covers/16498.jpg",
        "year": "2013",
        "episodes": 25
      }
    ]
  }
  ```

---

### Playback & Scrobbling

#### `GET /api/play`
Spawns the headless `ani-cli` and `mpv` streaming pipeline.
- **Query Parameters**:
  - `title` (string, required): Target anime title
  - `episode` (int, required): Episode index
  - `alt_title` (string, optional): Romaji or alternate title
  - `dub` (bool, default: false): Select English audio stream
  - `quality` (string, default: "best"): Resolution limit (e.g. `1080`, `720`, `best`)
  - `provider` (string, default: "anidb"): Scraper provider
  - `mal_id` (int, optional): MAL identifier for auto-scrobbling
- **Response `200 OK`**:
  ```json
  {
    "status": "playing",
    "message": "Launching player for Cowboy Bebop Episode 1"
  }
  ```

#### `GET /api/play/status`
Real-time state of the media player subprocess and socket listener.
- **Response `200 OK`**:
  ```json
  {
    "status": "playing",
    "title": "Cowboy Bebop",
    "episode": 1,
    "percent": 86.4,
    "message": "Playing episode 1"
  }
  ```

---

### User Library 2.0 & ML Taste Analytics Hub

#### `GET /api/user_library`
Returns the user's library enriched in $O(M)$ time using a zero-SQL in-memory hash join over the pre-cached anime metadata lookup table (`_anime_db_cache`).
- **Query Parameters**: `status` (optional: `Watching`, `Completed`, `Plan to Watch`, `Dropped`, `On-Hold`)
- **Enriched Output Fields**: `total_episodes`, `airing_status`, `year`, `season`, `genres`, `global_score`, `unwatched_aired_episodes`, `is_favorite`, `rewatch_count`, `started_at`, `completed_at`, `taste_match_pct`.

#### `POST /api/user_library`
Upserts a library record with smart episode clamping and auto-completion state transitions:
- If `total_episodes > 0` and `episodes_watched >= total_episodes`: automatically clamps `episodes_watched = total_episodes`, transitions `status = 'Completed'`, and records `completed_at = CURRENT_TIMESTAMP`.
- If `episodes_watched > 0` and `status == 'Plan to Watch'`: automatically transitions `status = 'Watching'` and sets `started_at = CURRENT_TIMESTAMP`.
- **Request Body**:
  ```json
  {
    "mal_id": 1,
    "status": "Watching",
    "episodes_watched": 26,
    "score": 9.5,
    "notes": "Masterpiece anime series",
    "is_favorite": 1,
    "rewatch_count": 0
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "item": {
      "mal_id": 1,
      "status": "Completed",
      "episodes_watched": 26,
      "score": 9.5,
      "notes": "Masterpiece anime series",
      "anime_title": "Cowboy Bebop",
      "is_favorite": 1,
      "rewatch_count": 0,
      "started_at": "2026-10-17 12:00:00",
      "completed_at": "2026-10-17 18:30:00"
    }
  }
  ```

#### `POST /api/user_library/batch`
Executes bulk library operations inside an atomic SQLite transaction:
- **Request Body**:
  ```json
  {
    "mal_ids": [1, 20, 52991],
    "action": "status",
    "value": "Completed"
  }
  ```
- **Supported Actions**:
  - `status`: Bulk-update status to `'Watching'`, `'Completed'`, `'On-Hold'`, `'Dropped'`, or `'Plan to Watch'`.
  - `favorite`: Bulk-toggle favorite flag (`1` or `0`).
  - `delete`: Atomically delete multiple selected records.
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "affected": 3,
    "modified": 3
  }
  ```

#### `GET /api/user_library/insights`
Computes and returns real-time Taste DNA metrics and AI Backlog Resonance rankings in `< 25ms`:
- **Backlog Prioritizer (`plan_to_watch_ranked`)**: Computes exact cosine similarities between the user's score-attenuated multimodal taste centroid ($\mathbf{c}_{\text{visual}}, \mathbf{c}_{\text{plot}}$) and all anime in `'Plan to Watch'` / `'On-Hold'`, outputting `taste_match_pct` (0–100%).
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "mean_score": 8.42,
    "score_std_dev": 0.85,
    "global_delta": 0.35,
    "critic_label": "Generous Enjoyer 😊",
    "completion_rate": 86.4,
    "total_hours_watched": 412.5,
    "era_distribution": [
      { "era": "1990s", "count": 14 },
      { "era": "2000s", "count": 48 },
      { "era": "2010s", "count": 120 },
      { "era": "2020s", "count": 65 }
    ],
    "genre_radar_data": [
      { "genre": "Action", "score": 8.6, "count": 42 },
      { "genre": "Sci-Fi", "score": 9.1, "count": 28 },
      { "genre": "Drama", "score": 8.9, "count": 35 }
    ],
    "plan_to_watch_ranked": [
      {
        "mal_id": 52991,
        "title": "Sousou no Frieren",
        "taste_match_pct": 98.4,
        "global_score": 9.32,
        "genres": "Adventure, Drama, Fantasy",
        "cover_url": "http://localhost:8000/covers/52991.jpg"
      }
    ]
  }
  ```

#### `DELETE /api/user_library/{mal_id}`
Removes an entry from the user's library.

#### `GET /api/library/export`
Exports the user library formatted as MyAnimeList-compatible XML or standard CSV.
- **Query Parameters**: `format` (`xml` | `csv`, default: `xml`)

#### `POST /api/library/import`
Imports user watchlist XML/CSV files with franchise episode-overflow resolution.
- **Form Data**: `file` (Multipart file), `overwrite` (bool)

---

### Airing Notifications

#### `GET /api/notifications`
Retrieves the 50 most recent episode release notifications.

#### `POST /api/notifications/read`
Marks notification IDs as read.
- **Request Body**: `{"notification_ids": [101, 102]}`

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

## 🧪 9-Test Automated Verification & Benchmark Suite

KyōRenzu includes a comprehensive end-to-end reliability, numerical safety, and performance benchmark test suite in [test_verification_suite.py](test_verification_suite.py). All 9 tests must pass before any production deployment:

```bash
./venv/bin/python test_verification_suite.py
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
    - Asserts mean latency < 3.0ms (Measured: 0.37ms – 0.42ms, 171.7x faster than baseline).
    -> PASS

[3] Benchmarking Off-Thread Fuzzy Search
    - Executes fuzzy queries across 72,758 strings via rapidfuzz worker.
    - Asserts mean latency < 250ms (Measured: 145.10ms, zero main event loop blocking).
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

===============================================================
     ALL VERIFICATION AND BENCHMARK TESTS PASSED (9/9)        
===============================================================
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

### Step 2: Configure Python Virtual Environment
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
# Option A: Build only the React Vite 6 Web UI (~1.4s)
npm run build:react

# Option B: Compile standalone Python binary with PyInstaller (~1.5–2 mins)
# Note: api.spec explicitly excludes unused heavy libraries (matplotlib, tkinter, tensorboard)
npm run build:python

# Option C: Package Linux .AppImage via electron-builder (requires dist/api/api)
npm run build:electron

# Option D: Full End-to-End Build (React -> PyInstaller -> AppImage)
npm run build
```

The resulting standalone executable will be generated at:
`dist/electron/KyoRenzu-1.0.0.AppImage`

---

## 🗂️ Project Directory Structure

```text
KyoRenzu/
├── api.py                     # FastAPI gateway, PGID registry, MPV IPC listener, search & library endpoints
├── api.spec                   # PyInstaller specification registering hidden imports & excluding unused packages
├── auto_selector.py           # Headless ANSI-stripping menu matcher for ani-cli automation
├── config.py                  # Thread-safe SQLite get_db_connection() helper, paths, and WAL initialization
├── recommender.py             # Multimodal ML engine: CLIP, MiniLM, CLAP, Genre Correlation, Vectorized MMR
├── input_parser.py            # User watchlist fuzzy matching and title resolution parser
├── mal_scraper.py             # Async multiprocessing scraper (AniList GraphQL -> Jikan MAL -> Kitsu)
├── main.js                    # Electron runtime, lifecycle supervisor, two-tier process teardown
├── package.json               # Root electron configuration and build scripts
├── requirements.txt           # Python backend dependencies (torch, transformers, rapidfuzz, fastapi)
├── test_verification_suite.py # Automated 9-test reliability, latency, and numerical safety benchmark suite
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

## 🛡️ Seven Mandatory Engineering Guardrails

KyōRenzu's architecture is anchored by seven non-negotiable engineering mandates:

1. **Idempotent & Episode-Aware MPV Scrobbling**: Progress listener strictly bounds database updates to once per episode launch via session-scoped `has_scrobbled` flags, incrementing with `MAX(episodes_watched, played_episode)`.
2. **Two-Tier Subprocess Teardown**: Isolates `ani-cli` in a dedicated session PGID (`os.setsid`) and guarantees teardown via Python `lifespan`/`atexit` hooks and Electron `process.kill(-pid, 'SIGTERM')`.
3. **OTA Cache Coherency**: Thread-safe `refresh_memory_caches` hook instantly propagates background AniList sync records into in-memory search choices and candidate matrices without server restart.
4. **Thread-Safe SQLite Concurrency**: `WAL` journal mode enabled globally with 5000ms busy timeouts and strictly scoped per-request/per-thread connections.
5. **Vectorized MMR Numerical Stability**: Pre-normalization norm floor ($\epsilon = 10^{-12}$) guarantees zero `NaN` contamination during dot-product matrix multiplication.
6. **Debounced Optimistic UI Updates**: Client applies optimistic UI state immediately with a 300ms trailing debounce sending exact target integers, eliminating race conditions.
7. **Guaranteed Upper-Bound Episode Clamping**: Every playback trigger (`/api/play`, quick-play buttons, modal jump inputs) and library mutation (`POST /api/user_library`, batch updates, MPV IPC listener) is strictly bounded by `Math.min(episode, total_episodes)` whenever `total_episodes > 0`. Completed titles (e.g. `19 / 19 EPS`) render `▶ Ep 19` rather than `▶ Ep 20`, guaranteeing that playback requests never exceed the canonical maximum episode limit.

---

## 📜 License & Disclaimers

Distributed under the **MIT License**. See `LICENSE` for details.

- **Educational & Portfolio Use**: KyōRenzu is designed as an architectural exploration of multimodal machine learning, process supervisor patterns, and desktop UI engineering.
- **Content Attribution**: Metadata and artwork are provided courtesy of MyAnimeList, AniList, and Kitsu. Video streaming logic is resolved dynamically at runtime on the user's host machine via `ani-cli`. KyōRenzu does not host, index, or distribute copyrighted video media.
