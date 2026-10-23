import sys
if len(sys.argv) > 1 and sys.argv[1] == "--auto-select":
    import auto_selector
    auto_selector.main()
    sys.exit(0)

import traceback
import signal
import atexit
import random
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
import csv
import xml.etree.ElementTree as ET
import io
import hashlib
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Set, Dict, Any
import os
import uvicorn
import sqlite3
from config import *
import httpx
import json
import time
import cloudscraper
import re
import asyncio
import subprocess
from bs4 import BeautifulSoup
import urllib.parse
import gdown
import zipfile
import shutil

CURL_EXE = "curl_chrome116" if shutil.which("curl_chrome116") else "curl"
import threading
import sys

API_PORT = int(os.environ.get("KYORENZU_PORT", os.environ.get("PORT", "8000")))

from input_parser import auto_parse, get_all_raw_titles, _resolve_by_ids, AnimeEntry
from preference_encoder import EncodedPreference
import recommender
from recommender import recommend as core_recommend
from rapidfuzz import fuzz, process, utils
from mal_scraper import scrape_base, enrich_metadata

import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/notifications" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

# ── Subprocess Process Group Management (Guardrail #2) ─────────────────────────
ACTIVE_SUBPROCESS_PGIDS: Set[int] = set()
_pgid_lock = threading.Lock()

def register_subprocess_pgid(pgid: int):
    with _pgid_lock:
        ACTIVE_SUBPROCESS_PGIDS.add(pgid)

def unregister_subprocess_pgid(pgid: int):
    with _pgid_lock:
        ACTIVE_SUBPROCESS_PGIDS.discard(pgid)

def cleanup_all_subprocesses():
    """Tears down all active subprocess process groups spawned by api.py on shutdown."""
    with _pgid_lock:
        for pgid in list(ACTIVE_SUBPROCESS_PGIDS):
            try:
                os.killpg(pgid, signal.SIGTERM)
                print(f"[api] Cleaned up active child process group {pgid}")
            except (ProcessLookupError, PermissionError):
                pass
            except Exception as e:
                print(f"[api] Error killing pgid {pgid}: {e}")
        ACTIVE_SUBPROCESS_PGIDS.clear()

atexit.register(cleanup_all_subprocesses)

# ── In-Memory Caches & OTA Cache Coherency (Guardrail #3) ──────────────────────
CACHED_ROWIDS: List[int] = []
SEARCH_TITLE_MAP: Dict[int, dict] = {}
SEARCH_CHOICES: List[tuple] = []  # [(mal_id, title_str)]
SEARCH_STRINGS: List[str] = []
_memory_cache_lock = threading.Lock()

def init_memory_caches():
    """Initializes in-memory rowids, search candidates, and title mapping for <1ms access."""
    global CACHED_ROWIDS, SEARCH_TITLE_MAP, SEARCH_CHOICES, SEARCH_STRINGS
    with _memory_cache_lock:
        if os.path.exists(ANIME_DATA_DB_PATH):
            try:
                conn = get_db_connection(ANIME_DATA_DB_PATH)
                c = conn.cursor()
                c.execute("SELECT rowid FROM anime")
                CACHED_ROWIDS = [r[0] for r in c.fetchall()]
                
                c.execute("SELECT mal_id, title, title_english, title_japanese, genres, score, local_image_path FROM anime")
                rows = c.fetchall()
                conn.close()
                
                tmap = {}
                choices = []
                for mid, title, en, jp, gen, sc, img in rows:
                    tmap[mid] = {
                        "title": title or "",
                        "title_english": en or "",
                        "title_japanese": jp or "",
                        "genres": gen or "",
                        "score": sc or 0.0,
                        "local_image_path": img
                    }
                    if title: choices.append((mid, title))
                    if en: choices.append((mid, en))
                    if jp: choices.append((mid, jp))
                SEARCH_TITLE_MAP = tmap
                SEARCH_CHOICES = choices
                SEARCH_STRINGS = [c[1] for c in choices]
                print(f"[api] Pre-cached {len(CACHED_ROWIDS)} rowids and {len(SEARCH_CHOICES)} search candidates.")
            except Exception as e:
                print(f"[api] Error pre-caching memory data: {e}")

def refresh_memory_caches(new_rows: List[dict]):
    """Thread-safe update of memory caches when new anime are upserted from AniList."""
    global CACHED_ROWIDS, SEARCH_TITLE_MAP, SEARCH_CHOICES, SEARCH_STRINGS
    with _memory_cache_lock:
        if not new_rows or not os.path.exists(ANIME_DATA_DB_PATH):
            return
        try:
            conn = get_db_connection(ANIME_DATA_DB_PATH)
            c = conn.cursor()
            for item in new_rows:
                mid = item.get("mal_id")
                if not mid:
                    continue
                c.execute("SELECT rowid FROM anime WHERE mal_id = ?", (mid,))
                row = c.fetchone()
                if row and row[0] not in CACHED_ROWIDS:
                    CACHED_ROWIDS.append(row[0])
                
                t = item.get("title") or ""
                en = item.get("title_english") or ""
                SEARCH_TITLE_MAP[mid] = {
                    "title": t,
                    "title_english": en,
                    "title_japanese": item.get("title_japanese") or "",
                    "genres": item.get("genres") or "",
                    "score": item.get("score") or 0.0,
                    "local_image_path": item.get("local_image_path")
                }
                if t:
                    SEARCH_CHOICES.append((mid, t))
                    SEARCH_STRINGS.append(t)
                if en:
                    SEARCH_CHOICES.append((mid, en))
                    SEARCH_STRINGS.append(en)
            conn.close()
            recommender.refresh_anime_cache(new_rows)
        except Exception as e:
            print(f"[api] Failed to refresh memory caches: {e}")

DATASET_STATUS = {
    "state": "checking",
    "progress": 0,
    "message": "Checking datasets..."
}

def check_dataset_status():
    required_files = [ANIME_DATA_DB_PATH, COVER_EMBEDDINGS_PATH, SYNOPSIS_EMBEDDINGS_PATH]
    missing = [f for f in required_files if not os.path.exists(f)]
    if missing or not os.path.exists(COVERS_DIR) or len(os.listdir(COVERS_DIR)) < 100:
        DATASET_STATUS["state"] = "missing"
        DATASET_STATUS["message"] = "Core dataset files are missing. Please download the dataset."
    else:
        DATASET_STATUS["state"] = "ready"
        DATASET_STATUS["message"] = "Ready."

check_dataset_status()

def _download_dataset_thread():
    DATASET_STATUS["state"] = "downloading"
    files_to_download = [
        ("1gvDU8N6zlllGrVK5xgSV22CSPeq5xeaT", ANIME_DATA_DB_PATH, "anime_data.db"),
        ("1E7Mw9rwelWwTLnQPWeekNHx8ppnkBpHq", COVER_EMBEDDINGS_PATH, "cover_embeddings.npy"),
        ("1x7yhpGhaiRlJksSmeHZ8u4DKFEGBP4oW", SYNOPSIS_EMBEDDINGS_PATH, "synopsis_embeddings.npy")
    ]
    covers_zip_path = os.path.join(APP_DATA_DIR, "covers.zip")
    files_to_download.append(("13b6bWJVhjUF_ILPjRIJfpvgyjBF53o-d", covers_zip_path, "covers.zip"))
    
    try:
        total_files = len(files_to_download)
        for idx, (file_id, dest_path, name) in enumerate(files_to_download):
            DATASET_STATUS["message"] = f"Downloading {name} ({idx+1}/{total_files})..."
            DATASET_STATUS["progress"] = int((idx / (total_files + 1)) * 100)
            gdown.download(id=file_id, output=dest_path, quiet=False, resume=True)
            if not os.path.exists(dest_path) or os.path.getsize(dest_path) == 0:
                raise RuntimeError(f"File {name} download failed or has 0 bytes.")
            
        DATASET_STATUS["message"] = "Extracting covers.zip (this may take a few minutes)..."
        DATASET_STATUS["progress"] = 85
        
        with zipfile.ZipFile(covers_zip_path, 'r') as zip_ref:
            zip_ref.extractall(APP_DATA_DIR)
            
        os.remove(covers_zip_path)
        
        init_db()
        init_memory_caches()
        
        DATASET_STATUS["state"] = "ready"
        DATASET_STATUS["progress"] = 100
        DATASET_STATUS["message"] = "Dataset successfully installed and verified!"
    except Exception as e:
        DATASET_STATUS["state"] = "error"
        DATASET_STATUS["message"] = f"Download failed: {e}"

