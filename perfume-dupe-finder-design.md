# Perfume Dupe Finder: Design

Date: 2026-10-28

## Intent

Someone loves a perfume, often an expensive designer or niche one, and wants
cheaper perfumes that smell like it. They type its name and get a ranked list of
affordable alternatives, with a clear reason why each one matches: the top,
heart and base notes it shares with the original.

The value is trust. A result should make sense to someone who knows the
original, so every match shows its evidence rather than just a name. The data
must also stay current: new releases, new dupes and prices change, so the
requester does not want a list frozen at build time.

## Goals

- Search by perfume name (with brand), with suggestions as you type.
- Show cheaper alternatives ranked by how closely their notes match, across all
  three layers (top, heart, base).
- For each result show: a similarity score, the shared notes by layer, an
  approximate price, and a "Known dupe" badge when the match is widely
  recommended online.
- Start from an openly licensed perfume database and keep it current with a
  weekly automatic refresh.
- When a searched perfume isn't in the data, offer a live lookup that asks
  Claude for its notes, then matches it against the data.
- Work well on a phone; shareable as a link.

## Non-goals

- Scraping Fragrantica, or using datasets scraped from it (e.g. the Kaggle
  Fragrantica sets, FragDB). Same legal problem either way.
- Paid data sources for now (Fragella was considered; see Approaches).
- Full coverage of every perfume ever made.
- Selling perfumes, affiliate links, or real-time retailer prices.
- Accounts, saved lists, or visitors adding perfumes or dupes.
- Reviews or star ratings.
- The layering engine from the requester's concept doc ("AI Fragrance
  Layering & Dupe Finder"). It is a separate, later project that reuses this
  data; see "Next project" below.

## Anti-goals (failure even if it "works")

- Recommending something because it shares only very common notes (musk,
  bergamot, vanilla). Nearly everything contains those, so the list would be
  noise.
- Presenting live-lookup guesses with the same confidence as sourced data.
- Showing "alternatives" that cost the same or more than the original.
- Copying another site's database or review text, or inventing community
  opinion.

## Constraints

- **Data licensing:** only openly licensed data or facts researched from public
  sources (brand sites, authorized retailers, fragrance press). Facts only:
  name, brand, notes, rough price, concentration. No copied descriptions or
  reviews.
- **Attribution:** the Scento data is CC BY 4.0, so the page credits
  "Scento — https://www.scento.com/perfume-database" visibly.
- **Format:** a single published web page (Claude Artifact) whose perfume data
  lives in the artifact's database, not frozen in the page, so the weekly
  refresh can update it without republishing. Matching runs in the browser.
- **Live lookup:** uses the page's "ask Claude" ability. It works only for
  visitors signed in to claude.ai, asks permission on first use, and runs only
  when the visitor clicks.
- **Prices** change and vary by size and seller, so they are approximate
  (USD, per 100 ml equivalent), dated, and labeled that way.

## Approaches considered

**Finder shape** (chosen: 3)
1. Web page with a fixed researched dictionary built in: fast and reliable but
   only knows what was researched, and goes stale.
2. Same, plus visitors add perfumes and dupes: grows by itself but needs
   moderation.
3. Data plus live lookup for misses (chosen).

**Where the data comes from** (chosen: A)
- **A. Scento Perfume Database (chosen):** free, CC BY 4.0, 1,444 perfumes
  (1,353 with a full pyramid), notes checked against brand and retailer pages,
  snapshot dated 2026-10-27. Covers most originals (Creed, Dior, Tom Ford,
  Parfums de Marly, MFK, Kayali, Byredo, YSL) and major dupe houses (Armaf 188,
  Afnan 53, Lattafa 23). Gaps: no Chanel, Zara, Dossier, Alexandria or Maison
  Alhambra; no prices; no longevity or sillage.
- **B. Fragella API:** 100k+ perfumes with longevity and sillage, from
  $12/month; storage and display terms unclear, some values model-predicted.
  Possible later addition, mainly for layering.
- **C. Fragrantica-derived datasets:** ruled out (scraped; mostly
  non-commercial).

A fixed researched list was the first plan; the requester replaced it because
it would go out of date.

## How it works

### The data

Each perfume record:

- name, brand, concentration, release year when known, aliases/nicknames
- top, heart and base notes, normalized to a shared note vocabulary
- scent family and character tags (from Scento where present)
- approximate price per 100 ml, price tier (budget / mid / designer / niche),
  and the date the price was checked
- `dupeOf`: the originals it's widely recommended as a dupe for, if any
- performance: longevity, sillage and projection on a simple 1–5 scale, from
  brand claims and the general consensus of wearers; approximate and labeled
  so. Filled in over time by the refresh; blank until known. Shown on cards as
  a small row when present (builder's call: dupes often last less long, which
  matters when choosing).
