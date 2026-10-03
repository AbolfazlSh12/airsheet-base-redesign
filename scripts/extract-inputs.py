#!/usr/bin/env python3
"""Pull plain text out of this project's input formats.

  python3 extract-inputs.py atlas  <saved-atlas-dir>/_t.html <out-dir>
  python3 extract-inputs.py docx   <file.docx> <out-dir>
  python3 extract-inputs.py pdf    <file.pdf>  <out-dir>

atlas: a Claude artifact saved with "Save page as" keeps its real content in
<dir>_files/_t.html. The structured data lives in <script id="atlas-data">;
the prose is the visible text. Both get written out.
"""
import html
import json
import os
import re
import subprocess
import sys
import zipfile


def atlas(path, out):
    h = open(path, encoding="utf-8").read()
    m = re.search(r'<script id="atlas-data"[^>]*>(.*?)</script>', h, flags=re.S)
    if m:
        json.dump(json.loads(m.group(1)), open(f"{out}/atlas-data.json", "w"), ensure_ascii=False, indent=1)
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"<(br|/p|/div|/li|/tr|/h\d|/section|/td|/th)[^>]*>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", t))
    open(f"{out}/atlas.txt", "w").write(t)


def docx(path, out):
    z = zipfile.ZipFile(path)
    x = z.read("word/document.xml").decode()
    paras = ["".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, flags=re.S)) for p in re.findall(r"<w:p[ >].*?</w:p>", x, flags=re.S)]
    open(f"{out}/docx.txt", "w").write("\n".join(p for p in paras if p.strip()))
    os.makedirs(f"{out}/docx_media", exist_ok=True)
    for n in z.namelist():
        if n.startswith("word/media/"):
            open(f"{out}/docx_media/{os.path.basename(n)}", "wb").write(z.read(n))


def pdf(path, out):
    subprocess.run(["pdftotext", "-layout", path, f"{out}/pdf.txt"], check=True)


if __name__ == "__main__":
    kind, src, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    {"atlas": atlas, "docx": docx, "pdf": pdf}[kind](src, out)
