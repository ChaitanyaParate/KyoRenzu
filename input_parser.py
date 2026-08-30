"""
Phase 2: Input Parser
Resolves a user's anime list (CSV, Excel, or terminal string) to mal_ids
using fuzzy string matching against the local SQLite database.
"""

import sqlite3
import pandas as pd
from rapidfuzz import process, fuzz
from typing import NamedTuple
import re
import requests

DB_PATH = "anime_data.db"
FUZZY_THRESHOLD = 82  # min score to accept a match (0–100)

# ── Alias map: common fan-name → MAL ID (for titles fuzzy can't reliably match) ─
ALIAS_TO_MAL_ID: dict[str, int] = {
    # Haikyuu
    "haikyuu": 20583, "haikyuu!!": 20583, "haikyu!!": 20583, "haikyu": 20583,
    # Konosuba
    "konosuba": 30831,
    # Re:Zero
    "re zero": 31240, "re:zero": 31240, "rezero": 31240,
    "re zero starting life in another world": 31240,
    # Love is War
    "love is war": 37999, "kaguya sama love is war": 37999, "kaguya-sama": 37999,
    # Shield Hero
    "shield hero": 35790, "rising of the shield hero": 35790,
    "the rise of the shield hero": 35790, "the rising of the shield hero": 35790,
    # Ranking of Kings
    "ranking of kings": 40834, "ranking of the kings": 40834, "ousama ranking": 40834,
    # Classroom of the Elite
    "classroom of the elite": 35507, "youkoso jitsuryoku": 35507,
    # Aharen-san
    "aharen-san": 49520, "aharen is indecipherable": 49520, "aharen san wa hakarenai": 49520,
    # GATE (JSDF)
    "gate thus the jsdf": 28907, "gate jsdf": 28907, "gate": 28907,
    # Misc popular titles
    "no game no life": 19815,
    "overlord": 29803,
    "sword art online": 11757, "sao": 11757,
    "full metal alchemist": 5114, "fma": 5114,
    "fullmetal alchemist brotherhood": 5114, "fmab": 5114,
    "one piece": 21,
    "dragon ball z": 813,
    "bleach": 269,
    "fairy tail": 6702,
    "hunter x hunter": 11061, "hxh": 11061,
    "that time i got reincarnated as a slime": 37430, "slime isekai": 37430, "tensura": 37430,
    "boku no hero academia": 31964, "bnha": 31964, "mha": 31964,
    "shingeki no kyojin": 16498, "aot": 16498,
    "kimetsu no yaiba": 38000, "demon slayer kimetsu no yaiba": 38000,
    "jujutsu kaisen": 40748, "jjk": 40748,
    "bocchi the rock": 47917,
    "spy x family": 50265,
    "chainsaw man": 44511,
    "vinland saga": 37521,
    "made in abyss": 34599,
    "frieren": 52991, "frieren beyond journeys end": 52991,
    "oshi no ko": 53446,
    "eighty six": 41457, "86": 41457, "86 eighty-six": 41457,
}





MAL_URL_PATTERN = r"(?:https?://)?myanimelist\.net/(?:animelist|profile)/([^/?#]+)"
ANILIST_URL_PATTERN = r"(?:https?://)?anilist\.co/user/([^/?#]+)"


class AnimeEntry(NamedTuple):
    mal_id: int
    title: str
    title_english: str | None
    title_japanese: str | None
    genres: str
    score: float | None
    local_image_path: str | None
    weight: float = 1.0  # from Worth Level column; 1.0 if not present


def _load_title_map() -> dict[int, dict]:
    """Load all anime titles from DB into a lookup dict."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT mal_id, title, title_english, title_japanese, genres, score, local_image_path
        FROM anime
    """)
    rows = c.fetchall()
    conn.close()

    title_map = {}
    for row in rows:
        mal_id, title, title_en, title_jp, genres, score, img_path = row
        title_map[mal_id] = {
            "title": title or "",
            "title_english": title_en or "",
            "title_japanese": title_jp or "",
            "genres": genres or "",
            "score": score,
            "local_image_path": img_path,
        }
    return title_map