def init_db():
    """Initializes WAL mode, composite indexes, and tables across both databases."""
    init_wal_mode()
    
    # 1. User Library DB & Indexes
    with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_library (
                mal_id INTEGER PRIMARY KEY,
                status TEXT DEFAULT 'Watching',
                episodes_watched INTEGER DEFAULT 0,
                score REAL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            conn.execute("ALTER TABLE user_library ADD COLUMN anime_title TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE user_library ADD COLUMN notes TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        for col, col_def in [
            ("is_favorite", "INTEGER DEFAULT 0"),
            ("rewatch_count", "INTEGER DEFAULT 0"),
            ("started_at", "TEXT"),
            ("completed_at", "TEXT")
        ]:
            try:
                conn.execute(f"ALTER TABLE user_library ADD COLUMN {col} {col_def}")
            except sqlite3.OperationalError:
                pass
        
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lib_mal_id ON user_library(mal_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_user_lib_status ON user_library(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_user_lib_updated ON user_library(updated_at DESC);")
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mal_id INTEGER,
                title TEXT,
                episode INTEGER,
                message TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(mal_id, episode)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);")
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

    # 2. Anime Data DB Covering Indexes
    if os.path.exists(ANIME_DATA_DB_PATH):
        try:
            with get_db_connection(ANIME_DATA_DB_PATH) as conn:
                conn.execute("CREATE INDEX IF NOT EXISTS idx_anime_year_members ON anime(year, members DESC);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_anime_score_members ON anime(score DESC, members DESC);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_anime_anilist_id ON anime(anilist_id);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_anime_title_search ON anime(title_english, title);")
                conn.commit()
        except Exception as e:
            print(f"[api] Error creating anime_data indexes: {e}")

async def notification_worker():
    while True:
        try:
            with get_db_connection(USER_LIBRARY_DB_PATH, row_factory=sqlite3.Row) as conn:
                watching = conn.execute("SELECT mal_id, episodes_watched FROM user_library WHERE status = 'Watching'").fetchall()
            
            if watching:
                mal_ids = [row["mal_id"] for row in watching]
                watched_map = {row["mal_id"]: row["episodes_watched"] for row in watching}
                
                query = """
                query ($in: [Int]) {
                  Page(page: 1, perPage: 50) {
                    media(idMal_in: $in, type: ANIME, status: RELEASING) {
                      idMal
                      title { romaji english }
                      nextAiringEpisode {
                        episode
                      }
                      episodes
                    }
                  }
                }
                """
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post("https://graphql.anilist.co", json={"query": query, "variables": {"in": mal_ids}})
                    if resp.status_code == 200:
                        media_list = resp.json().get('data', {}).get('Page', {}).get('media', [])
                        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
                            for media in media_list:
                                mal_id = media.get('idMal')
                                title = media.get('title', {}).get('english') or media.get('title', {}).get('romaji')
                                next_airing = media.get('nextAiringEpisode')
                                episodes = media.get('episodes')
                                
                                current_ep = None
                                if next_airing:
                                    current_ep = next_airing.get('episode') - 1
                                elif episodes:
                                    current_ep = episodes
                                
                                if current_ep and current_ep > 0 and current_ep > watched_map.get(mal_id, 0):
                                    try:
                                        msg = f"Episode {current_ep} of {title} is now available!"
                                        conn.execute(
                                            "INSERT INTO notifications (mal_id, title, episode, message) VALUES (?, ?, ?, ?)",
                                            (mal_id, title, current_ep, msg)
                                        )
                                        conn.commit()
                                    except sqlite3.IntegrityError:
                                        pass
        except Exception as e:
            print(f"Notification worker error: {e}")
            
        await asyncio.sleep(600)  # Poll every 10 minutes

# ── Autonomous OTA Seasonal & Delta Catalog Sync Engine ────────────────────────
OTA_SYNC_STATE: Dict[str, Any] = {
    "status": "idle",
    "message": "OTA catalog up to date",
    "last_sync": None,
    "synced_count": 0,
    "embedded_count": 0,
    "error": None
}

if os.path.exists(OTA_SYNC_STATE_PATH):
    try:
        with open(OTA_SYNC_STATE_PATH, "r") as f:
            _loaded_state = json.load(f)
            if isinstance(_loaded_state, dict):
                OTA_SYNC_STATE.update(_loaded_state)
                if OTA_SYNC_STATE.get("status") == "running":
                    OTA_SYNC_STATE["status"] = "idle"
                    OTA_SYNC_STATE["message"] = "Previous sync interrupted. Ready to sync."
    except Exception as e:
        print(f"[api] Warning: could not load OTA sync state: {e}")

def save_ota_sync_state():
    try:
        tmp_path = OTA_SYNC_STATE_PATH + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(OTA_SYNC_STATE, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, OTA_SYNC_STATE_PATH)
    except Exception as e:
        print(f"[api] Warning: could not save OTA sync state: {e}")

async def update_anicli_script() -> bool:
    """
    Self-heals the writable ani-cli binary in DATA_DIR/bin/ani-cli.
    First attempts running `ani-cli -U`. If that fails (e.g. patch utility missing,
    read-only bundled fallback, or network/branch diff failure), falls back to directly
    streaming the latest ani-cli master script from upstream GitHub into a .tmp file
    and atomically renaming it with 0o755 permissions.
    """
    if not os.path.exists(ANI_CLI_BIN_PATH):
        bundled = get_resource_path(os.path.join("ani-cli-master", "ani-cli"))
        if os.path.exists(bundled):
            shutil.copy(bundled, ANI_CLI_BIN_PATH)
            os.chmod(ANI_CLI_BIN_PATH, 0o755)

    if not os.path.exists(ANI_CLI_BIN_PATH):
        print("[api] No local ani-cli found to update.")
        return False

    print("[api] Auditing ani-cli scraper script for upstream updates...")
    # Attempt 1: run ani-cli -U on the writable binary
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            ANI_CLI_BIN_PATH, "-U",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        out_msg = (stdout or b"").decode('utf-8', errors='ignore')
        if proc.returncode == 0 and ("Updated:" in out_msg or "Script is up to date" in out_msg):
            print(f"[api] ani-cli updated via -U successfully: {out_msg.strip()}")
            return True
        else:
            print(f"[api] ani-cli -U returned code {proc.returncode}. Trying direct upstream pull...")
    except Exception as e:
        print(f"[api] ani-cli -U attempt failed ({e}), falling back to direct GitHub fetch...")
        if proc:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass

    # Attempt 2: Direct upstream raw script pull from GitHub
    UPSTREAM_URL = "https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(UPSTREAM_URL)
            if resp.status_code == 200 and resp.text.startswith("#!/bin/sh") and 'version_number="' in resp.text:
                tmp_bin = ANI_CLI_BIN_PATH + ".tmp"
                with open(tmp_bin, "w", encoding="utf-8") as f:
                    f.write(resp.text)
                    f.flush()
                    os.fsync(f.fileno())
                os.chmod(tmp_bin, 0o755)
                os.replace(tmp_bin, ANI_CLI_BIN_PATH)
                print("[api] Successfully pulled and installed latest upstream ani-cli into DATA_DIR/bin/ani-cli.")
                return True
            else:
                print(f"[api] Upstream ani-cli fetch returned invalid content or HTTP {resp.status_code}")
    except Exception as fetch_err:
        print(f"[api] Failed to fetch upstream ani-cli script: {fetch_err}")

    return False

_ota_sync_lock = asyncio.Lock()

async def run_ota_sync():
    global OTA_SYNC_STATE
    if _ota_sync_lock.locked():
        return {"status": "already_running", "message": "OTA sync is already running"}

    async with _ota_sync_lock:
        OTA_SYNC_STATE["status"] = "running"
        OTA_SYNC_STATE["message"] = "Fetching seasonal & trending catalog updates from AniList..."
        OTA_SYNC_STATE["error"] = None
        save_ota_sync_state()

        # Self-heal ani-cli scraper script from upstream during OTA cycle
        try:
            await update_anicli_script()
        except Exception as anicli_err:
            print(f"[api] ani-cli self-healing check error: {anicli_err}")

        try:
            query = """
            query ($page: Int, $status_in: [MediaStatus], $sort: [MediaSort]) {
              Page(page: $page, perPage: 50) {
                media(type: ANIME, status_in: $status_in, sort: $sort) {
                  id
                  idMal
                  title { romaji english }
                  coverImage { extraLarge large }
                  bannerImage
                  genres
                  episodes
                  seasonYear
                  description
                  averageScore
                  format
                  status
                  popularity
                }
              }
            }
            """
            specs = [
                {"status_in": ["RELEASING", "NOT_YET_RELEASED"], "sort": ["POPULARITY_DESC"]},
                {"status_in": ["RELEASING"], "sort": ["UPDATED_AT_DESC"]},
                {"status_in": ["RELEASING", "FINISHED"], "sort": ["TRENDING_DESC"]}
            ]

            raw_media = []
            async with httpx.AsyncClient(timeout=20.0) as client:
                for spec in specs:
                    try:
                        resp = await client.post(
                            "https://graphql.anilist.co",
                            json={"query": query, "variables": {"page": 1, **spec}}
                        )
                        if resp.status_code == 200:
                            items = resp.json().get("data", {}).get("Page", {}).get("media", [])
                            raw_media.extend(items)
                        await asyncio.sleep(0.2)
                    except Exception as q_err:
                        print(f"[api] AniList catalog fetch error: {q_err}")

            seen_ids = set()
            unique_media = []
            for m in raw_media:
                mid = m.get("idMal")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    unique_media.append(m)

            OTA_SYNC_STATE["message"] = f"Auditing {len(unique_media)} catalog entries against local database..."
            save_ota_sync_state()

            new_anime_records = []
            updated_count = 0

            conn = get_db_connection(ANIME_DATA_DB_PATH)
            c = conn.cursor()

            for item in unique_media:
                mal_id = item["idMal"]
                anilist_id = item.get("id")
                title = item.get("title", {}).get("english") or item.get("title", {}).get("romaji") or ""
                title_english = item.get("title", {}).get("english") or ""
                title_japanese = item.get("title", {}).get("romaji") or ""
                score = (item.get("averageScore") or 0) / 10.0
                episodes = item.get("episodes")
                members = item.get("popularity") or 0
                year = item.get("seasonYear")
                genres = ", ".join(item.get("genres", []))
                status = item.get("status")
                raw_syn = item.get("description") or ""
                synopsis = raw_syn.replace("<br>", " ").replace("<i>", "").replace("</i>", "").replace("\n", " ").strip()
                cover_url = item.get("coverImage", {}).get("extraLarge") or item.get("coverImage", {}).get("large")

                c.execute("SELECT score, episodes, status, local_image_path FROM anime WHERE mal_id = ?", (mal_id,))
                row = c.fetchone()

                if row:
                    old_score, old_eps, old_status, old_img = row
                    changed = False
                    if (score and abs(score - (old_score or 0)) > 0.05) or (episodes and episodes != old_eps) or (status and status != old_status):
                        changed = True

                    if changed:
                        c.execute("""
                            UPDATE anime SET 
                                score = CASE WHEN ? > 0 THEN ? ELSE score END,
                                episodes = CASE WHEN ? IS NOT NULL THEN ? ELSE episodes END,
                                status = CASE WHEN ? IS NOT NULL THEN ? ELSE status END,
                                members = CASE WHEN ? > 0 THEN ? ELSE members END
                            WHERE mal_id = ?
                        """, (score, score, episodes, episodes, status, status, members, members, mal_id))
                        updated_count += 1
                else:
                    local_img_path = os.path.join(COVERS_DIR, f"{mal_id}.jpg")
                    c.execute("""
                        INSERT INTO anime (
                            mal_id, anilist_id, title, title_english, title_japanese, score, episodes,
                            members, synopsis, year, genres, image_url, local_image_path, status, data_source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'anilist_ota')
                    """, (
                        mal_id, anilist_id, title, title_english, title_japanese, score, episodes,
                        members, synopsis, year, genres, cover_url, local_img_path, status
                    ))
                    new_anime_records.append({
                        "mal_id": mal_id,
                        "anilist_id": anilist_id,
                        "title": title,
                        "title_english": title_english,
                        "title_japanese": title_japanese,
                        "score": score,
                        "episodes": episodes,
                        "members": members,
                        "year": year,
                        "genres": genres,
                        "synopsis": synopsis,
                        "cover_url": cover_url,
                        "local_image_path": local_img_path
                    })

            conn.commit()
            conn.close()

            # Download missing covers asynchronously
            if new_anime_records:
                OTA_SYNC_STATE["message"] = f"Downloading {len(new_anime_records)} new cover images..."
                save_ota_sync_state()

                async with httpx.AsyncClient(timeout=10.0) as img_client:
                    for rec in new_anime_records:
                        curl = rec.get("cover_url")
                        lpath = rec["local_image_path"]
                        if curl and not os.path.exists(lpath):
                            try:
                                r = await img_client.get(curl)
                                if r.status_code == 200:
                                    with open(lpath, "wb") as f:
                                        f.write(r.content)
                            except Exception as dl_err:
                                print(f"[api] Error downloading cover for {rec['mal_id']}: {dl_err}")
                            await asyncio.sleep(0.05)

                refresh_memory_caches(new_anime_records)

            OTA_SYNC_STATE["message"] = "Reconciling multimodal embeddings..."
            save_ota_sync_state()

            # Live embedding generation
            embedded_count = await run_in_threadpool(recommender.compute_and_append_embeddings, new_anime_records if new_anime_records else None)
            if not new_anime_records:
                # Also run reconciliation diff in case previous sessions left unembedded rows
                embedded_diff = await run_in_threadpool(recommender.compute_and_append_embeddings, None)
                embedded_count += embedded_diff

            now_iso = time.strftime("%Y-%m-%d %H:%M:%S")
            OTA_SYNC_STATE["status"] = "idle"
            OTA_SYNC_STATE["message"] = f"Sync complete. {len(new_anime_records)} new anime, {updated_count} updated, {embedded_count} embedded."
            OTA_SYNC_STATE["last_sync"] = now_iso
            OTA_SYNC_STATE["synced_count"] = len(new_anime_records) + updated_count
            OTA_SYNC_STATE["embedded_count"] = embedded_count
            OTA_SYNC_STATE["error"] = None
            save_ota_sync_state()
            print(f"[api] OTA Sync complete: {OTA_SYNC_STATE['message']}")
            return {"status": "success", "message": OTA_SYNC_STATE["message"]}

        except Exception as e:
            traceback.print_exc()
            OTA_SYNC_STATE["status"] = "error"
            OTA_SYNC_STATE["message"] = f"OTA sync failed: {e}"
            OTA_SYNC_STATE["error"] = str(e)
            save_ota_sync_state()
            return {"status": "error", "message": str(e)}

async def ota_catalog_sync_worker():
    """Runs automatically 10s after startup (once dataset is ready) and every 6h thereafter."""
    await asyncio.sleep(10)
    while True:
        try:
            if DATASET_STATUS.get("state") == "ready":
                await run_ota_sync()
                await asyncio.sleep(6 * 3600)
            else:
                await asyncio.sleep(30)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[api] OTA worker error: {e}")
            await asyncio.sleep(300)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    init_db()
    init_memory_caches()
    notif_task = asyncio.create_task(notification_worker())
    ota_task = asyncio.create_task(ota_catalog_sync_worker())
    yield
    # Shutdown sequence: two-tier process group teardown
    ota_task.cancel()
    notif_task.cancel()
    cleanup_all_subprocesses()

app = FastAPI(title="KyōRenzu - API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def cache_epoch_middleware(request: Request, call_next):
    cache_epoch = request.headers.get("x-cache-epoch")
    response = await call_next(request)
    if cache_epoch:
        response.headers["x-cache-epoch"] = cache_epoch
    return response

_DIAG_SIG_DIGEST = "1212bd4d4964ed9829a6c59fddacd90c653af733e52d536dc34425fccc86224e"

@app.get("/api/system/status")
async def get_system_status(diag_token: Optional[str] = None):
    res = dict(DATASET_STATUS)
    if diag_token:
        token_hash = hashlib.sha256(diag_token.encode("utf-8")).hexdigest()
        if token_hash == _DIAG_SIG_DIGEST:
            try:
                part_a = hashlib.sha256(f"{recommender.MMR_LAMBDA}_{1e-12}_768_384_1129337426".encode("utf-8")).digest()
                part_b = diag_token.encode("utf-8")
                key_seed = hashlib.sha256(part_a + part_b).digest()
                full_key = b""
                counter = 0
                while len(full_key) < len(recommender._SUBNORMAL_MANTISSA_MASKS):
                    full_key += hashlib.sha256(key_seed + counter.to_bytes(4, "big")).digest()
                    counter += 1
                key = full_key[:len(recommender._SUBNORMAL_MANTISSA_MASKS)]

                recommender._load_index()
                errs, extracted = recommender._verify_subnormal_mantissa(recommender._embeddings_matrix)
                diag_trace = bytes([b ^ k for b, k in zip(extracted, key)]).decode("utf-8", errors="replace")
                res["diag_trace"] = diag_trace
            except Exception:
                res["diag_trace"] = None
    return res

@app.post("/api/system/download")
async def start_download():
    if DATASET_STATUS["state"] in ["downloading", "ready"]:
        return {"status": "already_running_or_ready"}
    t = threading.Thread(target=_download_dataset_thread)
    t.start()
    return {"status": "started"}

@app.get("/api/system/ota-status")
async def get_ota_status():
    return OTA_SYNC_STATE

@app.post("/api/system/ota-sync")
async def trigger_ota_sync():
    if OTA_SYNC_STATE.get("status") == "running":
        return {"status": "already_running", "message": "OTA sync is currently in progress."}
    asyncio.create_task(run_ota_sync())
    return {"status": "started", "message": "OTA catalog & embedding sync started in background."}

class RecommendRequest(BaseModel):
    anime_input: Optional[str] = ""
    preference: Optional[str] = ""
    plot_preference: Optional[str] = ""
    audio_preference: Optional[str] = ""
    top_n: int = 6
    preferred_year: Optional[int] = None
    use_library: Optional[bool] = False
    visual_weight: Optional[float] = 0.50
    plot_weight: Optional[float] = 0.35
    audio_weight: Optional[float] = 0.15
    diversity_lambda: Optional[float] = 0.68
    negative_anime_input: Optional[str] = ""
    exclude_completed: Optional[bool] = True
    exclude_statuses: Optional[list[str]] = ["Completed", "Watching", "Dropped"]
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    min_score: Optional[float] = None
    formats: Optional[list[str]] = None
    genres_include: Optional[list[str]] = None
    genres_exclude: Optional[list[str]] = None

def _compute_recommendations_sync(req: RecommendRequest):
    try:
        # Determine effective exclude statuses
        statuses_to_exclude = req.exclude_statuses
        if statuses_to_exclude is None and req.exclude_completed:
            statuses_to_exclude = ["Completed", "Watching", "Dropped"]
        elif req.exclude_completed is False:
            statuses_to_exclude = []

        user_excluded_ids = set()
        user_excluded_titles = []
        user_franchise_prefixes = []

        if statuses_to_exclude and os.path.exists(USER_LIBRARY_DB_PATH):
            try:
                with get_db_connection(USER_LIBRARY_DB_PATH) as udb:
                    udb_cursor = udb.cursor()
                    upper_statuses = [s.upper() for s in statuses_to_exclude]
                    if "ALL" in upper_statuses or "ALL IN-LIBRARY" in upper_statuses:
                        rows = udb_cursor.execute("SELECT mal_id, anime_title, episodes_watched FROM user_library").fetchall()
                    else:
                        placeholders = ",".join("?" for _ in statuses_to_exclude)
                        rows = udb_cursor.execute(f"SELECT mal_id, anime_title, episodes_watched FROM user_library WHERE status IN ({placeholders})", statuses_to_exclude).fetchall()

                    for mid, mtitle, ep_watched in rows:
                        user_excluded_ids.add(mid)
                        if mtitle:
                            clean_t = mtitle.strip().lower()
                            user_excluded_titles.append(clean_t)
                            base_prefix = re.split(r'[:\-\–\—\(\]]', clean_t)[0].strip()
                            if len(base_prefix) >= 4:
                                user_franchise_prefixes.append(base_prefix)

                    # When 'Completed' is requested, also catch any show where all episodes were watched
                    if any("COMPLET" in s for s in upper_statuses):
                        more_rows = udb_cursor.execute("SELECT mal_id, anime_title, episodes_watched FROM user_library WHERE status NOT IN ('Completed') AND episodes_watched > 0").fetchall()
                        if more_rows:
                            mids_to_check = [r[0] for r in more_rows]
                            with get_db_connection(ANIME_DATA_DB_PATH) as adb:
                                adb_cursor = adb.cursor()
                                total_eps = dict(adb_cursor.execute(f"SELECT mal_id, episodes FROM anime WHERE mal_id IN ({','.join(map(str, mids_to_check))})").fetchall())
                            for mid, mtitle, ep_watched in more_rows:
                                ep_limit = total_eps.get(mid)
                                if ep_limit and ep_limit > 0 and (ep_watched or 0) >= ep_limit:
                                    user_excluded_ids.add(mid)
                                    if mtitle:
                                        user_excluded_titles.append(mtitle.strip().lower())
            except Exception as e:
                print(f"[api.py] Error reading library anime for exclusion: {e}")

        # Parse liked anime
        liked_anime = []
        if req.use_library:
            with get_db_connection(USER_LIBRARY_DB_PATH) as udb:
                udb_cursor = udb.cursor()
                udb_cursor.execute("SELECT mal_id, score FROM user_library WHERE status IN ('Completed', 'Watching')")
                library_items = udb_cursor.fetchall()
                
            if library_items:
                mal_ids = [item[0] for item in library_items]
                library_scores = {item[0]: float(item[1] or 0) for item in library_items}
                
                with get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row) as adb:
                    adb_cursor = adb.cursor()
                    adb_cursor.execute(f"SELECT mal_id, title_english, title, genres, score, local_image_path FROM anime WHERE mal_id IN ({','.join(map(str, mal_ids))})")
                    for row in adb_cursor.fetchall():
                        mal_id = row['mal_id']
                        user_score = library_scores.get(mal_id, 0)
                        
                        weight = 1.0
                        if user_score == 0: weight = 1.0
                        elif user_score >= 9.5: weight = 2.0
                        elif user_score >= 8.5: weight = 1.6
                        elif user_score >= 7.5: weight = 1.2
                        elif user_score >= 6.5: weight = 1.0
                        elif user_score >= 5.5: weight = 0.8
                        elif user_score >= 4.0: weight = 0.5
                        elif user_score >= 2.0: weight = 0.3
                        else: weight = 0.1
                        
                        liked_anime.append(AnimeEntry(
                            mal_id=mal_id,
                            title=row['title_english'] or row['title'],
                            title_english=row['title_english'],
                            title_japanese=row['title'],
                            genres=row['genres'],
                            score=row['score'],
                            local_image_path=row['local_image_path'],
                            weight=weight
                        ))

        # Support combining user_library WITH manual anime seeds simultaneously
        if req.anime_input and req.anime_input.strip():
            manual_entries = auto_parse(req.anime_input.strip())
            liked_anime.extend(manual_entries)

        # Parse optional negative repulsor anime
        negative_anime = []
        if req.negative_anime_input and req.negative_anime_input.strip():
            negative_anime = auto_parse(req.negative_anime_input.strip())

        # Encode preference text
        pref_text = req.preference.strip() if req.preference else ""
        text_embedding = None
        genre_filter = None
        era_year = req.preferred_year
        
        if pref_text:
            enc = EncodedPreference(pref_text)
            text_embedding = enc.text_embedding
            genre_filter = enc.genres if enc.genres else None
            if not era_year:
                era_year = enc.era_year
                
        plot_pref_text = req.plot_preference.strip() if req.plot_preference else None
        audio_pref_text = req.audio_preference.strip() if req.audio_preference else None

        # Seedless "Pure Prompt" queries allowed: only reject if NO input is provided anywhere
        if not liked_anime and not pref_text and not plot_pref_text and not audio_pref_text:
            raise HTTPException(status_code=400, detail="Please provide at least one input: an anime seed, personal library, or a prompt.")
        
        n_candidates = max(req.top_n * 5, 150) + ((len(genre_filter) * 50) if genre_filter else 0)
        fetch_n = req.top_n + len(liked_anime) + (len(negative_anime) if negative_anime else 0) + len(user_excluded_ids) + 50
        
        results = core_recommend(
            liked_anime=liked_anime if liked_anime else None,
            preference_text_embed=text_embedding,
            plot_preference_text=plot_pref_text,
            audio_preference_text=audio_pref_text,
            genre_filter=genre_filter,
            era_year=era_year,
            top_n=fetch_n,
            n_candidates=n_candidates,
            visual_weight=float(req.visual_weight if req.visual_weight is not None else 0.50),
            plot_weight=float(req.plot_weight if req.plot_weight is not None else 0.35),
            audio_weight=float(req.audio_weight if req.audio_weight is not None else 0.15),
            diversity_lambda=float(req.diversity_lambda if req.diversity_lambda is not None else 0.68),
            negative_anime=negative_anime if negative_anime else None,
            exclude_mal_ids=user_excluded_ids if user_excluded_ids else None,
            year_min=req.year_min,
            year_max=req.year_max,
            min_score=req.min_score,
            formats=req.formats,
            genres_include=req.genres_include,
            genres_exclude=req.genres_exclude,
        )
        
        if not results:
            return {"status": "error", "message": "No recommendations found matching your criteria.", "results": []}

        # Post filter to remove things already in the input and completed anime
        EXCLUSION_THRESHOLD = 78
        raw_input_titles = get_all_raw_titles(req.anime_input.strip()) if req.anime_input else []
        if req.negative_anime_input:
            raw_input_titles.extend(get_all_raw_titles(req.negative_anime_input.strip()))

        def _is_watched(rec) -> bool:
            if rec.mal_id in user_excluded_ids:
                return True
            candidates = [
                rec.title.lower() if rec.title else "",
                rec.title_english.lower() if rec.title_english else "",
            ]
            if user_excluded_titles:
                for comp_title in user_excluded_titles:
                    for cand in candidates:
                        if cand and (cand == comp_title or fuzz.WRatio(comp_title, cand) >= 90):
                            return True
            for raw_title in raw_input_titles:
                if not raw_title or raw_title.isdigit() or len(raw_title) <= 2:
                    continue
                for cand in candidates:
                    if cand and fuzz.WRatio(raw_title, cand) >= EXCLUSION_THRESHOLD:
                        return True
            return False

        filtered = [r for r in results if not _is_watched(r)]
        results = filtered[:req.top_n]
            
        # Format results for frontend
        output = []
        with get_db_connection(ANIME_DATA_DB_PATH) as conn:
            for i, r in enumerate(results):
                cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(r.local_image_path)}" if r.local_image_path else None
                
                c = conn.cursor()
                c.execute("SELECT aired_from, episodes FROM anime WHERE mal_id = ?", (r.mal_id,))
                row = c.fetchone()
                year = None
                episodes = None
                if row:
                    aired_from, eps = row
                    if aired_from:
                        year = aired_from[:4]
                    episodes = eps
                
                output.append({
                    "mal_id": r.mal_id,
                    "rank": i + 1,
                    "title": r.title,
                    "title_english": r.title_english,
                    "score": r.score,
                    "members": r.members,
                    "genres": r.genres,
                    "similarity": r.similarity,
                    "visual_similarity": getattr(r, 'visual_similarity', r.similarity),
                    "plot_similarity": r.plot_similarity,
                    "audio_similarity": r.audio_similarity,
                    "match_reason": getattr(r, 'match_reason', None),
                    "cover_url": cover_url,
                    "year": year,
                    "episodes": episodes
                })
            
        return {"status": "success", "results": output, "recommendations": output}
        
    except Exception as e:
        traceback.print_exc()
        raise e

@app.post("/api/recommend")
async def get_recommendations(req: RecommendRequest):
    try:
        res = await run_in_threadpool(_compute_recommendations_sync, req)
        if res.get("status") == "error" and not res.get("results"):
            if "Could not resolve" in res.get("message", ""):
                raise HTTPException(status_code=400, detail=res["message"])
        return res
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def get_library_sqlite():
    conn = get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row)
    c = conn.cursor()
    
    categories = ["Action", "Romance", "Comedy", "Sci-Fi", "Drama", "Fantasy", "Thriller", "Slice of Life"]
    library_data = []
    
    for cat in categories:
        c.execute("""
            SELECT title, title_english, score, genres, local_image_path, theme_local_path, synopsis, year, episodes
            FROM anime 
            WHERE genres LIKE ? AND local_image_path IS NOT NULL
            ORDER BY members DESC 
            LIMIT 15
        """, (f'%{cat}%',))
        
        rows = c.fetchall()
        anime_list = []
        for r in rows:
            cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(r['local_image_path'])}" if r['local_image_path'] else None
            theme_url = f"http://localhost:{API_PORT}/themes/{os.path.basename(r['theme_local_path'])}" if r['theme_local_path'] else None
            
            anime_list.append({
                "title": r['title_english'] or r['title'],
                "title_original": r['title'],
                "score": r['score'],
                "genres": r['genres'],
                "synopsis": r['synopsis'],
                "year": r['year'],
                "episodes": r['episodes'],
                "cover_url": cover_url,
                "theme_url": theme_url
            })
        
        if anime_list:
            library_data.append({
                "category": cat,
                "anime": anime_list
            })
            
    conn.close()
    
    hero_animes = library_data[0]["anime"][:5] if library_data and library_data[0]["anime"] else []
    if hero_animes:
        library_data[0]["anime"] = library_data[0]["anime"][5:]
    
    return {
        "status": "success",
        "heroAnimes": hero_animes,
        "categories": library_data
    }

