// Evaluate JavaScript on an ANONYMOUS page with headless Chrome over the DevTools protocol (no Playwright).
// Usage: node probe-chrome.cjs <url> [expression]   env: MOBILE=1 (390 px), WIDTH/HEIGHT, WAIT ms (default 12000), CHROME
// Default expression: layout overflow report (scrollWidth vs viewport + the widest elements).
// SHOT=<file.png> also saves an emulated full-window screenshot (mobile needs this: --screenshot ignores device emulation).
const { spawn } = require('child_process');
const http = require('http');
const url = process.argv[2];
const expr = process.argv[3] || `(() => { const vw = innerWidth, bad = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect();
    if (r.right > vw + 2 || r.left < -2) bad.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 70), w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), t: (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 40) }); }
  return { vw, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, count: bad.length, widest: bad.sort((a, b) => b.w - a.w).slice(0, 12) }; })()`;
const mobile = process.env.MOBILE === '1';
const W = +(process.env.WIDTH || (mobile ? 390 : 1366)), H = +(process.env.HEIGHT || (mobile ? 1600 : 2400));
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const get = (p) => new Promise((res, rej) => http.get(`http://127.0.0.1:${port}${p}`, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let targets; for (let i = 0; i < 40; i++) { try { targets = await get('/json'); break; } catch { await sleep(250); } }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) pending[d.id](d); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  if (mobile) await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await send('Page.enable'); await send('Page.navigate', { url });
  await sleep(+(process.env.WAIT || 12000));
  if (process.env.SHOT) { const sh = await send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(process.env.SHOT, Buffer.from(sh.result.data, 'base64')); }
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r, null, 1));
  ws.close(); chrome.kill();
})().catch((e) => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
