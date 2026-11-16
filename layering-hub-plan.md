# Layering Hub: Build Plan

Builds [layering-hub-design.md](layering-hub-design.md) (approved 2026-10-28)
onto the published dupe finder. Everything lives in `perfume-dupe-finder/`.

## 1. Layering engine: `layer.js` (new)

UMD module like `match.js` (`window.LayerMatch` / `module.exports`), pure
functions, ASCII-only source. Uses the index from `DupeMatch.buildIndex`.

- `heaviness(idx, p)`: share of base notes (all notes if no base) in Amber,
  Gourmand, Resin & incense, Oud, Wood, Smoke & leather; musk left out.
  Heavy = 0.5 or more.
- `affinity(idx, a, b)` for two note ids, from perfumery-principles.md:
  wheel distance table, musk +1, Other 0, classic pairings +2, clashes −2
  (Ambergris/Ambroxan family exempt from amber + aquatic).
- `pair(idx, A, B)` → `{smell, sillage, projection, longevity, overall, basedOn,
  capped, reasons, advice, tooSimilar, cheaper}`:
  - smell: layer- and rarity-weighted mean affinity mapped to 0–100, plus
    bridge-note bonus, accord bonus (chypre, fougère, amber), heavy + heavy and
    citrus + citrus penalties.
  - performance: max(A, B) + 0.5 when both ≥ 3, capped at 5, as %.
  - overall: 55/15/15/15 over available scores, renormalised; capped at 50
    when smell < 45.
  - advice: spray order by heaviness, pulse points (precedence from the
    design), 1:2 ratio when sillage differs by 2+, staggering for two citrus
    openings, skin test.
  - cheaper: "same combo for less" from curated known dupes (reverse lookup).
- `suggest(idx, p, ids)`: score `p` against My collection, rank by smell,
  top 5, each with one reason.
- Perfumes with no notes return `{unscorable: true}`.

## 2. Tests: `layer.test.js` (new)

Node, exits 1 on failure:
- all scores in 0–100; overall ≤ 50 whenever smell < 45
- weights: with no performance data, overall equals smell
- spot checks score well: a vanilla gourmand + an amber woody; Khamrah + a
  vanilla perfume; amber + musk perfumes
- known clash scores low: an oud-heavy perfume + a marine aquatic
- spray order puts the heavier first; advice never says "same pulse point"
  below 70
- a no-notes perfume is unscorable; suggestions skip it and the chosen one
- same combo for less finds Club de Nuit Intense Man for Aventus

## 3. Page: hub tabs, Layer, My collection (`page.html`)

- Header renamed to a hub ("Perfume Dupe & Layering Finder"? keep the existing
  mark, add the tabs **Layer** | **Find dupes** | **My collection**).
  Opens on Layer; `#<id>` opens Find dupes; `#layer~a~b`, `#layer~a`,
  `#collection` open their views.
- Layer view: two pickers (A, B) reusing the search combobox; result card with
  overall %, four sub-score bars ("No data yet" where missing), reasons,
  advice list, "too alike" note, same combo for less. Below: suggestions for
  A from My collection (empty state with Add button).
- Every perfume card: "Find dupes", "Layer with this", "Add to My collection"
  / "In My collection".
- My collection view: list with remove, missing-perfume notice, browser-only
  notice + "Copy list".
- Storage: `db` + `user` capabilities; doc
  `data/users/<id>/collection` `{ids:[...]}`; falls back to localStorage when
  db/user is null or a write is refused; merges the browser copy once into the
  account copy. Max 500.
- `build_page.py` inlines `layer.js` too.

## 4. Check and publish

- `node match.test.js && node layer.test.js`, build, preview locally in the
  browser pane at phone and desktop widths, both themes.
- Republish to https://claude.ai/artifact/4Gwn9xpYZWR9oBe9mWZgFL with
  capabilities `{sample:{}, db:{}, user:{}}`.
- REFRESH.md: performance batch 30 → 60.