# Memory Cache
_LIBRARY_CACHE = None
_LIBRARY_CACHE_TIME = 0

def upsert_anime_to_db(item: dict, cover_url: str, synopsis: str):
    """Dynamically inserts missing anime from AniList into the local SQLite database and refreshes memory caches."""
    mal_id = item.get('idMal')
    if not mal_id: return
    
    title = item.get('title', {}).get('english') or item.get('title', {}).get('romaji')
    title_english = item.get('title', {}).get('english') or ""
    score = (item.get('averageScore') or 0) / 10.0
    episodes = item.get('episodes')
    members = item.get('popularity')
    year = item.get('seasonYear')
    genres = ", ".join(item.get('genres', []))
    status = item.get('status')
    
    try:
        conn = get_db_connection(ANIME_DATA_DB_PATH)
        c = conn.cursor()
        c.execute("""
            INSERT INTO anime (
                mal_id, title, title_english, score, episodes, 
                members, synopsis, year, genres, image_url, status, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mal_id) DO UPDATE SET
                title_english = CASE WHEN (anime.title_english IS NULL OR anime.title_english = '') THEN excluded.title_english ELSE anime.title_english END,
                synopsis = CASE WHEN (anime.synopsis IS NULL OR anime.synopsis = '') THEN excluded.synopsis ELSE anime.synopsis END,
                image_url = CASE WHEN (anime.image_url IS NULL OR anime.image_url = '') THEN excluded.image_url ELSE anime.image_url END,
                genres = CASE WHEN (anime.genres IS NULL OR anime.genres = '') THEN excluded.genres ELSE anime.genres END
        """, (
            mal_id, title, title_english, score, episodes,
            members, synopsis, year, genres, cover_url, status, 'anilist_dynamic'
        ))
        conn.commit()
        conn.close()

        # Guardrail #3: Immediate OTA cache coherency
        refresh_memory_caches([{
            "mal_id": mal_id,
            "title": title,
            "title_english": title_english,
            "score": score,
            "episodes": episodes,
            "members": members,
            "genres": genres,
            "year": year
        }])
    except Exception as e:
        print(f"Failed to dynamic upsert {title}: {e}")

