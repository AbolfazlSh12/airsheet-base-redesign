#!/usr/bin/env python3
"""List TEXT blocks whose inline styles the page HTML sanitiser strips (platform-lessons «Page HTML sanitiser»).

  python3 scan-html-styles.py <all-objects.json>      # the file read-all.ts writes (pages + expands)

Prints one line per offending block: where (page / template, nesting path), block id, and the dropped properties.
`line-height`-only hits are cosmetic; `url(`, `background`, `position`, `grid-template` mean a broken hero or grid.
"""
import json, re, sys
BAD = re.compile(r"url\(|position\s*:|min-height|text-shadow|box-shadow|line-height|opacity\s*:|gap\s*:|overflow\s*:|flex-wrap|grid-template|background\s*:")
d = json.load(open(sys.argv[1], encoding="utf-8"))
sides = {s["_id"]: s.get("name") for s in d.get("sides", [])}

def walk(bs, path=""):
    for b in bs or []:
        if not isinstance(b, dict): continue
        yield path, b
        t = b.get("type", "")
        for k in ("column1", "column2", "column3", "column4"):
            if isinstance(b.get(k), dict): yield from walk(b[k].get("content", {}).get("blocks"), f"{path}/{t}.{k}")
        if isinstance(b.get("section"), dict): yield from walk(b["section"].get("content", {}).get("blocks"), f"{path}/{t}")
        if t == "TABS" and isinstance(b.get("details"), list):
            for tab in b["details"]:
                if isinstance(tab, dict): yield from walk(tab.get("content", {}).get("blocks"), f"{path}/TABS:{tab.get('label') or ''}")

def report(kind, owner, blocks):
    n = 0
    for path, b in walk(blocks):
        if b.get("type") != "TEXT": continue
        v = (b.get("details") or {}).get("value") or ""
        hits = sorted(set(re.sub(r"\s*:?$", "", m.group(0)) for m in BAD.finditer(v)))
        if hits: n += 1; print(f"{kind}\t{owner}\t{path or '/'}\t{b.get('id')}\t{','.join(hits)}")
    return n

n = sum(report("page", f"{sides.get(p.get('side'))}/{p.get('name')}", (p.get("content") or {}).get("blocks")) for p in d.get("pages", []))
n += sum(report("template", e.get("name"), (e.get("layout") or {}).get("blocks")) for e in d.get("expands", []))
print(f"{n} TEXT blocks with stripped styles", file=sys.stderr)
