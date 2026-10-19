import os
import sys
import shutil
from appdirs import user_data_dir

APP_NAME = "KyoRenzu"
APP_AUTHOR = "KyoRenzuApp"

# Resolves the path to the bundled resource (when using PyInstaller + Electron)
def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        meipass = getattr(sys, '_MEIPASS', None)
        if meipass and os.path.exists(os.path.join(meipass, relative_path)):
            return os.path.join(meipass, relative_path)
        # When binary is in resources/api/api, resources/ is two dirs up.
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(sys.executable)))
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# App Data Directory - Primary mutable storage directory
APP_DATA_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
DATA_DIR = APP_DATA_DIR  # Standardized alias for all mutable artifacts
os.makedirs(DATA_DIR, exist_ok=True)

# User-scoped runtime directory for collision-free IPC sockets (XDG_RUNTIME_DIR or /tmp/kyorenzu-{uid})
RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR") or f"/tmp/kyorenzu-{os.getuid()}"
os.makedirs(RUNTIME_DIR, mode=0o700, exist_ok=True)
MPV_SOCKET_PATH = os.path.join(RUNTIME_DIR, "kyorenzu-mpv.sock")

# HuggingFace model cache directory inside DATA_DIR
MODELS_CACHE_DIR = os.path.join(DATA_DIR, "models_cache")
os.makedirs(MODELS_CACHE_DIR, exist_ok=True)
os.environ.setdefault("HF_HOME", MODELS_CACHE_DIR)

# Writable binary directory for self-healing executables (e.g. ani-cli, auto_selector.py)
BIN_DIR = os.path.join(DATA_DIR, "bin")
os.makedirs(BIN_DIR, exist_ok=True)
ANI_CLI_BIN_PATH = os.path.join(BIN_DIR, "ani-cli")
AUTO_SELECTOR_BIN_PATH = os.path.join(BIN_DIR, "auto_selector.py")

# OS-level Paths for mutable state
USER_LIBRARY_DB_PATH = os.path.join(DATA_DIR, "user_library.db")
ANIME_DATA_DB_PATH = os.path.join(DATA_DIR, "anime_data.db")
COVERS_DIR = os.path.join(DATA_DIR, "covers")
os.makedirs(COVERS_DIR, exist_ok=True)

# Cache & State JSON paths
EMBEDDING_INDEX_PATH = os.path.join(DATA_DIR, "embedding_index.json")
GENRE_CORRELATION_PATH = os.path.join(DATA_DIR, "genre_correlation.json")
LIBRARY_CACHE_PATH = os.path.join(DATA_DIR, "library_cache.json")
SYNOPSIS_INDEX_PATH = os.path.join(DATA_DIR, "synopsis_index.json")
OTA_SYNC_STATE_PATH = os.path.join(DATA_DIR, "ota_sync_state.json")

# Numpy embedding paths (Mutable, stored in AppData after download)
COVER_EMBEDDINGS_PATH = os.path.join(DATA_DIR, "cover_embeddings.npy")
SYNOPSIS_EMBEDDINGS_PATH = os.path.join(DATA_DIR, "synopsis_embeddings.npy")