def _fuzzy_match(query: str, title_map: dict[int, dict]) -> AnimeEntry | None:
    """Find the best-matching anime for a query string."""
    q = query.strip()

    # Skip queries that are just numbers or very short (likely row IDs / episode counts)
    if q.isdigit() or len(q) <= 2:
        return None

    # ── 1. Check alias dictionary first (exact, case-insensitive) ────────────
    alias_key = q.lower().strip("!?.'\" ")
    if alias_key in ALIAS_TO_MAL_ID:
        mal_id = ALIAS_TO_MAL_ID[alias_key]
        if mal_id in title_map:
            info = title_map[mal_id]
            return AnimeEntry(
                mal_id=mal_id,
                title=info["title"],
                title_english=info["title_english"],
                title_japanese=info["title_japanese"],
                genres=info["genres"],
                score=info["score"],
                local_image_path=info["local_image_path"],
            ), 100.0

    # ── 2. Fuzzy match against all DB titles ──────────────────────────────────
    # Build a flat list of (mal_id, candidate_title) for all titles + aliases
    candidates = []
    for mal_id, info in title_map.items():
        for t in [info["title"], info["title_english"], info["title_japanese"]]:
            if t:
                candidates.append((mal_id, t))

    choices = [c[1] for c in candidates]
    result = process.extractOne(
        q,
        choices,
        scorer=fuzz.WRatio,
        score_cutoff=FUZZY_THRESHOLD,
    )
    if result is None:
        return None

    matched_title = result[0]
    score = result[1]
    idx = choices.index(matched_title)
    mal_id = candidates[idx][0]
    info = title_map[mal_id]

    # Extra guard: if the matched title is much shorter than the query,
    # it's likely a false positive (e.g. 'Love Is War' → 'Love')
    matched_len = len(matched_title)
    query_len = len(q)
    if matched_len < query_len * 0.45 and score < 95:
        return None

    return AnimeEntry(
        mal_id=mal_id,
        title=info["title"],
        title_english=info["title_english"],
        title_japanese=info["title_japanese"],
        genres=info["genres"],
        score=info["score"],
        local_image_path=info["local_image_path"],
    ), score



def parse_terminal_input(raw: str) -> list[AnimeEntry]:
    """
    Parse a comma or newline-separated string of anime titles.
    Example: "Naruto, Death Note, Attack on Titan"
    """
    titles = [t.strip() for t in raw.replace("\n", ",").split(",") if t.strip()]
    return _resolve_titles(titles)


def parse_csv(filepath: str) -> list[AnimeEntry]:
    """
    Parse a CSV file. Expected column: 'title' or 'mal_id'.
    Falls back to the first column if neither is found.
    """
    df = pd.read_csv(filepath)
    return _resolve_dataframe(df)


def parse_excel(filepath: str) -> list[AnimeEntry]:
    """
    Parse an Excel file (.xlsx). Expected column: 'title' or 'mal_id'.
    """
    df = pd.read_excel(filepath)
    return _resolve_dataframe(df)


def _resolve_dataframe(df: pd.DataFrame) -> list[AnimeEntry]:
    df.columns = [c.strip().lower() for c in df.columns]

    # ── 1. Direct mal_id column ──────────────────────────────────────────────
    if "mal_id" in df.columns:
        return _resolve_by_ids(df["mal_id"].dropna().astype(int).tolist())

    # ── 2. Look for obvious title column names ───────────────────────────────
    TITLE_KEYWORDS = ["title", "anime", "name", "show", "series"]
    title_col = None
    for keyword in TITLE_KEYWORDS:
        for col in df.columns:
            if keyword in col:
                title_col = col
                break
        if title_col:
            break

    # ── 3. Heuristic: pick the string column with longest average value ───────
    if title_col is None:
        best_score = -1
        for col in df.columns:
            col_series = df[col].dropna().astype(str)
            # Skip columns that look like numbers (IDs, episode counts)
            numeric_ratio = col_series.str.match(r'^\d+$').mean()
            if numeric_ratio > 0.5:
                continue
            avg_len = col_series.str.len().mean()
            unique_ratio = col_series.nunique() / max(len(col_series), 1)
            col_score = avg_len * unique_ratio
            if col_score > best_score:
                best_score = col_score
                title_col = col

    if title_col is None:
        raise ValueError(
            "Could not identify a title column in your CSV/Excel file. "
            "Please add a column named 'title', 'anime', or 'name'."
        )

    print(f"  [input_parser] Using column '{title_col}' as anime titles.")

    # ── 4. Detect optional Score column ────────────────────────────────
    SCORE_KEYWORDS = ["score", "rating", "my_score", "your score"]
    score_col = None
    for keyword in SCORE_KEYWORDS:
        for col in df.columns:
            if keyword in col:
                score_col = col
                break
        if score_col:
            break

    if score_col:
        print(f"  [input_parser] Found score column: '{score_col}' — weighting embeddings.")

    titles = df[title_col].dropna().astype(str).str.strip().tolist()
    # Build (title, weight) pairs
    score_series = pd.to_numeric(df[score_col], errors='coerce').fillna(0) if score_col else None
    title_weight_pairs = []
    for i, t in enumerate(df[title_col].astype(str).str.strip()):
        if not t or t.lower() == 'nan':
            continue
        w = 1.0
        if score_series is not None:
            score = score_series.iloc[i] if i < len(score_series) else 0
            # Scale score to weight
            if score == 0: w = 1.0
            elif score >= 9.5: w = 2.0
            elif score >= 8.5: w = 1.6
            elif score >= 7.5: w = 1.2
            elif score >= 6.5: w = 1.0
            elif score >= 5.5: w = 0.8
            elif score >= 4.0: w = 0.5
            elif score >= 2.0: w = 0.3
            else: w = 0.1
        title_weight_pairs.append((t, w))
    return _resolve_titles_weighted(title_weight_pairs)


