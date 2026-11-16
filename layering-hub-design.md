# Layering Hub: Design

Date: 2026-10-28
Builds on: [perfume-dupe-finder-design.md](perfume-dupe-finder-design.md) and the
requester's concept doc "Overview: AI Fragrance Layering & Dupe Finder Concept".

## Intent

Turn the published Perfume Dupe Finder into a joint hub with two tabs on one
page: **Find dupes** (what exists today) and **Layer**. Layering answers two
questions people ask about perfumes they own:

1. "Do these two work together?" (check a pair)
2. "What in My collection goes with this one?" (suggestions)

In the requester's concept doc, layering is the app's main feature and dupe
finding the secondary one. The requester asked for both together.

## Goals

- **Check a pair:** pick perfume A and B → an **overall match percentage** built
  from four sub-scores, each shown individually (requester's concept doc), with
  How it smells weighted most (requester's decision; see Overall match):
  - **How it smells**: harmony or clash of the combined notes (the most
    important factor).
  - **Sillage of the mixture**: projected strength and trail.
  - **Projection of the mixture**: how far it pushes off the skin.
  - **Longevity of the mixture**: total expected duration.
- **Application advice** for every pair: same pulse point (direct layering) or
  different pulse points (spatial layering), which to spray first, and a spray
  ratio when one is much louder.
- **Suggestions:** pick one perfume → the best partners from **My collection**,
  ranked by overall match, each with a one-line reason.
- **My collection:** people save perfumes they own. The feature is named
  "My collection" everywhere (requester's wording; never "My perfumes").
- **Hub links:** every perfume card in either tab offers "Find dupes",
  "Layer with this" and "Add to My collection".
- **Same combo for less:** when a perfume in a checked pair has a known cheaper
  dupe, say so ("Swap Aventus for Club de Nuit Intense Man for a similar pair").

## Non-goals

- Claude scoring pairs or writing advice live (requester chose rules only).
  The existing dupe-finder live lookup stays as it is.
- Layering three or more perfumes.
- Suggestions from the whole list (requester chose My collection; see
  Decisions).
- Invented or "simulated" community data.

## Anti-goals

- A confident percentage built from data we don't have. A sub-score with no
  data is shown as "No data yet", never guessed, and is left out of the
  overall score (with the page saying so).
- Advice that contradicts the score (e.g. "spray on the same spot" for a pair
  that clashes).
- Losing someone's collection silently.

## Constraints

- Same single published page and URL as the dupe finder
  (https://claude.ai/artifact/4Gwn9xpYZWR9oBe9mWZgFL), same embedded data and
  weekly refresh.
- Apple system font stack (SF Pro), as the page now uses.
- **Data coverage:** every perfume has notes, so "How it smells" works for every
  pair. Longevity, sillage and projection exist for only 173 of 1,530
  perfumes today; the weekly refresh fills more each week.

## Approaches considered

1. **Built-in rules only (chosen by the requester):** instant, consistent,
   works for everyone; less nuanced; three sub-scores often missing until data
   fills in.
2. Claude scores every pair live: nuanced and can estimate missing data, but
   slow, variable, signed-in only, uses usage per check.
3. Rules plus an "Ask Claude" button: most capable, most to build.

## How it works

### How it smells (0–100)

Computed from both perfumes' notes, weighted by layer (base and heart count
more, as in dupe matching):

The scoring rules come from researched perfumery principles (requester asked
for this), documented with sources in
[perfumery-principles.md](perfumery-principles.md):

- **Family affinity (rules 2–5):** each note family sits on Michael Edwards'
  fragrance wheel; affinity by wheel distance (neighbours blend best, opposites
  contrast), overridden by classic pairings (+2), known clashes (−2), and musk
  blending with everything.
- **Bridge notes (rule 6):** shared notes add a bonus, rare ones more.
- **Heavy + heavy (rule 7)** and **citrus + citrus openings (rule 8)** are
  penalised.
- **Classic accords (rule 9):** a pair that together forms a chypre, fougère or
  amber accord gets a bonus and the reason names it.
- **Too similar:** two near-identical perfumes score well but get a note:
  "These are very alike, so layering adds little."
- The page states that scores are a guide based on published notes and these
  principles, and suggests testing on skin.

### Mixture performance (each 0–100, from the 1–5 data)

Only when both perfumes have that figure:
- **Longevity:** the longer-lasting one anchors the mix: max(A, B), plus a small
  boost when both are 3 or more.
- **Sillage / projection:** the louder one dominates: max(A, B), plus a small
  boost when both are 3 or more, capped at 5.
Converted to a percentage (5 = 100).

### Overall match

The requester chose to weigh How it smells most rather than take the concept
doc's plain average, so loud perfumes that clash can't outscore quiet ones that
blend well:

- **Weights:** How it smells 55%; sillage, projection and longevity 15% each.
- **Missing scores:** left out, and the remaining weights scaled up to 100%.
  With no performance data the overall equals How it smells. The page says
  "Based on 1 of 4 scores (no performance data yet for X)".
- **Clash cap:** when How it smells is below 45 ("Not a natural pair"), the
  overall can't go above 50%, however strong the mixture is.

### Application advice (rule 10 of perfumery-principles.md)

- **Spray order:** the heavier perfume (base dominated by woods, amber, oud,
  vanilla) goes on first; wait a minute or two; the lighter one on top.
- **Pulse points:** "How it smells" ≥ 70 → same pulse point (direct layering).
  45–69, or sillage differs by 2+ → different pulse points: the heavier on
  wrists or inner elbows, the lighter on the neck or behind the ears.
  Below 45 → "Not a natural pair"; if worn together, keep them apart.
- **Ratio:** when one is 2+ louder, suggest 1 spray of it to 2 of the other.
- **Always:** test on skin first and wait about 15 minutes; a sour, metallic or
  chemical edge means they clash.

### Suggestions

For the chosen perfume, score it against every perfume in My collection,
rank by overall match (ties broken by How it smells), show the top 5 with a
generated one-line reason naming the strongest affinity or bridge note
("Its vanilla base softens Khamrah's cinnamon"). Empty collection → a prompt to
add perfumes, with "Add to My collection" right there.

### My collection

- Add from any perfume card; a My collection view lists them with remove.
- **Storage (builder's call):** signed-in visitors' collections are saved to
  their claude.ai account via the page database (private per person), so they
  follow them across devices; signed-out visitors' collections are saved in
  their browser. Signing in later merges the browser copy into the account.
- Only perfume ids are stored.

### The hub

- Two tabs at the top: **Find dupes** and **Layer**, plus a **My collection**
  view. Search is shared. The page opens on **Layer**, the concept doc's main
  feature (builder's call; the requester didn't pick). Check a pair works there
  without a collection; a deep link to a perfume still opens Find dupes.
- Deep links: `#creed-aventus` (dupes, as today), `#layer~<idA>~<idB>` (a pair),
  `#layer~<id>` (suggestions).

## Calls made during review (builder's calls, not the requester's)

- **Weights and cap values** (55/15/15/15, cap 50% below 45) are the
  builder's; the requester decided that How it smells weighs most and a clash
  caps the score.
- **Default tab:** Layer.

- **One definition of "heavy":** a perfume's heaviness is the share of its base
  notes (all notes when it has no base) in the Amber, Gourmand, Resin & incense,
  Oud, Wood and Smoke & leather families. Musk never counts. "Heavy" means 50%
  or more. Spray order: higher heaviness first. Replaces the three slightly
  different lists in the drafts.
- **Perfumes with no notes** (17, mostly Zara) can't be layered: their cards
  say "No published notes, so we can't score layering" and they're left out of
  suggestions.
- **Family "Other"** (20 rare notes) has no place on the wheel: affinity 0.
- **Ambergris/Ambroxan** are in the Amber family but have a marine character,
  so they're exempt from the amber + aquatic clash.
- **How note-level affinities combine:** every note of A against every note of
  B, weighted by layer and rarity, averaged and mapped to 0–100; classic
  pairings, accords and bridge notes are matched on actual notes (e.g. vanilla
  + cedar), not just families.
- **"Strong citrus opening"** = two or more citrus top notes.
- **Mixture longevity/sillage/projection are capped at 5** (100%). A perfume
  with only some performance fields uses what it has.
- **Pulse-point precedence:** below 45 → keep apart; else 70+ with sillage
  within 1 → same pulse point; otherwise different pulse points. "Louder" means
  sillage; with no sillage data the ratio tip is left out.
- **Suggestions rank on "How it smells"** (every pair has it), showing the
  overall % beside it, so perfumes with and without performance data rank on
  the same scale.
- **"Same combo for less"** uses curated known dupes only, looked up in
  reverse (perfumes whose `dupeOf` is the original).
- **My collection:** up to 500 perfumes. If a weekly refresh removes a perfume,
  the page says "1 perfume in My collection is no longer in our list" and lists
  it rather than dropping it silently. Signed-out visitors see "Saved in this
  browser only. Sign in to claude.ai to keep it across devices", plus a
  "Copy list" button. When the account copy becomes available in a browser that
  holds a browser copy, the two are merged once.

## Data work (weekly refresh)

Extend the refresh to fill performance data for more perfumes each week
(raising the batch from 30 to 60, most popular and dupe-house perfumes first),
since three of the four layering scores depend on it.

## Left to the builder

- The exact family-affinity table values and bonus sizes, as long as spot
  checks of well-known combos score well (e.g. a vanilla gourmand with an amber
  woody; Khamrah with a vanilla) and known clashes score low.
- Visual design within the existing page's look.
- Exact wording of generated reasons.
