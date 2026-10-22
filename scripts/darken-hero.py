#!/usr/bin/env python3
"""Bake the readability tint into a hero photo (references/asset-pipeline.md A5).

TEXT blocks cannot carry a CSS gradient any more (page HTML is sanitised to a style whitelist) and the SECTION block has
no overlay option, so the dark tint behind white hero text lives in the JPEG itself.

  python3 darken-hero.py <in.jpg> <out.jpg> [--tint 12,44,27] [--stops 0:.94,.4:.82,.72:.5,1:.3] [--ltr] [--quality 80]

--stops: alpha of the tint by distance from the text edge (right edge for RTL pages; --ltr makes it the left edge).
"""
import argparse
import numpy as np
from PIL import Image

a = argparse.ArgumentParser()
a.add_argument("src"); a.add_argument("out")
a.add_argument("--tint", default="12,44,27"); a.add_argument("--stops", default="0:.94,.4:.82,.72:.5,1:.3")
a.add_argument("--ltr", action="store_true"); a.add_argument("--quality", type=int, default=80)
A = a.parse_args()
tint = np.array([int(x) for x in A.tint.split(",")], dtype=np.float32)
stops = sorted((float(p), float(v)) for p, v in (s.split(":") for s in A.stops.split(",")))

im = np.asarray(Image.open(A.src).convert("RGB")).astype(np.float32)
xs = np.linspace(0, 1, im.shape[1])
dist = xs if A.ltr else 1 - xs  # distance from the text edge
alpha = np.interp(dist, [p for p, _ in stops], [v for _, v in stops])[None, :, None]
out = im * (1 - alpha) + tint[None, None, :] * alpha
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(A.out, quality=A.quality, optimize=True)
print("wrote", A.out)
