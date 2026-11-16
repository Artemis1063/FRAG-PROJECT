# Research brief (shared by all research agents)

You are researching perfume facts for a perfume dupe finder. Accuracy matters
more than volume: skip anything you can't confirm.

## Rules
- Use public sources: brand websites, authorized retailers (Sephora, Ulta,
  Nordstrom, Macy's, Notino, FragranceNet, the brand's own shop), fragrance press
  and blogs, and recurring community consensus (Reddit r/fragrance,
  r/DesiFragranceAddicts, r/FragranceClones, Basenotes, Parfumo).
- Do NOT fetch or copy from fragrantica.com (its terms forbid it). Use other sources.
- Note pyramids for new perfumes need two sources that agree (the brand plus
  one other is ideal). If only one source, include it anyway; the build marks it
  low confidence.
- Record every source URL you used for a record in its `sources` list.
- Facts only; no copied descriptions or review text.
- Prices: approximate USD price per 100 ml equivalent from a mainstream
  retailer or the brand (scale by bottle size: a $60 50 ml bottle = $120).
  Use regular price, not a flash sale. `price_date` is "2026-10".
- Performance, 1-5 scale from general wearer consensus and brand claims:
  longevity 1 = under 2h, 2 = 2-4h, 3 = 4-6h, 4 = 6-10h, 5 = 10h+;
  sillage and projection 1 = skin scent, 3 = moderate, 5 = room-filling.
- `dupe_of` = ids of originals the perfume is WIDELY recommended as a dupe or
  clone of (stated by the brand's "inspired by" or by several independent
  community sources). Not just "similar notes".

## Ids
- Existing perfumes: use ids exactly as in `ids.txt` (columns: id, brand, name,
  popularity rank).
- New perfumes get id = lowercase "<brand>-<name>", & -> "and", apostrophes
  removed, every other non-alphanumeric run -> "-". E.g. Chanel "Coco
  Mademoiselle" -> "chanel-coco-mademoiselle"; Zara "Red Temptation" ->
  "zara-red-temptation".

## Output: one JSON file, exactly this shape
```json
{
  "perfumes": [
    {"name": "Coco Mademoiselle", "brand": "Chanel", "concentration": "eau-de-parfum",
     "year": 2001, "aliases": ["coco mademoiselle"],
     "top": ["Orange", "Bergamot"], "heart": ["Rose", "Jasmine"], "base": ["Patchouli", "Vetiver"],
     "family": "Wood & Root",
     "price_usd_100ml": 165, "price_date": "2026-10",
     "dupe_of": [], "longevity": 4, "sillage": 3, "projection": 3,
     "accords": ["citrus", "rose", "patchouli"],
     "sources": ["https://...", "https://..."]}
  ],
  "patches": [
    {"id": "creed-aventus", "price_usd_100ml": 495, "price_date": "2026-10",
     "longevity": 4, "sillage": 4, "projection": 4, "accords": ["fruity", "smoky", "woody"],
     "dupe_of": [], "aliases": [], "sources": ["https://..."]}
  ]
}
```
`perfumes` = new perfumes not in ids.txt. `patches` = extra facts for existing
ids. Every field except name/brand/id is optional: leave out what you can't
confirm. Concentration is one of: eau-de-parfum, eau-de-toilette, extrait,
parfum, eau-de-cologne, elixir. Family is one of: Wood & Root, White Bloom,
Petal Garden, Green Leaf, Velvet Sweet, Sunlit Citrus, Spice Route, Orchard
Fruit, Amber & Resin, Powder Veil, Skin Musk, Smoke & Leather, Salt & Mineral,
Oud Court. Validate the file parses as JSON before finishing (e.g.
`python3 -m json.tool file.json > /dev/null`).

Finish with a 3-line summary: records written, records skipped and why, and
anything you were unsure about.