def _resolve_by_ids(mal_ids: list[int]) -> list[AnimeEntry]:
    title_map = _load_title_map()
    results = []
    for mid in mal_ids:
        if mid in title_map:
            info = title_map[mid]
            results.append(AnimeEntry(
                mal_id=mid,
                title=info["title"],
                title_english=info["title_english"],
                title_japanese=info["title_japanese"],
                genres=info["genres"],
                score=info["score"],
                local_image_path=info["local_image_path"],
                weight=1.0,
            ))
        else:
            print(f"  [input_parser] WARNING: mal_id {mid} not found in DB.")
    return results


def _resolve_titles(titles: list[str]) -> list[AnimeEntry]:
    """Resolve a plain list of title strings (all weight=1.0)."""
    return _resolve_titles_weighted([(t, 1.0) for t in titles])


def _resolve_titles_weighted(title_weight_pairs: list[tuple[str, float]]) -> list[AnimeEntry]:
    """Resolve titles and attach per-entry weights from Worth Level."""
    title_map = _load_title_map()
    results = []
    seen_ids = set()

    for query, weight in title_weight_pairs:
        result = _fuzzy_match(query, title_map)
        if result is None:
            print(f"  [input_parser] WARNING: No match found for '{query}' (threshold={FUZZY_THRESHOLD})")
            continue

        match, score = result
        if match.mal_id in seen_ids:
            continue
        seen_ids.add(match.mal_id)

        display_title = match.title_english or match.title
        weight_tag = f", weight={weight:.1f}" if weight != 1.0 else ""
        print(f"  [input_parser] '{query}' → '{display_title}' (mal_id={match.mal_id}, score={score:.0f}{weight_tag})")
        results.append(match._replace(weight=weight))

    return results


def _fetch_mal_user_list(username: str) -> list[tuple[int, float]]:
    """Fetch user's list from MyAnimeList and return (mal_id, weight) pairs."""
    print(f"  [input_parser] Fetching MyAnimeList profile for '{username}'...")
    results = []
    offset = 0
    while True:
        url = f"https://myanimelist.net/animelist/{username}/load.json?status=7&offset={offset}"
        try:
            res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if res.status_code != 200:
                print(f"  [input_parser] WARNING: Failed to fetch MAL list (Status: {res.status_code})")
                break
            
            data = res.json()
            if not data:
                break
                
            for item in data:
                mal_id = item.get("anime_id")
                score = item.get("score", 0)
                if not mal_id:
                    continue
                    
                # Map score to weight
                if score == 0: weight = 1.0
                elif score >= 9.5: weight = 2.0
                elif score >= 8.5: weight = 1.6
                elif score >= 7.5: weight = 1.2
                elif score >= 6.5: weight = 1.0
                elif score >= 5.5: weight = 0.8
                elif score >= 4.0: weight = 0.5
                elif score >= 2.0: weight = 0.3
                else: weight = 0.1
                    
                results.append((mal_id, weight))
                
            offset += 300
        except Exception as e:
            print(f"  [input_parser] ERROR fetching MAL list: {e}")
            break
            
    print(f"  [input_parser] Extracted {len(results)} anime from MAL profile.")
    return results