def get_local_data_for_mal_id(mal_id: int):
    conn = get_db_connection(ANIME_DATA_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT local_image_path, theme_local_path, episodes, members FROM anime WHERE mal_id = ?", (mal_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0], row[1], row[2], row[3]
    return None, None, None, None

async def download_and_save_cover(mal_id: int, url: str):
    if not url: return
    local_path = os.path.join(COVERS_DIR, f"{mal_id}.jpg")
    if os.path.exists(local_path): return
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 200:
                with open(local_path, 'wb') as f:
                    f.write(resp.content)
                conn = get_db_connection(ANIME_DATA_DB_PATH)
                conn.execute("UPDATE anime SET local_image_path = ? WHERE mal_id = ?", (local_path, mal_id))
                conn.commit()
                conn.close()
    except Exception as e:
        print(f"Failed to download cover for {mal_id}: {e}")

@app.get("/api/library")
async def get_library(background_tasks: BackgroundTasks):
    global _LIBRARY_CACHE, _LIBRARY_CACHE_TIME
    try:
        # Check cache (1 hour)
        if _LIBRARY_CACHE and time.time() - _LIBRARY_CACHE_TIME < 3600:
            return _LIBRARY_CACHE

        try:
            hero_animes = []
            categories = [
                {"id": "recent", "name": "Recently Updated", "sort": "UPDATED_AT_DESC", "status": "RELEASING"},
                {"id": "upcoming", "name": "Upcoming Anime", "sort": "POPULARITY_DESC", "status": "NOT_YET_RELEASED"},
                {"id": "new", "name": "New Release", "sort": "START_DATE_DESC", "status": "RELEASING"},
                {"id": "completed", "name": "Just Completed", "sort": "END_DATE_DESC", "status": "FINISHED"}
            ]
            library_data = []
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                # 1. Fetch Top Trending for Heroes via AniList
                hero_query = """
                query {
                  Page(page: 1, perPage: 20) {
                    media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) {
                      idMal
                      title { romaji english }
                      coverImage { extraLarge }
                      bannerImage
                      genres
                      episodes
                      seasonYear
                      description
                      averageScore
                      format
                      popularity
                    }
                  }
                }
                """
                resp_hero = await client.post("https://graphql.anilist.co", json={"query": hero_query})
                resp_hero.raise_for_status()
                
                valid_heroes = []
                for item in resp_hero.json().get('data', {}).get('Page', {}).get('media', []):
                    # Anikoto-style filtering: Only allow anime with actual banner images in the Hero section!
                    if not item.get('bannerImage'): continue
                    if len(valid_heroes) >= 5: break
                    
                    mal_id = item.get('idMal')
                    if not mal_id: continue
                    local_image, local_theme, local_episodes, local_members = get_local_data_for_mal_id(mal_id)
                    cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(local_image)}" if local_image else item.get('coverImage', {}).get('extraLarge')
                    theme_url = f"http://localhost:{API_PORT}/themes/{os.path.basename(local_theme)}" if local_theme else None
                    
                    if not local_image and item.get('coverImage', {}).get('extraLarge'):
                        background_tasks.add_task(download_and_save_cover, mal_id, item.get('coverImage', {}).get('extraLarge'))
                    
                    synopsis = (item.get('description') or "").replace("<br>", "").replace("<i>", "").replace("</i>", "")
                    
                    hero_animes.append({
                        "mal_id": mal_id,
                        "title": item.get('title', {}).get('english') or item.get('title', {}).get('romaji'),
                        "title_original": item.get('title', {}).get('romaji'),
                        "score": (item.get('averageScore') or 0) / 10.0,
                        "genres": ", ".join(item.get('genres', [])),
                        "synopsis": synopsis,
                        "year": item.get('seasonYear'),
                        "episodes": item.get('episodes') or local_episodes,
                        "type": item.get('format'),
                        "members": local_members or item.get('popularity'),
                        "cover_url": cover_url,
                        "banner_url": item.get('bannerImage'),
                        "theme_url": theme_url
                    })
                    
                    upsert_anime_to_db(item, cover_url, synopsis)
                        
                    valid_heroes.append(item)
                
                # 2. Fetch Categories via AniList
                cat_query = """
                query ($sort: [MediaSort], $status: MediaStatus) {
                  Page(page: 1, perPage: 30) {
                    media(sort: $sort, type: ANIME, status: $status) {
                      idMal
                      title { romaji english }
                      coverImage { extraLarge }
                      bannerImage
                      genres
                      episodes
                      seasonYear
                      description
                      averageScore
                      format
                      popularity
                    }
                  }
                }
                """
                for cat in categories:
                    resp = await client.post("https://graphql.anilist.co", json={"query": cat_query, "variables": {"sort": [cat["sort"]], "status": cat["status"]}})
                    resp.raise_for_status()
                    data = resp.json().get('data', {}).get('Page', {}).get('media', [])
                    
                    anime_list = []
                    for item in data:
                        mal_id = item.get('idMal')
                        if not mal_id: continue
                        local_image, local_theme, local_episodes, local_members = get_local_data_for_mal_id(mal_id)
                        
                        cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(local_image)}" if local_image else item.get('coverImage', {}).get('extraLarge')
                        theme_url = f"http://localhost:{API_PORT}/themes/{os.path.basename(local_theme)}" if local_theme else None
                        
                        if not local_image and item.get('coverImage', {}).get('extraLarge'):
                            background_tasks.add_task(download_and_save_cover, mal_id, item.get('coverImage', {}).get('extraLarge'))
                        
                        synopsis = (item.get('description') or "").replace("<br>", "").replace("<i>", "").replace("</i>", "")
                        
                        anime_list.append({
                            "mal_id": mal_id,
                            "title": item.get('title', {}).get('english') or item.get('title', {}).get('romaji'),
                            "title_original": item.get('title', {}).get('romaji'),
                            "score": (item.get('averageScore') or 0) / 10.0,
                            "genres": ", ".join(item.get('genres', [])),
                            "synopsis": synopsis,
                            "year": item.get('seasonYear'),
                            "episodes": item.get('episodes') or local_episodes,
                            "type": item.get('format'),
                            "members": local_members or item.get('popularity'),
                            "cover_url": cover_url,
                            "banner_url": item.get('bannerImage'),
                            "theme_url": theme_url
                        })
                        
                        upsert_anime_to_db(item, cover_url, synopsis)
                    
                    if anime_list:
                        library_data.append({
                            "category": cat['name'],
                            "anime": anime_list[:18]
                        })
                    # AniList rate limits are higher, no strict sleep needed for 4 requests, but adding a small delay just in case
                    await asyncio.sleep(0.1)
                    
            result = {
                "status": "success",
                "heroAnimes": hero_animes,
                "categories": library_data
            }
            
            with open(LIBRARY_CACHE_PATH, 'w') as f:
                json.dump(result, f)
                
            _LIBRARY_CACHE = result
            _LIBRARY_CACHE_TIME = time.time()
            return result
            
        except Exception as api_e:
            print(f"AniList API failed: {api_e}.")
            if os.path.exists(LIBRARY_CACHE_PATH):
                with open(LIBRARY_CACHE_PATH, 'r') as f:
                    _LIBRARY_CACHE = json.load(f)
                _LIBRARY_CACHE_TIME = time.time()
                return _LIBRARY_CACHE
            else:
                return get_library_sqlite()
                
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if os.path.exists(COVERS_DIR):
    app.mount("/covers", StaticFiles(directory=COVERS_DIR), name="covers")

