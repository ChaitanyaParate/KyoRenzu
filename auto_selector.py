import sys
import os
import re
import difflib

ANSI_ESCAPE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')
PREFIX_REGEX = re.compile(r'^\s*[\(\[]?\d+[\)\]\.\:\-]?\s*')

def clean_title(s: str) -> str:
    # Remove terminal ANSI codes
    s = ANSI_ESCAPE.sub('', s)
    # Remove leading numbering like '1) ' or '[1]'
    s = PREFIX_REGEX.sub('', s)
    # Remove extra whitespace
    return s.strip().lower()

def main():
    target = os.environ.get("TARGET_ANIME_TITLE", "").strip().lower()
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        sys.exit(1)

    lines = raw_input.split('\n')
    if not target or not lines or lines == ['']:
        sys.exit(1)

    best_match = lines[0]
    best_score = -1.0

    for line in lines:
        clean = clean_title(line)
        if not clean:
            continue
        
        # Exact match gets highest score
        if target == clean:
            ratio = 1.0
        elif target in clean or clean in target:
            ratio = 0.85 + (len(target) / max(len(clean), 1)) * 0.1
        else:
            ratio = difflib.SequenceMatcher(None, target, clean).ratio()
            
        if ratio > best_score:
            best_score = ratio
            best_match = line

    print(best_match)

if __name__ == "__main__":
    main()
