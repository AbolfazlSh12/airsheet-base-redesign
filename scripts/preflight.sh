#!/usr/bin/env bash
# Hour-zero checks before any build step. Usage: preflight.sh [<cloud-back path>]   (reads project.json next to it)
here=$(cd "$(dirname "$0")" && pwd); APP=${1:-${AIRSHEET_BACKEND:-$here/../../cloud-back}}
ok(){ printf '  ✓ %s\n' "$1"; }; bad(){ printf '  ✗ %s\n' "$1"; FAIL=1; }
echo "preflight ($(date -Is))"
[ -f "$here/project.json" ] && ok "project.json ($(python3 -c "import json;p=json.load(open('$here/project.json'));print(','.join(k for k in ('base','owner','frontend') if p.get(k)))"))" || bad "project.json missing (node init-project.cjs <dump> project.json)"
[ -f "$APP/src/modules/database/master.ts" ] || [ -f "$APP/src/modules/database/master.js" ] && ok "cloud-back checkout $APP ($(git -C "$APP" rev-parse --short HEAD 2>/dev/null) $(git -C "$APP" rev-parse --abbrev-ref HEAD 2>/dev/null))" || bad "no cloud-back at $APP"
for p in 27017:mongo 6379:redis 8089:splunk; do port=${p%%:*}; name=${p##*:}; (timeout 2 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$port") 2>/dev/null && ok "$name port $port open ($(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'users:(("[^"]*"' | head -1 | tr -d '(",' | sed 's/users://'))" || bad "$name port $port closed"; done
case ",${NO_PROXY:-}${no_proxy:-}," in *cloud-log*) ok "NO_PROXY covers cloud-log";; *) [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ] && bad "HTTPS_PROXY set but NO_PROXY lacks cloud-log (base engine queries will 503): export NO_PROXY=\$NO_PROXY,cloud-log" || ok "no https proxy";; esac
getent hosts cloud-log >/dev/null 2>&1 && ok "cloud-log resolves ($(getent hosts cloud-log | awk '{print $1}'))" || printf '  · cloud-log not in /etc/hosts (only matters if the base engine uses it)\n'
[ -n "${PLAYWRIGHT_MODULE:-}" ] && [ -d "${PLAYWRIGHT_MODULE:-/nonexistent}" ] && ok "playwright at $PLAYWRIGHT_MODULE" || { command -v google-chrome >/dev/null && ok "no Playwright; google-chrome present → shot-chrome.sh / probe-chrome.cjs for anonymous pages" || bad "neither Playwright nor google-chrome: no screenshots possible"; }
python3 -c "import PIL" 2>/dev/null && ok "python3 PIL (image resize)" || bad "python3 PIL missing (pip install pillow) — asset-pipeline needs it"
[ -f "$here/.accounts.json" ] && { [ "$(stat -c %a "$here/.accounts.json")" = 600 ] && ok ".accounts.json (600)" || bad ".accounts.json is not chmod 600"; } || printf '  · no .accounts.json: portal screenshots/crawls as logged-in users unavailable\n'
[ -z "${FAIL:-}" ] && echo "preflight OK" || { echo "preflight FAILED"; exit 1; }