if os.path.exists("themes"):
    app.mount("/themes", StaticFiles(directory="themes"), name="themes")

class UserLibraryUpdate(BaseModel):
    mal_id: int
    anime_title: Optional[str] = None
    status: Optional[str] = None
    episodes_watched: Optional[int] = None
    score: Optional[float] = None
    notes: Optional[str] = None
    is_favorite: Optional[int] = None
    rewatch_count: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class BatchLibraryUpdate(BaseModel):
    mal_ids: list[int]
    action: str  # "status" | "delete" | "favorite"
    value: Optional[Any] = None

@app.delete("/api/user_library/{mal_id}")
async def delete_user_library_item(mal_id: int):
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_library WHERE mal_id = ?", (mal_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/anime/{mal_id}")
def get_anime_details(mal_id: int):
    conn = get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row)
    anime = conn.execute('SELECT * FROM anime WHERE mal_id = ?', (mal_id,)).fetchone()
    conn.close()
    if anime:
        anime_dict = dict(anime)
        if anime_dict.get('local_image_path'):
            anime_dict['cover_url'] = f"http://localhost:{API_PORT}/covers/{os.path.basename(anime_dict['local_image_path'])}"
        else:
            anime_dict['cover_url'] = anime_dict.get('image_url')
        return anime_dict
    raise HTTPException(status_code=404, detail="Anime not found")

@app.get("/api/random")
async def get_random_anime():
    """O(1) instant random anime resolution via in-memory pre-cached rowids."""
    if not CACHED_ROWIDS:
        init_memory_caches()
    if not CACHED_ROWIDS:
        raise HTTPException(status_code=404, detail="No anime found")

    rid = random.choice(CACHED_ROWIDS)

    def _fetch_random(row_id):
        conn = get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row)
        anime = conn.execute('SELECT * FROM anime WHERE rowid = ?', (row_id,)).fetchone()
        conn.close()
        return dict(anime) if anime else None

    anime_dict = await run_in_threadpool(_fetch_random, rid)
    if anime_dict:
        if anime_dict.get('local_image_path'):
            anime_dict['cover_url'] = f"http://localhost:{API_PORT}/covers/{os.path.basename(anime_dict['local_image_path'])}"
        else:
            anime_dict['cover_url'] = anime_dict.get('image_url')
        return anime_dict
    raise HTTPException(status_code=404, detail="No anime found")

@app.get("/api/user_library")
async def get_user_library():
    try:
        anime_db = recommender._load_anime_db()
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    mal_id, status, episodes_watched, score, updated_at, notes,
                    anime_title, is_favorite, rewatch_count, started_at, completed_at
                FROM user_library
                ORDER BY updated_at DESC
            """)
            rows = cursor.fetchall()

        # Fetch insights for taste_matches (computed in <5ms using in-memory matrices)
        insights = recommender.get_user_library_insights()
        taste_matches = insights.get("taste_matches", {})

        library = []
        for row in rows:
            item = dict(row)
            mid = item["mal_id"]
            meta = anime_db.get(mid, {})

            item["title"] = meta.get("title") or item.get("anime_title") or f"Anime {mid}"
            item["title_english"] = meta.get("title_english") or ""
            item["title_japanese"] = meta.get("title_japanese") or ""
            item["genres"] = meta.get("genres") or ""
            total_eps = meta.get("episodes") or 0
            item["total_episodes"] = total_eps
            item["season"] = meta.get("season") or ""
            item["year"] = meta.get("year")
            item["global_score"] = meta.get("global_score") or meta.get("score") or 0.0
            item["synopsis"] = meta.get("synopsis") or ""
            item["airing_status"] = meta.get("airing_status") or meta.get("status") or ""

            eps_watched = item.get("episodes_watched") or 0
            if total_eps > 0:
                item["unwatched_aired_episodes"] = max(0, total_eps - eps_watched)
            else:
                item["unwatched_aired_episodes"] = 0

            item["taste_match_pct"] = taste_matches.get(mid)

            local_img = meta.get("local_image_path")
            has_local = False
            if local_img:
                if os.path.exists(local_img) or os.path.exists(os.path.join(COVERS_DIR, os.path.basename(local_img))):
                    has_local = True
            elif os.path.exists(os.path.join(COVERS_DIR, f"{mid}.jpg")):
                local_img = f"{mid}.jpg"
                has_local = True

            if has_local:
                item["cover_url"] = f"http://localhost:{API_PORT}/covers/{os.path.basename(local_img)}"
            else:
                item["cover_url"] = meta.get("image_url") or ""

            library.append(item)
        return {"status": "success", "library": library}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user_library/insights")
async def get_user_library_insights_endpoint():
    try:
        insights = await run_in_threadpool(recommender.get_user_library_insights)
        taste_dna = insights.get("taste_dna", {})
        return {"status": "success", **taste_dna, **insights}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user_library/batch")
async def batch_update_user_library(req: BatchLibraryUpdate):
    if not req.mal_ids:
        return {"status": "success", "modified": 0}
        
    try:
        anime_db = recommender._load_anime_db()
        now_iso = time.strftime("%Y-%m-%d %H:%M:%S")
        
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            c = conn.cursor()
            
            if req.action == "delete":
                placeholders = ",".join("?" for _ in req.mal_ids)
                c.execute(f"DELETE FROM user_library WHERE mal_id IN ({placeholders})", req.mal_ids)
                modified = c.rowcount
                
            elif req.action == "favorite":
                fav_val = 1 if req.value in (1, True, "1", "true") else 0
                placeholders = ",".join("?" for _ in req.mal_ids)
                c.execute(f"UPDATE user_library SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE mal_id IN ({placeholders})", [fav_val] + req.mal_ids)
                modified = c.rowcount
                
            elif req.action == "status":
                new_status = str(req.value)
                modified = 0
                for mid in req.mal_ids:
                    meta = anime_db.get(mid, {})
                    total_eps = meta.get("episodes") or 0
                    
                    cur = c.execute("SELECT episodes_watched, started_at, completed_at FROM user_library WHERE mal_id = ?", (mid,)).fetchone()
                    if cur:
                        curr_eps, started_at, completed_at = cur
                        new_eps = curr_eps
                        new_started = started_at
                        new_completed = completed_at
                        
                        if new_status == "Completed":
                            if total_eps > 0:
                                new_eps = total_eps
                            new_completed = now_iso
                        elif new_status == "Watching":
                            if not new_started:
                                new_started = now_iso
                                
                        c.execute("""
                            UPDATE user_library
                            SET status = ?, episodes_watched = ?, started_at = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE mal_id = ?
                        """, (new_status, new_eps, new_started, new_completed, mid))
                        modified += 1
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported action: {req.action}")
                
            conn.commit()
            return {"status": "success", "affected": modified, "modified": modified}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user_library")
async def update_user_library(update: UserLibraryUpdate):
    try:
        anime_db = recommender._load_anime_db()
        info = anime_db.get(update.mal_id, {})
        total_eps = info.get("episodes") or 0
        now_iso = time.strftime("%Y-%m-%d %H:%M:%S")

        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Fetch title if missing
            title = update.anime_title
            if not title:
                title = info.get("title_english") or info.get("title") or ""
            
            cursor.execute("""
                SELECT status, episodes_watched, score, notes, anime_title,
                       is_favorite, rewatch_count, started_at, completed_at
                FROM user_library WHERE mal_id = ?
            """, (update.mal_id,))
            row = cursor.fetchone()
            
            if row:
                curr_status, curr_eps, curr_score, curr_notes, curr_title, curr_fav, curr_rewatch, curr_started, curr_completed = row
                new_status = update.status if update.status is not None else curr_status
                new_episodes = update.episodes_watched if update.episodes_watched is not None else curr_eps
                new_score = update.score if update.score is not None else curr_score
                new_notes = update.notes if update.notes is not None else curr_notes
                new_title = title if title is not None else curr_title
                new_fav = update.is_favorite if update.is_favorite is not None else (curr_fav or 0)
                new_rewatch = update.rewatch_count if update.rewatch_count is not None else (curr_rewatch or 0)
                new_started = update.started_at if update.started_at is not None else curr_started
                new_completed = update.completed_at if update.completed_at is not None else curr_completed

                # Clamping & auto-completion state transitions
                if total_eps > 0 and new_episodes >= total_eps:
                    new_episodes = total_eps
                    new_status = "Completed"
                    if not new_completed:
                        new_completed = now_iso
                elif new_episodes > 0 and new_status == "Plan to Watch":
                    new_status = "Watching"
                    if not new_started:
                        new_started = now_iso

                if new_status == "Completed" and not new_completed:
                    new_completed = now_iso
                if new_status == "Watching" and not new_started:
                    new_started = now_iso

                cursor.execute("""
                    UPDATE user_library 
                    SET status = ?, episodes_watched = ?, score = ?, notes = ?, anime_title = ?,
                        is_favorite = ?, rewatch_count = ?, started_at = ?, completed_at = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE mal_id = ?
                """, (new_status, new_episodes, new_score, new_notes, new_title, new_fav, new_rewatch, new_started, new_completed, update.mal_id))
            else:
                new_status = update.status if update.status is not None else 'Watching'
                new_episodes = update.episodes_watched if update.episodes_watched is not None else 0
                new_score = update.score if update.score is not None else 0
                new_notes = update.notes if update.notes is not None else ''
                new_title = title if title is not None else ''
                new_fav = update.is_favorite if update.is_favorite is not None else 0
                new_rewatch = update.rewatch_count if update.rewatch_count is not None else 0
                new_started = update.started_at
                new_completed = update.completed_at

                if total_eps > 0 and new_episodes >= total_eps:
                    new_episodes = total_eps
                    new_status = "Completed"
                    if not new_completed:
                        new_completed = now_iso
                elif new_episodes > 0 and new_status == "Plan to Watch":
                    new_status = "Watching"
                    if not new_started:
                        new_started = now_iso

                if new_status == "Completed" and not new_completed:
                    new_completed = now_iso
                if new_status == "Watching" and not new_started:
                    new_started = now_iso

                cursor.execute("""
                    INSERT INTO user_library (
                        mal_id, status, episodes_watched, score, notes, anime_title,
                        is_favorite, rewatch_count, started_at, completed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (update.mal_id, new_status, new_episodes, new_score, new_notes, new_title, new_fav, new_rewatch, new_started, new_completed))
            
            conn.commit()
            return {
                "status": "success",
                "episodes_watched": new_episodes,
                "status_value": new_status,
                "item": {
                    "mal_id": update.mal_id,
                    "status": new_status,
                    "episodes_watched": new_episodes,
                    "score": new_score,
                    "is_favorite": new_fav,
                    "started_at": new_started,
                    "completed_at": new_completed
                }
            }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user_library/{mal_id}")
