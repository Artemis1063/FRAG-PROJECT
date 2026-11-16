"""Inline match.js and data.json into page.html -> dist/index.html.

Usage: python3 build_page.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# Fields the page doesn't use are dropped to keep the page small.
DROP = {"sources", "ch", "f", "y"}


def main():
    with open(os.path.join(HERE, "data.json")) as f:
        data = json.load(f)
    for p in data["perfumes"]:
        for k in DROP:
            p.pop(k, None)
        for k in [k for k, v in p.items() if v in (None, [], "", 0) and k not in ("t", "h", "ba", "d")]:
            del p[k]
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(HERE, "match.js")) as f:
        match = f.read()
    with open(os.path.join(HERE, "page.html")) as f:
        page = f.read()
    with open(os.path.join(HERE, "layer.js")) as f:
        layer = f.read()
    page = page.replace("__DATA_JSON__", blob).replace("/*__MATCH_JS__*/", match).replace("/*__LAYER_JS__*/", layer)
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    out = os.path.join(HERE, "dist", "index.html")
    with open(out, "w") as f:
        f.write(page)
    # Local preview copy: the publish skeleton normally supplies doctype and charset.
    with open(os.path.join(HERE, "dist", "preview.html"), "w") as f:
        f.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + page + "</body></html>")
    print(f"wrote dist/index.html ({os.path.getsize(out) // 1024} KB, {len(data['perfumes'])} perfumes)")


if __name__ == "__main__":
    main()
