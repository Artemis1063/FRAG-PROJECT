"""Merge the Scento snapshot and researched supplements into data.json.

Usage: python3 build_data.py
Reads data/scento/*.{jsonl,csv} and data/supplements/*.json (alphabetical,
later files win). Writes data.json and prints a stats summary.
"""
import csv
import glob
import json
import os
import re
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
SCENTO = os.path.join(HERE, "data", "scento")
SUPP = os.path.join(HERE, "data", "supplements")
OUT = os.path.join(HERE, "data.json")

TIERS = ["budget", "mid", "designer", "niche"]

# Default tier by Scento house type, used only when a perfume has no price.
TYPE_TIER = {"designer": "designer", "niche": "niche", "heritage": "designer",
             "arabian": "budget", "artisan": "niche"}
# Houses whose type misleads the default above.
HOUSE_TIER = {
    "Creed": "niche", "Clive Christian": "niche", "Penhaligon's": "niche",
    "Atkinsons": "niche", "Santa Maria Novella": "niche", "Floris London": "niche",
    "Ajmal": "mid", "Arabian Oud": "niche", "Kajal": "niche", "Widian": "niche",
    "Fugazzi": "niche", "Swiss Arabian": "mid", "Amouage": "niche",
    "Zara": "budget", "Dossier": "budget", "Alexandria Fragrances": "budget",
    "Maison Alhambra": "budget", "Ariana Grande": "budget",
}

# Notes researchers often name differently from Scento's vocabulary.
EXTRA_ALIASES = {
    "ambroxan": "ambergris", "ambrox": "ambergris", "cetalox": "ambergris",
    "white musk": "musk", "musks": "musk", "vanilla bean": "vanilla",
    "madagascar vanilla": "vanilla", "bourbon vanilla": "vanilla",
    "virginia cedar": "cedar", "atlas cedar": "cedar", "cedarwood": "cedar",
    "sandalwood": "sandalwood", "australian sandalwood": "sandalwood",
    "bulgarian rose": "rose", "turkish rose": "rose", "damask rose": "rose",
    "may rose": "rose", "rose absolute": "rose", "orris": "iris",
    "orris root": "iris", "tonka": "tonka bean", "pink peppercorn": "pink pepper",
    "black peppercorn": "black pepper", "calabrian bergamot": "bergamot",
    "sicilian lemon": "lemon", "agarwood": "oud", "agarwood (oud)": "oud",
}