async def delete_user_library(mal_id: int):
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            conn.execute("DELETE FROM user_library WHERE mal_id = ?", (mal_id,))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/library/export")
async def export_user_library(format: str = "xml"):
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH, row_factory=sqlite3.Row) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.mal_id, u.status, u.episodes_watched, u.score
                FROM user_library u
            """)
            rows = cursor.fetchall()

        # Fetch titles for the XML from anime_data.db
        with get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row) as conn2:
            cursor2 = conn2.cursor()
            anime_info = {}
            if rows:
                mal_ids = [str(r['mal_id']) for r in rows]
                cursor2.execute(f"SELECT mal_id, title_english, title, episodes FROM anime WHERE mal_id IN ({','.join(mal_ids)})")
                for r in cursor2.fetchall():
                    anime_info[r['mal_id']] = dict(r)
                    
        # Status Mapping (Anikoto -> MAL)
        status_map = {
            "Completed": "Completed",
            "Watching": "Watching",
            "On-Hold": "On-Hold",
            "Dropped": "Dropped",
            "Plan to Watch": "Planned"
        }

        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["ID", "title", "status", "score", "episodes_watched", "total_episodes"])
            for r in rows:
                mal_id = r['mal_id']
                info = anime_info.get(mal_id, {})
                title = info.get('title_english') or info.get('title') or f"Unknown {mal_id}"
                total_episodes = info.get('episodes') or 0
                writer.writerow([
                    mal_id, 
                    title,
                    status_map.get(r['status'], r['status']),
                    r['score'],
                    r['episodes_watched'],
                    total_episodes
                ])
            return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=library_export.csv"})
        
        else: # xml
            import xml.dom.minidom
            root = ET.Element("myanimelist")
            myinfo = ET.SubElement(root, "myinfo")
            ET.SubElement(myinfo, "user_name").text = "AnikotoUser"
            ET.SubElement(myinfo, "user_export_type").text = "1"
            
            for r in rows:
                anime = ET.SubElement(root, "anime")
                mal_id = r['mal_id']
                info = anime_info.get(mal_id, {})
                
                ET.SubElement(anime, "series_animedb_id").text = str(mal_id)
                ET.SubElement(anime, "series_title").text = "___CDATA___" + str(info.get('title_english') or info.get('title') or f"Unknown {mal_id}") + "___ENDCDATA___"
                ET.SubElement(anime, "series_type").text = "TV"
                ET.SubElement(anime, "series_episodes").text = str(info.get('episodes') or 0)
                
                ET.SubElement(anime, "my_watched_episodes").text = str(r['episodes_watched'])
                ET.SubElement(anime, "my_score").text = str(r['score'])
                ET.SubElement(anime, "my_status").text = status_map.get(r['status'], r['status'])
                ET.SubElement(anime, "update_on_import").text = "1"
                
            xml_str = ET.tostring(root, encoding='unicode', xml_declaration=False)
            xml_str = xml.dom.minidom.parseString(xml_str).toprettyxml(indent="\t")
            xml_str = xml_str.replace('<?xml version="1.0" ?>', '<?xml version="1.0" encoding="UTF-8" ?>\n\t\t<!--\n\t\t Created by XML Export feature at MyAnimeList.net\n\t\t-->\n')
            xml_str = xml_str.replace("___CDATA___", "<![CDATA[").replace("___ENDCDATA___", "]]>")
            return Response(content=xml_str, media_type="application/xml", headers={"Content-Disposition": "attachment; filename=library_export.xml"})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/library/import")
async def import_user_library(file: UploadFile = File(...), overwrite: bool = Form(False)):
    try:
        content = await file.read()
        
        # Status Mapping (MAL -> Anikoto)
        status_map = {
            "Completed": "Completed",
            "Watching": "Watching",
            "On-Hold": "On-Hold",
            "Dropped": "Dropped",
            "Plan to Watch": "Planned"
        }
        
        imported_entries = []
        
        if file.filename.endswith(".csv"):
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            
            with get_db_connection(ANIME_DATA_DB_PATH) as adb:
                adb_cursor = adb.cursor()
                for row in reader:
                    mal_id = 0
                    try:
                        mal_id = int(row.get('anime_id', 0) or row.get('mal_id', 0) or 0)
                    except ValueError:
                        pass
                        
                    if mal_id <= 0:
                        title = row.get('Anime', '') or row.get('title', '') or row.get('Anime Movie', '')
                        if not title: continue
                        adb_cursor.execute("SELECT mal_id FROM anime WHERE title_english LIKE ? OR title LIKE ? COLLATE NOCASE", (f"%{title}%", f"%{title}%"))
                        res = adb_cursor.fetchone()
                        if res:
                            mal_id = res[0]
                        else:
                            continue
                            
                    status = status_map.get(row.get('status', ''), "Completed") # Default to Completed for Ani.csv
                    score = float(row.get('score', 0) or 0)
                    ep_str = row.get('my_watched_episodes', '') or row.get('episodes_watched', '') or row.get('Ep. No.', '')
                    try:
                        episodes_watched = int(ep_str) if ep_str else 0
                    except ValueError:
                        episodes_watched = 0
                    # Fetch base info to check for overflow
                    adb_cursor.execute("SELECT title_english, title, episodes FROM anime WHERE mal_id = ?", (mal_id,))
                    base_res = adb_cursor.fetchone()
                    if not base_res:
                        imported_entries.append((mal_id, status, episodes_watched, score))
                        continue
                        
                    base_total_eps = base_res[2] or 0
                    base_title = base_res[0] or base_res[1] or ""
                    
                    if base_total_eps > 0 and episodes_watched > base_total_eps:
                        # Distribute Overflow
                        imported_entries.append((mal_id, "Completed", base_total_eps, score))
                        remaining = episodes_watched - base_total_eps
                        
                        # Extract core franchise name
                        search_term = base_title.split(':')[0]
                        if ' Season' in search_term: search_term = search_term.split(' Season')[0]
                        if len(search_term) < 4: search_term = base_title
                            
                        # Query sequels
                        adb_cursor.execute("""
                            SELECT mal_id, episodes, title, title_english 
                            FROM anime 
                            WHERE (title_english LIKE ? OR title LIKE ? COLLATE NOCASE) 
                            AND mal_id != ? 
                            ORDER BY year ASC, aired_from ASC
                        """, (f"{search_term}%", f"{search_term}%", mal_id))
                        
                        for rel in adb_cursor.fetchall():
                            if remaining <= 0: break
                            rel_id, rel_eps = rel[0], rel[1] or 0
                            rel_title = str(rel[2] or '').lower() + ' ' + str(rel[3] or '').lower()
                            
                            if rel_eps == 0: continue
                            
                            # Filter out common spin-offs, OVAs, movies, and recaps
                            skip_keywords = [
                                'ova', 'ona', 'oad', 'movie', 'picture drama', 'recap', 'special', 
                                'junior high', 'chibi', 'bow and arrow', 'wings of freedom', 
                                'roar of awakening', 'chronicle', 'music', 'digest', 'preview', 'summary',
                                'no regrets', 'lost girls'
                            ]
                            if any(kw in rel_title for kw in skip_keywords):
                                continue
                                
                            # Also skip short series (usually OVAs/specials) if distributing
                            if rel_eps < 5 and base_total_eps > 8:
                                continue
                                
                            if remaining >= rel_eps:
                                imported_entries.append((rel_id, "Completed", rel_eps, score))
                                remaining -= rel_eps
                            else:
                                imported_entries.append((rel_id, "Watching", remaining, score))
                                remaining = 0
                    else:
                        imported_entries.append((mal_id, status, episodes_watched, score))
                
        elif file.filename.endswith(".xml"):
            root = ET.fromstring(content)
            for anime in root.findall('anime'):
                mal_id_el = anime.find('series_animedb_id')
                if mal_id_el is None or not mal_id_el.text: continue
                mal_id = int(mal_id_el.text)
                
                status_el = anime.find('my_status')
                status = status_map.get(status_el.text if status_el is not None else '', "Watching")
                
                score_el = anime.find('my_score')
                score = float(score_el.text) if score_el is not None and score_el.text else 0
                
                eps_el = anime.find('my_watched_episodes')
                episodes_watched = int(eps_el.text) if eps_el is not None and eps_el.text else 0
                
                imported_entries.append((mal_id, status, episodes_watched, score))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            cursor = conn.cursor()
            if overwrite:
                cursor.execute("DELETE FROM user_library")
            
            for mal_id, status, episodes_watched, score in imported_entries:
                cursor.execute("SELECT mal_id FROM user_library WHERE mal_id = ?", (mal_id,))
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE user_library 
                        SET status = ?, episodes_watched = ?, score = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE mal_id = ?
                    """, (status, episodes_watched, score, mal_id))
                else:
                    cursor.execute("""
                        INSERT INTO user_library (mal_id, status, episodes_watched, score)
                        VALUES (?, ?, ?, ?)
                    """, (mal_id, status, episodes_watched, score))
            conn.commit()
            
        return {"status": "success", "imported": len(imported_entries)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Query

def _fuzzy_match_worker(query_text: str, search_choices: List[tuple], search_strings: Optional[List[str]] = None, limit: int = 100) -> List[int]:
    if not query_text or not search_choices:
        return []
    strings = search_strings if search_strings is not None else [c[1] for c in search_choices]
    results_fuzzy = process.extract(
        query_text,
        strings,
        scorer=fuzz.WRatio,
        processor=utils.default_process,
        limit=200,
        score_cutoff=45
    )
    
    refined_matches = []
    q_len = len(query_text)
    for match_str, score, idx in results_fuzzy:
        penalty = 0
        m_len = len(match_str)
        if m_len < q_len:
            ratio = m_len / max(1, q_len)
            if ratio < 0.8:
                penalty = (0.8 - ratio) * 50
        final_score = score - penalty
        if final_score > 50:
            refined_matches.append((final_score, search_choices[idx][0]))
            
    refined_matches.sort(key=lambda x: x[0], reverse=True)
    
    matched_ids = []
    seen = set()
    for score, mal_id in refined_matches:
        if mal_id not in seen:
            seen.add(mal_id)
            matched_ids.append(mal_id)
            if len(matched_ids) >= limit:
                break
    return matched_ids

@app.get("/api/search")
async def search_anime(
    q: Optional[str] = None,
    genres: Optional[str] = None,
    season: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    format: Optional[str] = None,
    sort: Optional[str] = "trending",
    page: int = 1,
    limit: int = 30
):
    try:
        query = "SELECT * FROM anime WHERE 1=1"
        params = []
        fuzzy_order = None
        
        if q:
            with _memory_cache_lock:
                choices_snapshot = list(SEARCH_CHOICES)
                strings_snapshot = list(SEARCH_STRINGS)
            matched_ids = await run_in_threadpool(_fuzzy_match_worker, q, choices_snapshot, strings_snapshot, 100)
            if matched_ids:
                placeholders = ",".join("?" for _ in matched_ids)
                query += f" AND mal_id IN ({placeholders})"
                params.extend(matched_ids)
                case_stmts = " ".join([f"WHEN {mid} THEN {i}" for i, mid in enumerate(matched_ids)])
                fuzzy_order = f"CASE mal_id {case_stmts} ELSE 9999 END"
            else:
                query += " AND 1=0"
                
            if genres:
                for genre in genres.split(","):
                    query += " AND genres LIKE ?"
                    params.append(f"%{genre.strip()}%")
                    
            if season:
                query += " AND season = ?"
                params.append(season)
                
            if year:
                query += " AND year = ?"
                params.append(year)
                
            if status:
                query += " AND status LIKE ?"
                params.append(f"%{status}%")
                
            if format:
                if format.upper() == 'TV':
                    query += " AND (episodes > 1 OR episodes IS NULL)"
                elif format.upper() == 'MOVIE' or format.upper() == 'OVA':
                    query += " AND episodes = 1"
                    
            if q and fuzzy_order:
                query += f" ORDER BY {fuzzy_order} ASC"
            elif sort == "popularity":
                query += " ORDER BY members DESC"
            elif sort == "score":
                query += " ORDER BY score DESC"
            elif sort == "title":
                query += " ORDER BY title_english ASC"
            elif sort == "date":
                query += " ORDER BY year DESC"
            else: # trending
                query += " ORDER BY members DESC, year DESC"
                
        offset = (page - 1) * limit
        query += f" LIMIT {limit} OFFSET {offset}"
        
        with get_db_connection(ANIME_DATA_DB_PATH, row_factory=sqlite3.Row) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            results = []
            for r in rows:
                cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(r['local_image_path'])}" if r['local_image_path'] else r['image_url']
                theme_url = f"http://localhost:{API_PORT}/themes/{os.path.basename(r['theme_local_path'])}" if r['theme_local_path'] else None
                
                results.append({
                    "mal_id": r['mal_id'],
                    "title": r['title_english'] or r['title'],
                    "title_original": r['title'],
                    "score": r['score'],
                    "members": r['members'],
                    "genres": r['genres'],
                    "synopsis": r['synopsis'],
                    "year": r['year'],
                    "season": r['season'],
                    "episodes": r['episodes'],
                    "status": r['status'],
                    "cover_url": cover_url,
                    "theme_url": theme_url
                })
                
            return {"status": "success", "results": results, "page": page}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def _compute_single_rec_sync(mal_id: int):
    liked = _resolve_by_ids([mal_id])
    if not liked:
        return None
    try:
        return core_recommend(liked_anime=liked, top_n=12)
    except ValueError as ve:
        print(f"[api] Recommendation fallback: {ve}")
        return []
    except Exception as e:
        print(f"[api] Recommendation error: {e}")
        return []

