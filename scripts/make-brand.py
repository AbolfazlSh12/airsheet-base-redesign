#!/usr/bin/env python3
"""Placeholder brand set when the customer's logo has not arrived (references/demo-readiness.md D3).

  python3 make-brand.py <outDir> "<name>" "<tagline>" [--brand #2F7A4A] [--dark #1f5c36] [--accent #F26B21]
                        [--font /path/Vazirmatn-ExtraBold.ttf] [--font2 /path/Vazirmatn-SemiBold.ttf] [--icon tent|leaf|box]

Writes: logo-mark-512.png (brand bg), logo-mark-green-256.png / logo-mark-white-256.png (transparent; header.logo /
darkLogo), logo-wordmark-light.png / -dark.png / -card.png (footer brand widget, hero), logo-preview.png.
Needs Pillow built with raqm (shaped Persian text): python3 -c "from PIL import features; print(features.check('raqm'))".
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont, features

a = argparse.ArgumentParser()
a.add_argument("out"); a.add_argument("name"); a.add_argument("tagline")
a.add_argument("--brand", default="#2F7A4A"); a.add_argument("--dark", default="#1f5c36"); a.add_argument("--accent", default="#F26B21")
a.add_argument("--font", default=os.path.expanduser("~/.local/share/fonts/pcalendarFonts/Vazirmatn-ExtraBold.ttf"))
a.add_argument("--font2", default=os.path.expanduser("~/.local/share/fonts/pcalendarFonts/Vazirmatn-SemiBold.ttf"))
a.add_argument("--icon", default="tent", choices=["tent", "leaf", "box"])
A = a.parse_args()
if not features.check("raqm"): raise SystemExit("Pillow without raqm: Persian text would not be shaped")
os.makedirs(A.out, exist_ok=True)

def mark(size, bg, fg, accent):
    s = size; im = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg: d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=bg)
    hole = bg if bg else (0, 0, 0, 0)
    if A.icon == "tent":
        d.ellipse((int(s * .66), int(s * .16), int(s * .84), int(s * .34)), fill=accent)
        d.polygon([(s * .44, s * .22), (s * .10, s * .80), (s * .78, s * .80)], fill=fg)
        d.polygon([(s * .44, s * .46), (s * .34, s * .80), (s * .54, s * .80)], fill=hole)
        d.rectangle((int(s * .08), int(s * .80), int(s * .92), int(s * .84)), fill=fg)
    elif A.icon == "leaf":
        d.pieslice((int(s * .15), int(s * .15), int(s * .85), int(s * .85)), 200, 20, fill=fg)
        d.line((s * .25, s * .75, s * .72, s * .28), fill=hole, width=int(s * .05))
        d.ellipse((int(s * .62), int(s * .14), int(s * .80), int(s * .32)), fill=accent)
    else:
        d.rounded_rectangle((int(s * .18), int(s * .28), int(s * .82), int(s * .82)), radius=int(s * .06), fill=fg)
        d.rectangle((int(s * .18), int(s * .40), int(s * .82), int(s * .46)), fill=hole)
        d.ellipse((int(s * .62), int(s * .10), int(s * .80), int(s * .28)), fill=accent)
    return im

def text_rtl(d, x_right, y, t, f, fill):
    b = d.textbbox((0, 0), t, font=f, direction="rtl", language="fa"); w = b[2] - b[0]
    d.text((x_right - w - b[0], y - b[1]), t, font=f, fill=fill, direction="rtl", language="fa")

def wordmark(w, h, bg, fg, sub, accent):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg: d.rounded_rectangle((0, 0, w - 1, h - 1), radius=int(h * .18), fill=bg)
    pad = int(h * .14); ms = h - 2 * pad
    im.alpha_composite(mark(ms, None, fg, accent), (w - pad - ms, pad)); xr = w - pad - ms - int(h * .12)
    text_rtl(d, xr, int(h * .17), A.name, ImageFont.truetype(A.font, int(h * .40)), fg)
    text_rtl(d, xr, int(h * .64), A.tagline, ImageFont.truetype(A.font2, int(h * .16)), sub)
    return im

o = A.out
mark(512, A.brand, "white", A.accent).save(f"{o}/logo-mark-512.png")
mark(256, None, A.brand, A.accent).save(f"{o}/logo-mark-green-256.png")
mark(256, None, "white", A.accent).save(f"{o}/logo-mark-white-256.png")
wordmark(1200, 320, None, A.dark, "#4b5a50", A.accent).save(f"{o}/logo-wordmark-light.png")
wordmark(1200, 320, None, "white", "#dbe7df", A.accent).save(f"{o}/logo-wordmark-dark.png")
wordmark(1200, 320, "white", A.dark, "#4b5a50", A.accent).save(f"{o}/logo-wordmark-card.png")
sheet = Image.new("RGB", (1300, 480), "#e9e9e9")
m = Image.open(f"{o}/logo-mark-512.png").resize((200, 200)); sheet.paste(m, (40, 40), m)
c = Image.open(f"{o}/logo-wordmark-card.png").resize((600, 160)); sheet.paste(c, (280, 60), c)
dk = Image.new("RGB", (600, 160), A.dark); wd = Image.open(f"{o}/logo-wordmark-dark.png").resize((600, 160)); dk.paste(wd, (0, 0), wd); sheet.paste(dk, (280, 260))
sheet.save(f"{o}/logo-preview.png")
print("brand set written to", o, "(swap these files for the customer's logo and re-run the brand step)")