def slug(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[’']", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def load_vocab():
    vocab, family = {}, {}
    with open(os.path.join(SCENTO, "materials.csv"), newline="") as f:
        for m in csv.DictReader(f):
            vocab[m["name"].lower()] = m["id"]
            family[m["id"]] = {"name": m["name"], "fam": m["material_family"] or "Other"}
            for a in m["aliases"].split(";"):
                if a.strip():
                    vocab.setdefault(a.strip().lower(), m["id"])
    for alias, target in EXTRA_ALIASES.items():
        if target in vocab:
            vocab.setdefault(alias, vocab[target])
    return vocab, family


def load_houses():
    with open(os.path.join(SCENTO, "houses.csv"), newline="") as f:
        return {h["name"]: h["type"] for h in csv.DictReader(f)}


class Notes:
    def __init__(self, vocab, family):
        self.vocab, self.family, self.unknown = vocab, family, set()

    def ids(self, names):
        out = []
        for n in names or []:
            key = n.strip().lower()
            nid = self.vocab.get(key)
            if not nid:
                nid = slug(n)
                if nid not in self.family:
                    self.family[nid] = {"name": n.strip(), "fam": "Other"}
                    self.unknown.add(n.strip())
                self.vocab[key] = nid
            if nid not in out:
                out.append(nid)
        return out


def tier_for(price, brand, houses):
    if price:
        return "budget" if price < 40 else "mid" if price < 90 else "designer" if price < 200 else "niche"
    return HOUSE_TIER.get(brand) or TYPE_TIER.get(houses.get(brand, ""), "designer")


def main():
    vocab, family = load_vocab()
    houses = load_houses()
    notes = Notes(vocab, family)
    perfumes = {}

    with open(os.path.join(SCENTO, "perfumes.jsonl")) as f:
        for line in f:
            r = json.loads(line)
            flat = not (r["top_notes"] or r["heart_notes"] or r["base_notes"])
            if flat and not r["notes"]:
                continue
            perfumes[r["id"]] = {
                "id": r["id"], "n": r["name"], "b": r["house"],
                "c": r["concentration"] or "", "y": r["year"],
                "al": [], "t": notes.ids(r["top_notes"]),
                "h": notes.ids(r["notes"] if flat else r["heart_notes"]),
                "ba": notes.ids(r["base_notes"]), "f": r["family"], "ch": r["character"],
                "fl": 1 if flat else 0, "pop": r["popularity_rank"], "p": None, "pd": None, "d": [],
                "perf": None, "ac": [], "src": "scento", "conf": "high", "sources": [r["url"]],
            }

    for path in sorted(glob.glob(os.path.join(SUPP, "*.json"))):
        with open(path) as f:
            supp = json.load(f)
        for r in supp.get("perfumes", []):
            pid = r.get("id") or slug(f'{r["brand"]}-{r["name"]}')
            srcs = r.get("sources", [])
            perfumes[pid] = {
                "id": pid, "n": r["name"], "b": r["brand"], "c": r.get("concentration", ""),
                "y": r.get("year"), "al": r.get("aliases", []), "t": notes.ids(r.get("top")),
                "h": notes.ids(r.get("heart")), "ba": notes.ids(r.get("base")),
                "f": r.get("family", ""), "ch": r.get("character", []), "fl": 0, "pop": None,
                "p": None, "pd": None, "d": [], "perf": None, "ac": [], "src": "researched",
                "conf": "high" if len(srcs) >= 2 else "low", "sources": srcs,
            }
            apply_patch(perfumes[pid], r, notes)
        for r in supp.get("patches", []):
            if r["id"] in perfumes:
                apply_patch(perfumes[r["id"]], r, notes)
            else:
                print(f"  skip patch for unknown id {r['id']} ({os.path.basename(path)})", file=sys.stderr)

    seen = {}
    for p in sorted(perfumes.values(), key=lambda p: -len(p["t"] + p["h"] + p["ba"])):
        key = re.sub(r"[^a-z0-9]", "", (p["b"] + p["n"]).lower())
        if key in seen:
            del perfumes[p["id"]]
        else:
            seen[key] = p["id"]

    # Researchers guess ids for perfumes added in parallel ("chanel-bleu-de-chanel"
    # for "chanel-bleu-de-chanel-eau-de-parfum"): resolve to the shortest id that
    # extends the guess. Then drop links to perfumes we don't have.
    def resolve(d):
        if d in perfumes:
            return d
        if d + "-eau-de-parfum" in perfumes:
            return d + "-eau-de-parfum"
        longer = sorted((k for k in perfumes if k.startswith(d + "-")), key=len)
        return longer[0] if longer else None

    for p in perfumes.values():
        # Brands that publish a flat note list get recorded as heart-only.
        if p["h"] and not p["t"] and not p["ba"]:
            p["fl"] = 1
        ids = (resolve(d) for d in p["d"])
        p["d"] = [d for d in dict.fromkeys(ids) if d and d != p["id"]]
        p["tier"] = tier_for(p["p"], p["b"], houses)

    out = {
        "built": date.today().isoformat(),
        "notes": {k: [v["name"], v["fam"]] for k, v in family.items()},
        "perfumes": sorted(perfumes.values(), key=lambda p: (p["b"].lower(), p["n"].lower())),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    ps = out["perfumes"]
    print(f"{len(ps)} perfumes, {len({p['b'] for p in ps})} brands, "
          f"{sum(1 for p in ps if p['p'])} priced, {sum(1 for p in ps if p['perf'])} with performance, "
          f"{sum(1 for p in ps if p['d'])} with dupeOf, {sum(1 for p in ps if p['conf'] == 'low')} low-confidence, "
          f"{os.path.getsize(OUT) // 1024} KB")
    if notes.unknown:
        print(f"{len(notes.unknown)} notes not in the vocabulary (family 'Other'): {sorted(notes.unknown)}")


def apply_patch(p, r, notes):
    if r.get("top") or r.get("heart") or r.get("base"):
        p["t"], p["h"], p["ba"] = notes.ids(r.get("top")), notes.ids(r.get("heart")), notes.ids(r.get("base"))
        p["fl"] = 0
    if r.get("price_usd_100ml"):
        p["p"] = round(float(r["price_usd_100ml"]))
        p["pd"] = r.get("price_date") or date.today().isoformat()[:7]
    if r.get("dupe_of"):
        p["d"] += r["dupe_of"]
    perf = {k: r[k] for k in ("longevity", "sillage", "projection") if r.get(k)}
    if perf:
        p["perf"] = {**(p["perf"] or {}), **perf}
    if r.get("accords"):
        p["ac"] = r["accords"]
    if r.get("aliases"):
        p["al"] = list(dict.fromkeys(p["al"] + r["aliases"]))
    if r.get("sources"):
        p["sources"] = list(dict.fromkeys(p["sources"] + r["sources"]))


if __name__ == "__main__":
    main()
