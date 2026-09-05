import os
import sys
import shutil
from appdirs import user_data_dir

APP_NAME = "KyoRenzu"
APP_AUTHOR = "KyoRenzuApp"

# Resolves the path to the bundled resource (when using PyInstaller + Electron)
def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        # When frozen by PyInstaller, sys.executable is the binary path.
        # We will place the binary in resources/api/api, so resources/ is two dirs up.
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(sys.executable)))
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# App Data Directory
APP_DATA_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
os.makedirs(APP_DATA_DIR, exist_ok=True)

# OS-level Paths for mutable state
USER_LIBRARY_DB_PATH = os.path.join(APP_DATA_DIR, "user_library.db")
ANIME_DATA_DB_PATH = os.path.join(APP_DATA_DIR, "anime_data.db")
COVERS_DIR = os.path.join(APP_DATA_DIR, "covers")
os.makedirs(COVERS_DIR, exist_ok=True)

# Cache JSON paths
EMBEDDING_INDEX_PATH = os.path.join(APP_DATA_DIR, "embedding_index.json")
GENRE_CORRELATION_PATH = os.path.join(APP_DATA_DIR, "genre_correlation.json")
LIBRARY_CACHE_PATH = os.path.join(APP_DATA_DIR, "library_cache.json")
SYNOPSIS_INDEX_PATH = os.path.join(APP_DATA_DIR, "synopsis_index.json")

# Numpy embedding paths (Mutable, stored in AppData after download)
COVER_EMBEDDINGS_PATH = os.path.join(APP_DATA_DIR, "cover_embeddings.npy")
SYNOPSIS_EMBEDDINGS_PATH = os.path.join(APP_DATA_DIR, "synopsis_embeddings.npy")

def init_app_data():
    """ Copies initial small databases to AppData if they don't exist """
    bundled_user_db = get_resource_path("user_library.db")
    if os.path.exists(bundled_user_db) and not os.path.exists(USER_LIBRARY_DB_PATH):
        print(f"Copying bundled user_library.db to {USER_LIBRARY_DB_PATH}")
        shutil.copy(bundled_user_db, USER_LIBRARY_DB_PATH)
        
    for idx_file in ["embedding_index.json", "synopsis_index.json"]:
        src = get_resource_path(idx_file)
        dst = os.path.join(APP_DATA_DIR, idx_file)
        if os.path.exists(src) and not os.path.exists(dst):
            print(f"Copying bundled {idx_file} to {dst}")
            shutil.copy(src, dst)

# Initialize on import
init_app_data()
