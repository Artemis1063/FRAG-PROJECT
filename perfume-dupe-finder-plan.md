# Perfume Dupe Finder: Build Plan

Design: [perfume-dupe-finder-design.md](perfume-dupe-finder-design.md)

## One change from the design, found while planning

The artifact database (`db`) is only available to **signed-in** claude.ai
visitors ("a signed-out visitor has no data at all"). Keeping the perfume data
there would leave signed-out visitors with an empty page. So the data is
**embedded in the page**, and the weekly refresh **regenerates and republishes
the page** with fresh data. Same result for the requester (data stays current,
same link), and it works for everyone. Size is fine: ~1.5 MB of data against a
16 MB page limit.

## Files (this session's folder)

```
perfume-dupe-finder/
  data/scento/            downloaded Scento snapshot (perfumes.jsonl, materials.csv)
  data/supplements/       researched additions, one JSON file per research batch
  build_data.py           Scento + supplements -> data.json (normalized, compact)
  data.json               the merged perfume data
  match.js                the matching engine (pure functions, no DOM)
  match.test.js           node tests: spot-check pairs and rule checks
  page.html               the page template (UI, inlines match.js and data)
  build_page.py           page.html + match.js + data.json -> dist/index.html
  dist/index.html         what gets published
  REFRESH.md              the weekly refresh instructions the scheduled task follows
```

## Tasks

### 1. Data pipeline (`build_data.py`)
- Read Scento `perfumes.jsonl` and `materials.csv`.
- Note vocabulary: canonical id per material, aliases from `materials.csv` plus
  a small hand list (e.g. "Ambroxan" → ambergris family); family per note from
  `material_family`.
- Normalize each perfume to a compact record: `id, n (name), b (brand), c
  (concentration), y, al (aliases), t/h/ba (note ids by layer), f (family), ch
  (character), p (price/100ml USD), pd (price date), tier, d (dupeOf ids), perf
  {lon, sil, proj}, ac (accords), src, conf`.
- Merge every `data/supplements/*.json` over the Scento records (supplements
  can add perfumes or patch fields; later files win). Every supplement record
  carries `sources` (URLs); a new perfume with fewer than two sources gets
  `conf: "low"`.
- Price tier from price: budget < $40, mid < $90, designer < $200, niche ≥ $200
  per 100 ml. Brands with no price fall back to a brand-level default tier.
- Output `data.json` plus a stats line (counts, how many priced, how many
  with performance, notes not found in the vocabulary).
- Check: run it; zero unknown notes left unmapped silently (they're logged
  and added to the vocabulary as their own family "other").

### 2. Research pass (parallel subagents, each writes one supplement file)
Each agent: web research from brand sites, authorized retailers, fragrance
press and recurring community consensus; **no Fragrantica copying**; two
sources per new perfume's notes; record source URLs; output strict JSON.
- **A. Missing brands, originals:** about 15 most-searched Chanel perfumes.
- **B. Missing brands, alternatives:** Zara, Dossier, Alexandria Fragrances,
  Maison Alhambra (about 15–20 each, the ones known as dupes), each with the
  original it's inspired by.
- **C. Dupe pairs:** about 120 widely recommended dupe → original pairs among
  perfumes in the data or added by A/B.
- **D. Prices:** approximate USD per 100 ml for the ~250 most popular
  perfumes (Scento `popularity_rank` first) plus all dupe-house perfumes in C.
- **E. Performance:** longevity, sillage, projection (1–5) for the same ~250.
- Then: rebuild `data.json`, review stats, spot-check 10 random researched
  records against their sources.

### 3. Matching engine (`match.js`) — test first
Pure functions: `buildIndex(data)`, `search(query)` (fuzzy name/brand/alias),
`findDupes(id)` and `findDupesForPyramid(pyramid)` (for live lookups).
Rules per the design: layer weights 0.25/0.35/0.40, IDF note weights, family
and cross-layer partial credit (also IDF-weighted), known dupes always shown
first with raw score, cheaper = ≥30% less, unknown price never filtered, top
10, weak-match cutoff; budget/mid originals get the two-section result.
Tests (`node match.test.js`):
- known pairs rank in the top 3 (e.g. Lattafa Khamrah → Kilian Angels' Share
  if both present; Armaf Club de Nuit Intense Man → Creed Aventus).
- a perfume sharing only musk/vanilla/bergamot scores below the cutoff.
- no result costs ≥ 70% of the original's price.
- search finds "BR540", "baccarat", and a one-typo name.

### 4. Page (`page.html`, `build_page.py`)
Load the artifact-design skill first. Single page, phone-first, light/dark.
Search with suggestions → chosen perfume card → ranked result cards (score,
price and % cheaper, shared notes by layer, badges, performance row,
Fragrantica search link) → deep links via `#p=<id>` → live lookup button on a
miss (sample capability, labeled unverified, graceful when unavailable) →
footer (Scento credit, data date, disclaimer).
Check in the browser pane at phone and desktop width; try 5 searches including
a miss.

### 5. Publish
Publish `dist/index.html` as an Artifact with `capabilities: {sample: {}}`.
Open it, run a live lookup once.

### 6. Weekly refresh
Write `REFRESH.md` (re-download Scento, research new releases/dupes, update the
30 oldest prices and 30 missing performance entries, rebuild, run tests, and
republish to the same URL only if tests pass). Create a weekly scheduled task
that follows it. Run it once by hand to prove it works.