- `accords`, for layering later
- `source`: "Scento" or "researched", plus confidence (two sources agree, or
  only one)

**Initial load:** the full Scento snapshot, plus a first research pass that
adds the missing brands people most search for (Chanel originals; Zara,
Dossier, Alexandria, Maison Alhambra alternatives), prices for the most-searched
perfumes, and `dupeOf` links for well-known dupe pairs.

**Weekly refresh:** a scheduled Claude task that:
1. pulls the latest Scento snapshot and merges changes;
2. researches new releases and newly recommended dupes from public sources and
   adds them (two sources must agree on notes, else marked lower confidence);
3. updates prices that are oldest or missing, a batch at a time;
4. fills in missing performance data a batch at a time.

The page shows when the data was last refreshed. The refresh uses the
requester's Claude usage.

**Note vocabulary.** Notes are normalized so "Jasmine sambac" and "Jasmine"
match, and each note belongs to a family (citrus, white floral, woody, amber,
gourmand, musk…). Scento's materials list (aliases and families) seeds this
vocabulary.

### Matching

For a chosen perfume, every other perfume gets a score from 0 to 100:

- **Layer weights:** base 40%, heart 35%, top 25%. Base and heart notes last
  longest and define how a perfume smells on skin; top notes fade within
  minutes.
- **Rare notes count more:** each note is weighted by how rare it is across the
  data, so a shared saffron counts for far more than a shared musk. This also
  applies to partial credit.
- **Partial credit:** a note in the same family earns partial credit, as does
  the same note in a different layer.
- **Known dupes:** always shown, ordered first, with a "Known dupe" badge. The
  score shown is always the raw note similarity, so the number stays honest.
- **Cheaper only:** at least 30% less per 100 ml. A perfume with no known price
  is never filtered out; it shows "price unknown". Top 10, with a weak-match
  cutoff so poor results aren't padded in.

**Searching for an affordable perfume** (decided by the requester): when the
chosen perfume is itself budget or mid tier, the page shows two sections:
"Smells like": the originals it's known as a dupe of, plus the closest
pricier matches by notes; and "Similar for the same price or less": other
affordable perfumes that match, with the cheaper-than rule relaxed to
"about the same price or less".

### The page

- A search box with suggestions as you type, forgiving of typos and aliases
  ("BR540").
- The chosen perfume's card: brand, family, price, performance and its note
  pyramid.
- A ranked list of alternatives, each showing the score, the price and how much
  cheaper it is, the shared notes highlighted by layer, and badges.
- Each card links to a Fragrantica search for that perfume, so visitors can
  check full details there.
- Deep links: a perfume's results can be shared as a link to that perfume.
- If nothing matches the search: a "Look it up with Claude" button.
- Footer: Scento credit, "data last refreshed" date, and a short disclaimer
  that brands are their owners' trademarks, the site isn't affiliated with
  them, and "smells similar" is based on published notes and community opinion.

### Live lookup

1. The visitor clicks "Look it up with Claude".
2. The page sends the perfume name and the note vocabulary, and asks for the
   note pyramid, family, rough price, and any well-known dupes, in a fixed
   format.
3. The page runs its own matcher on that pyramid against the data.
4. Dupes Claude names that aren't in the data are listed separately.
5. Everything from a lookup carries an "Unverified: from a live lookup" label.
   If the lookup fails, is declined, or the visitor isn't signed in, the page
   says so plainly (most visitors from a shared link won't be signed in) and
   the rest keeps working.

## Fragrantica

The requester asked for Fragrantica to be used. Its terms forbid automated
collection and copying its database, so it is not a data source. Each perfume
card links to a Fragrantica search instead.

## Community opinion

Community input (e.g. Reddit, fragrance forums) is used only as a summary of
what people actually and repeatedly say, such as which dupes are widely
recommended. No user comments are invented or presented as real quotes.

## Next project: layering

The requester's concept doc makes a layering compatibility engine the main
feature of the eventual app: two perfumes in, an overall match percentage from
four shown sub-scores (how it smells together, sillage, projection, longevity
of the mix), plus application advice such as same or different pulse points.
The requester chose to build the dupe finder first. Layering gets its own
design conversation afterwards and builds on this data's notes, accords and
performance fields.

## Left to the builder

- The visual design and layout details.
- Exact tuning of the weights, partial-credit amounts and cutoff, as long as
  the ranking makes sense on spot checks of well-known dupe pairs.
- Which scheduling mechanism runs the weekly refresh, as long as it can write
  to the page's database without the requester doing anything each week.
- How large each refresh batch is.