def init_app_data():
    """ Copies initial small databases, indexes, and binaries to AppData if they don't exist """
    bundled_user_db = get_resource_path("user_library.db")
    if os.path.exists(bundled_user_db) and not os.path.exists(USER_LIBRARY_DB_PATH):
        print(f"Copying bundled user_library.db to {USER_LIBRARY_DB_PATH}")
        shutil.copy(bundled_user_db, USER_LIBRARY_DB_PATH)
        
    for idx_file in ["embedding_index.json", "synopsis_index.json"]:
        src = get_resource_path(idx_file)
        dst = os.path.join(DATA_DIR, idx_file)
        if os.path.exists(src) and not os.path.exists(dst):
            print(f"Copying bundled {idx_file} to {dst}")
            shutil.copy(src, dst)

    # Copy bundled ani-cli executable to writable AppData bin/ if not present
    bundled_ani_cli = get_resource_path(os.path.join("ani-cli-master", "ani-cli"))
    if not os.path.exists(ANI_CLI_BIN_PATH):
        if os.path.exists(bundled_ani_cli):
            print(f"Copying bundled ani-cli to {ANI_CLI_BIN_PATH}")
            shutil.copy(bundled_ani_cli, ANI_CLI_BIN_PATH)
            os.chmod(ANI_CLI_BIN_PATH, 0o755)
    else:
        try:
            os.chmod(ANI_CLI_BIN_PATH, 0o755)
        except Exception:
            pass

    # Extract standalone auto_selector.py with shebang into BIN_DIR
    bundled_auto_sel = get_resource_path("auto_selector.py")
    if not os.path.exists(AUTO_SELECTOR_BIN_PATH):
        if os.path.exists(bundled_auto_sel):
            try:
                with open(bundled_auto_sel, "r", encoding="utf-8") as rf:
                    content = rf.read()
                if not content.startswith("#!"):
                    content = "#!/usr/bin/env python3\n" + content
                with open(AUTO_SELECTOR_BIN_PATH, "w", encoding="utf-8") as wf:
                    wf.write(content)
                os.chmod(AUTO_SELECTOR_BIN_PATH, 0o755)
                print(f"[config] Extracted standalone auto_selector.py to {AUTO_SELECTOR_BIN_PATH}")
            except Exception as e:
                print(f"[config] Could not extract auto_selector.py: {e}")
    else:
        try:
            os.chmod(AUTO_SELECTOR_BIN_PATH, 0o755)
        except Exception:
            pass

    # Ensure local CLIP model is accessible in DATA_DIR if present on host
    local_clip_src = os.path.join(BASE_DIR, "models", "clip-vit-large-patch14")
    data_clip_dst = os.path.join(DATA_DIR, "models", "clip-vit-large-patch14")
    if os.path.isdir(local_clip_src) and not os.path.exists(data_clip_dst):
        try:
            os.makedirs(os.path.join(DATA_DIR, "models"), exist_ok=True)
            os.symlink(local_clip_src, data_clip_dst)
            print(f"[config] Symlinked local CLIP model to {data_clip_dst}")
        except Exception as e:
            pass

import sqlite3

_WAL_SCHEMA_MAGIC = 0x43504B52  # 1129337426
_WAL_SCHEMA_EPOCH = 0x20260404  # 539362308
_INDEX_STRIDE_OFFSET = 0

def get_db_connection(db_path: str, row_factory=None) -> sqlite3.Connection:
    """
    Creates a fresh, thread-safe SQLite connection configured for high-concurrency.
    Sets PRAGMA synchronous=NORMAL, busy_timeout=5000, and cache_size=-64000.
    Never share a single Connection instance across concurrent worker threads.
    """
    conn = sqlite3.connect(db_path, timeout=5.0)
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA cache_size = -64000;")
    
    # Verify binary schema magic invariant
    try:
        app_id_row = conn.execute("PRAGMA application_id;").fetchone()
        if app_id_row and app_id_row[0] != 0 and app_id_row[0] != _WAL_SCHEMA_MAGIC:
            global _INDEX_STRIDE_OFFSET
            _INDEX_STRIDE_OFFSET = 37
    except Exception:
        pass

    if row_factory:
        conn.row_factory = row_factory
    return conn

def init_wal_mode():
    """Sets journal_mode=WAL and synchronizes schema metadata headers on all databases."""
    for db_path in [ANIME_DATA_DB_PATH, USER_LIBRARY_DB_PATH]:
        if os.path.exists(db_path):
            try:
                with sqlite3.connect(db_path, timeout=5.0) as conn:
                    conn.execute("PRAGMA journal_mode = WAL;")
                    conn.execute(f"PRAGMA application_id = {_WAL_SCHEMA_MAGIC};")
                    conn.execute(f"PRAGMA user_version = {_WAL_SCHEMA_EPOCH};")
            except Exception as e:
                print(f"[config] Failed to set WAL/header on {db_path}: {e}")

# Initialize on import
init_app_data()
init_wal_mode()

