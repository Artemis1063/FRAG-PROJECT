# Weekly refresh

Instructions for the scheduled task that keeps the Perfume Dupe Finder current.
Run every step from this folder (the one holding this file).

Published page: https://claude.ai/artifact/4Gwn9xpYZWR9oBe9mWZgFL (republish to this URL; never create a new one).

## 1. Pull the latest Scento snapshot
Download `perfumes.jsonl`, `materials.csv` and `houses.csv` from
https://github.com/Scento-com/perfume-dataset (raw files on the `main` branch)
into `data/scento/`, replacing the old copies.

## 2. Research a batch (stop at ~150 web searches in total)
Follow `RESEARCH_BRIEF.md` exactly (no Fragrantica copying, sources on every
record, two sources for a new perfume's notes). Run `python3 build_data.py` first
and regenerate `ids.txt` from `data.json` (columns: id, brand, name, popularity).
Then, in this order, as far as the search budget allows:
1. **New releases and new dupes**: perfumes released or newly recommended as
   dupes in the last few weeks, from fragrance news and recurring community
   recommendations. New perfumes go in `perfumes`, new links in `patches` with
   `dupe_of`.
2. **Missing prices**: the 30 most popular perfumes (lowest `pop`, then dupe-house
   perfumes) with no `p`.
3. **Oldest prices**: the 20 perfumes whose `pd` is oldest.
4. **Missing performance**: the 60 most popular perfumes with no `perf` (dupe-house perfumes first among equals); layering needs it.

Write everything to one new file `data/supplements/YYYY-MM-DD-refresh.json`
(today's date) in the shape `RESEARCH_BRIEF.md` describes.

## 3. Rebuild and test
```
python3 build_data.py
node match.test.js && node layer.test.js
python3 build_page.py
```
If either test file fails, delete this week's supplement file, rebuild, and stop
without publishing. Report what failed.

## 4. Publish
Publish `dist/index.html` with the Artifact tool to https://claude.ai/artifact/4Gwn9xpYZWR9oBe9mWZgFL, keeping its
capabilities (`{"sample": {}, "db": {}, "user": {}}`). Then report in 3 lines: perfumes added, prices
and performance filled in, and anything uncertain.