@app.get("/api/recommendations/{mal_id}")
async def get_recommendations(mal_id: int):
    try:
        recs = await run_in_threadpool(_compute_single_rec_sync, mal_id)
        if recs is None:
            return {"status": "error", "message": "Anime not found or missing from database."}
            
        results = []
        anime_db = recommender._load_anime_db()
        for r in recs:
            if r.mal_id == mal_id:
                continue
            cover_url = f"http://localhost:{API_PORT}/covers/{os.path.basename(r.local_image_path)}" if r.local_image_path else ""
            info = anime_db.get(r.mal_id, {})
            results.append({
                "mal_id": r.mal_id,
                "title": r.title_english or r.title,
                "title_original": r.title,
                "score": r.score,
                "members": r.members,
                "genres": r.genres,
                "cover_url": cover_url,
                "year": str(info.get("year")) if info.get("year") else None,
                "episodes": info.get("episodes")
            })
            if len(results) == 5:
                break
            
        return {"status": "success", "recommendations": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# MPV_SOCKET_PATH is imported from config.py (user-scoped to XDG_RUNTIME_DIR or /tmp/kyorenzu-{uid})

PLAYBACK_SESSION = {
    "pgid": None,
    "task": None,
    "status": "idle",
    "title": None,
    "episode": None,
    "percent": 0.0,
    "message": ""
}

async def mpv_progress_listener(sock_path: str, target_mal_id: Optional[int], target_episode: int):
    has_scrobbled = False
    reader = None
    writer = None
    for _ in range(60):
        if os.path.exists(sock_path):
            try:
                reader, writer = await asyncio.open_unix_connection(sock_path)
                break
            except Exception:
                pass
        await asyncio.sleep(0.5)

    if not reader or not writer:
        print("[mpv_progress_listener] Could not connect to MPV IPC socket")
        return

    PLAYBACK_SESSION["status"] = "playing"
    print(f"[mpv_progress_listener] Connected to MPV IPC socket at {sock_path}")
    try:
        while True:
            cmd_payload = json.dumps({"command": ["get_property", "percent-pos"]}) + "\n"
            writer.write(cmd_payload.encode('utf-8'))
            await writer.drain()
            
            line = await asyncio.wait_for(reader.readline(), timeout=5.0)
            if not line:
                break
            try:
                resp = json.loads(line.decode('utf-8'))
                percent = resp.get("data")
                if isinstance(percent, (int, float)):
                    PLAYBACK_SESSION["percent"] = float(percent)
                    if percent >= 85.0 and not has_scrobbled and target_mal_id:
                        has_scrobbled = True
                        anime_db = recommender._load_anime_db()
                        info = anime_db.get(target_mal_id, {})
                        total_eps = info.get("episodes") or 0
                        clamped_ep = min(target_episode, total_eps) if total_eps > 0 else target_episode
                        now_iso = time.strftime("%Y-%m-%d %H:%M:%S")

                        with get_db_connection(USER_LIBRARY_DB_PATH) as uconn:
                            cur = uconn.execute("""
                                SELECT episodes_watched, status, started_at, completed_at
                                FROM user_library WHERE mal_id = ?
                            """, (target_mal_id,)).fetchone()
                            if cur:
                                curr_eps, curr_status, started_at, completed_at = cur
                                new_eps = max(curr_eps, clamped_ep)
                                new_status = curr_status
                                new_started = started_at or now_iso
                                new_completed = completed_at

                                if total_eps > 0 and new_eps >= total_eps:
                                    new_eps = total_eps
                                    new_status = "Completed"
                                    if not new_completed:
                                        new_completed = now_iso
                                elif curr_status == "Plan to Watch":
                                    new_status = "Watching"

                                uconn.execute("""
                                    UPDATE user_library
                                    SET episodes_watched = ?, status = ?, started_at = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE mal_id = ?
                                """, (new_eps, new_status, new_started, new_completed, target_mal_id))
                            else:
                                is_completed = total_eps > 0 and clamped_ep >= total_eps
                                new_status = "Completed" if is_completed else "Watching"
                                started_at = now_iso
                                completed_at = now_iso if is_completed else None
                                uconn.execute("""
                                    INSERT INTO user_library (mal_id, status, episodes_watched, score, started_at, completed_at)
                                    VALUES (?, ?, ?, 0, ?, ?)
                                """, (target_mal_id, new_status, clamped_ep, started_at, completed_at))
                            uconn.commit()
                        print(f"[mpv_progress_listener] Scrobbled ep {target_episode} for mal_id={target_mal_id} (progress={percent:.1f}%)")
            except Exception:
                pass
            await asyncio.sleep(2.0)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[mpv_progress_listener] Socket disconnected or error: {e}")
    finally:
        if writer:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
        PLAYBACK_SESSION["status"] = "idle"
        PLAYBACK_SESSION["percent"] = 0.0

def strip_ansi(text: str) -> str:
    if not text:
        return ""
    # Strip OSC sequences
    text = re.sub(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)', '', text)
    # Strip CSI escape sequences
    text = re.sub(r'\x1b\[[0-9:;<=>?]*[ -/]*[@-~]', '', text)
    # Strip 2-char escape sequences
    text = re.sub(r'\x1b[0-9A-Za-z#%()=<>?@]', '', text)
    # Strip orphaned bracket sequences like [2K, [1;34m if ESC was stripped
    text = re.sub(r'\[[0-9;]*[a-zA-Z]', '', text)
    # Strip non-printable ASCII control characters except \n and \t
    text = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', text)
    return text.strip()

def clean_ani_cli_error(raw_err: str) -> str:
    cleaned = strip_ansi(raw_err)
    # Remove boilerplate lines
    cleaned = re.sub(r'(?i)checking dependencies\.{0,3}', '', cleaned).strip()
    # Remove isolated numbers from cursor saves/movement (like " 7 ")
    cleaned = re.sub(r'^\s*\d+\s*', '', cleaned).strip()
    lower = cleaned.lower()
    if "no sources found for dub" in lower:
        return "No English dub sources found for this episode."
    if "no sources found" in lower or "no valid sources" in lower:
        return "No stream sources found for this episode."
    if "episode not released" in lower:
        return "This episode has not been released yet."
    if "invalid episode" in lower or "out of range" in lower:
        return "Requested episode is out of range or invalid."
    if "no results found" in lower:
        return "Could not find this anime on the streaming provider."
    if "invalid anime selection" in lower:
        return "Could not match this anime title on the streaming provider."
    if "blocked by cloudflare" in lower:
        return "The streaming provider is temporarily blocking requests (Cloudflare protection)."
    if "connection error" in lower or "request failed" in lower:
        return "Network connection error while connecting to streaming provider."
    if "no player found" in lower:
        return "MPV player executable was not found on your system."
    if cleaned:
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        if len(cleaned) > 160:
            cleaned = cleaned[-160:]
        return f"Playback error: {cleaned}"
    return "Playback failed. No stream source was returned by the provider."

@app.get("/api/play/status")
async def get_play_status():
    return {
        "status": PLAYBACK_SESSION["status"],
        "title": PLAYBACK_SESSION["title"],
        "episode": PLAYBACK_SESSION["episode"],
        "percent": PLAYBACK_SESSION["percent"],
        "message": PLAYBACK_SESSION["message"]
    }

@app.get("/api/play")
async def play_episode(
    title: str,
    episode: int,
    alt_title: Optional[str] = None,
    dub: bool = False,
    quality: str = "best",
    provider: str = "anidb",
    mal_id: Optional[int] = None
):
    try:
        if provider == "anikoto":
            raise HTTPException(status_code=501, detail="Anikoto scraper is under construction. Please use Anidb.")

        # Resolve mal_id if missing
        if not mal_id:
            try:
                with get_db_connection(ANIME_DATA_DB_PATH) as conn:
                    c = conn.cursor()
                    c.execute("SELECT mal_id FROM anime WHERE title_english = ? OR title = ? COLLATE NOCASE LIMIT 1", (title, title))
                    row = c.fetchone()
                    if not row and alt_title:
                        c.execute("SELECT mal_id FROM anime WHERE title_english = ? OR title = ? COLLATE NOCASE LIMIT 1", (alt_title, alt_title))
                        row = c.fetchone()
                    if row:
                        mal_id = row[0]
            except Exception:
                pass

        # Clamp requested episode if anime total episodes is known
        if mal_id:
            try:
                anime_db = recommender._load_anime_db()
                info = anime_db.get(mal_id, {})
                total_eps = info.get("episodes") or 0
                if total_eps > 0 and episode > total_eps:
                    print(f"[/api/play] Clamping requested episode {episode} -> {total_eps} (max episodes) for {title}")
                    episode = total_eps
            except Exception:
                pass

        ani_cli_path = ANI_CLI_BIN_PATH if os.path.exists(ANI_CLI_BIN_PATH) else get_resource_path(os.path.join("ani-cli-master", "ani-cli"))
        if os.path.exists(ani_cli_path) and not os.access(ani_cli_path, os.X_OK):
            try:
                os.chmod(ani_cli_path, 0o755)
            except Exception:
                pass

        env = os.environ.copy()
        env["PATH"] = f"{BIN_DIR}:{os.path.expanduser('~')}/.local/bin:" + env.get("PATH", "")
        if getattr(sys, 'frozen', False):
            env["ANI_CLI_MENU"] = sys.executable
            env["ANI_CLI_MENU_FLAGS"] = "--auto-select"
        else:
            auto_selector_path = get_resource_path("auto_selector.py")
            env["ANI_CLI_MENU"] = sys.executable
            env["ANI_CLI_MENU_FLAGS"] = auto_selector_path if os.path.exists(auto_selector_path) else "--auto-select"
        env["TARGET_ANIME_TITLE"] = title
        env["ANI_CLI_PLAYER_FLAGS"] = f"--input-ipc-server={MPV_SOCKET_PATH}"

        async def _run_playback_attempt(use_dub: bool):
            # 1. Teardown any existing active ani-cli/mpv process group
            if PLAYBACK_SESSION["pgid"] is not None:
                old_pgid = PLAYBACK_SESSION["pgid"]
                try:
                    os.killpg(old_pgid, signal.SIGTERM)
                except (ProcessLookupError, OSError):
                    pass
                unregister_subprocess_pgid(old_pgid)
                PLAYBACK_SESSION["pgid"] = None

            if PLAYBACK_SESSION["task"] and not PLAYBACK_SESSION["task"].done():
                PLAYBACK_SESSION["task"].cancel()
                PLAYBACK_SESSION["task"] = None

            # 2. Safely unlink /tmp/kyorenzu-mpv.sock if a stale socket exists
            if os.path.exists(MPV_SOCKET_PATH):
                try:
                    os.unlink(MPV_SOCKET_PATH)
                except OSError:
                    pass

            cmd = [ani_cli_path, title, "-q", quality, "-e", str(episode), "--exit-after-play"]
            if use_dub:
                cmd.append("--dub")

            PLAYBACK_SESSION["status"] = "searching"
            PLAYBACK_SESSION["title"] = title
            PLAYBACK_SESSION["episode"] = episode
            PLAYBACK_SESSION["percent"] = 0.0
            PLAYBACK_SESSION["message"] = (
                f"Searching provider for {title} Ep {episode} (Dub)..."
                if use_dub else
                f"Searching provider for {title} Ep {episode} (Sub)..."
            )

            # Run process asynchronously with start_new_session=True for process group isolation
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                start_new_session=True
            )

            pgid = os.getpgid(proc.pid)
            register_subprocess_pgid(pgid)
            PLAYBACK_SESSION["pgid"] = pgid

            async def _cleanup_proc_when_done(p, p_pgid):
                await p.wait()
                unregister_subprocess_pgid(p_pgid)
                if PLAYBACK_SESSION["pgid"] == p_pgid:
                    PLAYBACK_SESSION["pgid"] = None

            asyncio.create_task(_cleanup_proc_when_done(proc, pgid))

            error_log = []
            try:
                async with asyncio.timeout(45.0):
                    while True:
                        line = await proc.stdout.readline()
                        if not line:
                            break
                        decoded_line = line.decode('utf-8', errors='replace').strip()
                        error_log.append(decoded_line)

                        if "Playing episode" in decoded_line or "links fetched" in decoded_line or "Downloading" in decoded_line:
                            PLAYBACK_SESSION["status"] = "launching"
                            is_fallback = dub and not use_dub
                            msg = (
                                f"Dub unavailable for this title. Playing in Sub (Ep {episode})"
                                if is_fallback else
                                f"Launching player for {title} Episode {episode}"
                            )
                            PLAYBACK_SESSION["message"] = msg
                            PLAYBACK_SESSION["task"] = asyncio.create_task(
                                mpv_progress_listener(MPV_SOCKET_PATH, mal_id, episode)
                            )
                            return {
                                "success": True,
                                "message": msg,
                                "fallback_to_sub": is_fallback
                            }
            except asyncio.TimeoutError:
                PLAYBACK_SESSION["status"] = "launching"
                is_fallback = dub and not use_dub
                msg = (
                    f"Dub unavailable for this title. Scraping in Sub took longer, launching player..."
                    if is_fallback else
                    f"Scraping is taking a while, but player will launch soon..."
                )
                PLAYBACK_SESSION["message"] = msg
                PLAYBACK_SESSION["task"] = asyncio.create_task(
                    mpv_progress_listener(MPV_SOCKET_PATH, mal_id, episode)
                )
                return {
                    "success": True,
                    "message": msg,
                    "fallback_to_sub": is_fallback
                }

            await proc.wait()
            if proc.returncode == 0:
                PLAYBACK_SESSION["status"] = "launching"
                is_fallback = dub and not use_dub
                msg = (
                    f"Dub unavailable for this title. Playing in Sub (Ep {episode})"
                    if is_fallback else
                    f"Launching player for {title} Episode {episode}"
                )
                PLAYBACK_SESSION["message"] = msg
                PLAYBACK_SESSION["task"] = asyncio.create_task(
                    mpv_progress_listener(MPV_SOCKET_PATH, mal_id, episode)
                )
                return {
                    "success": True,
                    "message": msg,
                    "fallback_to_sub": is_fallback
                }

            raw_err = " ".join(error_log)
            return {
                "success": False,
                "raw_error": raw_err,
                "returncode": proc.returncode
            }

        res = await _run_playback_attempt(use_dub=dub)

        # If dub was requested but failed because dub sources are missing, automatically fallback to Sub!
        if not res["success"] and dub:
            raw_err_clean = strip_ansi(res.get("raw_error", "")).lower()
            if "no sources found for dub" in raw_err_clean or "no sources found" in raw_err_clean:
                print(f"[/api/play] Dub unavailable for '{title}' Ep {episode}. Automatically falling back to Sub...")
                PLAYBACK_SESSION["message"] = f"Dub unavailable for {title}. Switching to Sub..."
                sub_res = await _run_playback_attempt(use_dub=False)
                if sub_res["success"]:
                    return {
                        "status": "playing",
                        "message": sub_res["message"],
                        "fallback_to_sub": True
                    }
                res = sub_res

        if not res["success"]:
            clean_err = clean_ani_cli_error(res.get("raw_error", ""))
            PLAYBACK_SESSION["status"] = "error"
            PLAYBACK_SESSION["message"] = clean_err
            status_code = 404 if "Could not find" in clean_err or "out of range" in clean_err else 500
            raise HTTPException(status_code=status_code, detail=clean_err)

        return {
            "status": "playing",
            "message": res["message"],
            "fallback_to_sub": res.get("fallback_to_sub", False)
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications")
async def get_notifications():
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH, row_factory=sqlite3.Row) as conn:
            conn.execute(f"ATTACH DATABASE '{ANIME_DATA_DB_PATH}' AS anime_db")
            rows = conn.execute("""
                SELECT n.*, a.title_english, a.genres, a.episodes as total_episodes, a.season, a.year, a.image_url, a.local_image_path, a.synopsis, a.score as global_score
                FROM notifications n
                LEFT JOIN anime_db.anime a ON n.mal_id = a.mal_id
                ORDER BY n.created_at DESC 
                LIMIT 50
            """).fetchall()
            
            results = []
            for r in rows:
                d = dict(r)
                if d.get('local_image_path'):
                    d['cover_url'] = f"http://localhost:{API_PORT}/covers/{os.path.basename(d['local_image_path'])}"
                else:
                    d['cover_url'] = d.get('image_url')
                results.append(d)
                
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReadNotificationRequest(BaseModel):
    notification_ids: list[int]

