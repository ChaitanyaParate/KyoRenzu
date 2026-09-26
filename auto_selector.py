#!/usr/bin/env python3
import sys
import os
import difflib

target = os.environ.get("TARGET_ANIME_TITLE", "").lower()
lines = sys.stdin.read().strip().split('\n')

if not target or not lines or lines == ['']:
    sys.exit(1)

best_match = lines[0]
best_ratio = 0

for line in lines:
    clean_line = line.strip()
    ratio = difflib.SequenceMatcher(None, target, clean_line.lower()).ratio()
    if ratio > best_ratio:
        best_ratio = ratio
        best_match = line

print(best_match)