def _fetch_anilist_user_list(username: str) -> list[tuple[int, float]]:
    """Fetch user's list from AniList and return (mal_id, weight) pairs."""
    print(f"  [input_parser] Fetching AniList profile for '{username}'...")
    query = '''
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          entries {
            score
            media {
              idMal
            }
          }
        }
      }
    }
    '''
    results = []
    url = 'https://graphql.anilist.co'
    try:
        res = requests.post(url, json={'query': query, 'variables': {'userName': username}}, 
                            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, timeout=10)
        if res.status_code != 200:
            print(f"  [input_parser] WARNING: Failed to fetch AniList profile (Status: {res.status_code})")
            return results
            
        data = res.json().get('data', {}).get('MediaListCollection', {}).get('lists', [])
        for lst in data:
            for entry in lst.get('entries', []):
                media = entry.get('media', {})
                if not media: continue
                mal_id = media.get('idMal')
                if not mal_id: continue
                
                score = entry.get('score', 0)
                
                # Normalize AniList scores to 10-point scale first
                norm_score = 0
                if score == 0:
                    pass
                elif score > 10:  # 100-point scale
                    norm_score = score / 10.0
                elif 0 < score <= 5.0 and score.is_integer(): # 5-star scale (approximate heuristic: integers 1-5)
                    # It's hard to perfectly guess 5-star vs 10-point if it's 1-5. 
                    # Assuming AniList standard 10-point decimal is common, 
                    # but if it's 5-star, a 5 = 10, 4 = 8, 3 = 6. 
                    # Let's just treat everything <= 10 as a 10-point scale.
                    # If it was actually 5-star, users should switch to 10-point on Anilist or we just double it.
                    # For safety, let's assume 10-point scale if it's not > 10.
                    norm_score = float(score)
                else:
                    norm_score = float(score)

                if norm_score == 0: weight = 1.0
                elif norm_score >= 9.5: weight = 2.0
                elif norm_score >= 8.5: weight = 1.6
                elif norm_score >= 7.5: weight = 1.2
                elif norm_score >= 6.5: weight = 1.0
                elif norm_score >= 5.5: weight = 0.8
                elif norm_score >= 4.0: weight = 0.5
                elif norm_score >= 2.0: weight = 0.3
                else: weight = 0.1
                    
                results.append((mal_id, weight))
                
    except Exception as e:
        print(f"  [input_parser] ERROR fetching AniList profile: {e}")
        
    print(f"  [input_parser] Extracted {len(results)} anime from AniList profile.")
    return results

def _resolve_by_id_weights(id_weight_pairs: list[tuple[int, float]]) -> list[AnimeEntry]:
    """Resolve (mal_id, weight) pairs from URL imports."""
    title_map = _load_title_map()
    results = []
    for mid, weight in id_weight_pairs:
        if mid in title_map:
            info = title_map[mid]
            results.append(AnimeEntry(
                mal_id=mid,
                title=info["title"],
                title_english=info["title_english"],
                title_japanese=info["title_japanese"],
                genres=info["genres"],
                score=info["score"],
                local_image_path=info["local_image_path"],
                weight=weight,
            ))
    return results


def auto_parse(source: str) -> list[AnimeEntry]:
    """
    Auto-detect input type from the source string:
    - URL → MAL or AniList profile fetch
    - Ends with .csv → CSV file
    - Ends with .xlsx or .xls → Excel file
    - Otherwise → treat as comma-separated terminal input
    """
    sl = source.strip().lower()
    
    mal_match = re.search(MAL_URL_PATTERN, sl)
    if mal_match:
        id_weights = _fetch_mal_user_list(mal_match.group(1))
        return _resolve_by_id_weights(id_weights)
        
    anilist_match = re.search(ANILIST_URL_PATTERN, sl)
    if anilist_match:
        id_weights = _fetch_anilist_user_list(anilist_match.group(1))
        return _resolve_by_id_weights(id_weights)
        
    if sl.endswith(".csv"):
        return parse_csv(source.strip())
    elif sl.endswith(".xlsx") or sl.endswith(".xls"):
        return parse_excel(source.strip())
    else:
        return parse_terminal_input(source)


def get_all_raw_titles(source: str) -> list[str]:
    """
    Extract ALL raw title strings from the source WITHOUT fuzzy matching.
    Used for post-filter exclusion so even unmatched titles block results.

    Returns a flat list of lowercased title strings.
    """
    sl = source.strip().lower()

    # URLs don't have raw titles; the ID filtering natively excludes them all anyway
    if re.search(MAL_URL_PATTERN, sl) or re.search(ANILIST_URL_PATTERN, sl):
        return []

    if sl.endswith(".csv"):
        df = pd.read_csv(source.strip())
    elif sl.endswith(".xlsx") or sl.endswith(".xls"):
        df = pd.read_excel(source.strip())
    else:
        # Terminal input — split by comma
        return [t.strip().lower() for t in source.replace("\n", ",").split(",") if t.strip()]

    df.columns = [c.strip().lower() for c in df.columns]

    # Find the title column (same logic as _resolve_dataframe)
    TITLE_KEYWORDS = ["title", "anime", "name", "show", "series"]
    title_col = None
    for keyword in TITLE_KEYWORDS:
        for col in df.columns:
            if keyword in col:
                title_col = col
                break
        if title_col:
            break

    if title_col is None:
        # Heuristic fallback
        for col in df.columns:
            col_series = df[col].dropna().astype(str)
            numeric_ratio = col_series.str.match(r'^\d+$').mean()
            if numeric_ratio < 0.5:
                title_col = col
                break

    if title_col is None:
        return []

    titles = df[title_col].dropna().astype(str).str.strip().str.lower().tolist()
    return [t for t in titles if t and t != "nan"]


if __name__ == "__main__":
    # Quick test
    results = parse_terminal_input("Cowboy Bebop, death note, attack on titan")
    for r in results:
        print(r)