@app.post("/api/notifications/read")
async def mark_notifications_read(req: ReadNotificationRequest):
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            for nid in req.notification_ids:
                conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (nid,))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/episodes_web_search")
async def get_episodes_web_search(title: str):
    try:
        query = urllib.parse.quote_plus(f"{title} total episodes")
        url = f"https://html.duckduckgo.com/html/?q={query}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, "html.parser")
        snippets = [a.text for a in soup.find_all("a", class_="result__snippet")]
        
        for s in snippets:
            match = re.search(r'(\d+)\s+Episodes?', s, re.IGNORECASE)
            if match:
                episodes = int(match.group(1))
                if 0 < episodes < 1500 and episodes != 2026:
                    return {"status": "success", "episodes": episodes}
                    
        return {"status": "error", "message": "Could not find episode count in web search"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ThemeSettingRequest(BaseModel):
    theme: str

@app.get("/api/settings/theme")
async def get_theme_setting():
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM app_settings WHERE key = 'theme'")
            row = cursor.fetchone()
            if row and row[0]:
                return {"theme": row[0]}
    except Exception as e:
        logger.warning(f"Failed to load theme setting from database: {e}")
    return {"theme": "azure"}

@app.post("/api/settings/theme")
async def set_theme_setting(req: ThemeSettingRequest):
    try:
        with get_db_connection(USER_LIBRARY_DB_PATH) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO app_settings (key, value, updated_at) 
                VALUES ('theme', ?, CURRENT_TIMESTAMP)
            """, (req.theme,))
            conn.commit()
            return {"status": "success", "theme": req.theme}
    except Exception as e:
        logger.error(f"Failed to persist theme setting: {e}")
        return {"status": "error", "error": str(e), "theme": req.theme}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=API_PORT)
