#!/usr/bin/env bash
# Screenshots of ANONYMOUS portal pages with the system Chrome — no Playwright. Every capture goes through the DevTools
# protocol (probe-chrome.cjs SHOT=…): Chrome's plain --screenshot flag produced blank and clipped pictures (2026-10-14).
# Usage: shot-chrome.sh <outDir> <sideId>/<pageId> [...]   env: FRONTEND (default project.json frontend or http://localhost:9003),
#        MOBILE=1 (390 px, device emulation), WIDTH/HEIGHT, WAIT ms (default 20000), CHROME (default google-chrome).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
OUT=$1; shift
BASE=${AIRSHEET_BASE:-$(python3 -c "import json;print(json.load(open('$here/project.json'))['base'])")}
FRONT=${FRONTEND:-$(python3 -c "import json;print(json.load(open('$here/project.json')).get('frontend','http://localhost:9003'))")}
mkdir -p "$OUT"
for t in "$@"; do
  f="$OUT/visitor-$(echo "$t" | tr '/' '_' | tr -cd '0-9a-zA-Z_')$([ "${MOBILE:-0}" = 1 ] && echo -m || true)"
  if ! WAIT=${WAIT:-20000} SHOT="$f.png" node "$here/probe-chrome.cjs" "$FRONT/b/$BASE/$t" '({text: document.body.innerText.length, sw: document.documentElement.scrollWidth})' > "$f.json" 2>&1; then echo "FAIL $t ($(tail -1 "$f.json"))"; continue; fi
  python3 - "$f" <<'PY'
import sys, os, json; from PIL import Image
f=sys.argv[1]; im=Image.open(f+'.png').convert('RGB'); im.save(f+'.jpg', quality=72); os.remove(f+'.png')
j=json.load(open(f+'.json')); print(f+'.jpg', im.size, 'text', j.get('text'), 'scrollWidth', j.get('sw'))
PY
done
