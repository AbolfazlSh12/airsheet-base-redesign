// Usage: node shot.cjs <role> <outDir> <sideId>/<pageId> [...]
//   role: a key of .accounts.json next to this file ({"admin":["0999…","<password>"], …}, chmod 600, never committed),
//         or any other word (e.g. visitor) for an anonymous browser.
//   env: WIDTH, HEIGHT, WAIT (ms, default 12000), MOBILE=1, THEME=dark, FRONTEND (default project.json frontend or
//        http://localhost:9003), PLAYWRIGHT_MODULE (path to the playwright package), CHROMIUM_PATH (headless shell binary).
// Own headless Chromium per run, so parallel agents don't share a browser. At most 2 in parallel: more makes pages
// capture half-loaded and repeated logins hit the captcha.
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const P = fs.existsSync(`${__dirname}/project.json`) ? JSON.parse(fs.readFileSync(`${__dirname}/project.json`, 'utf8')) : {};
const BASE = process.env.AIRSHEET_BASE || P.base;
const FRONT = process.env.FRONTEND || P.frontend || 'http://localhost:9003';
const accFile = `${__dirname}/.accounts.json`;
const ACCOUNTS = fs.existsSync(accFile) ? JSON.parse(fs.readFileSync(accFile, 'utf8')) : {};
(async () => {
  const [role, outDir, ...targets] = process.argv.slice(2);
  if (!BASE || !role || !outDir || !targets.length) throw new Error('usage: node shot.cjs <role> <outDir> <sideId>/<pageId> ... (base from project.json or AIRSHEET_BASE)');
  const mobile = process.env.MOBILE === '1';
  const dark = process.env.THEME === 'dark';
  const width = +(process.env.WIDTH || (mobile ? 390 : 1366)), height = +(process.env.HEIGHT || (mobile ? 1600 : 2400)), wait = +(process.env.WAIT || 12000);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const authDir = `${__dirname}/.auth`; fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  const stateFile = `${authDir}/${role}.json`;
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'fa-IR', ...(ACCOUNTS[role] && fs.existsSync(stateFile) ? { storageState: stateFile } : {}) });
  if (dark) await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  // Reuse the saved login (one session per role): the server caps concurrent sessions per user
  // («محدودیت تعداد نشست های همزمان»), so logging in on every run locks the account out.
  let needLogin = !!ACCOUNTS[role];
  if (needLogin && fs.existsSync(stateFile)) {
    await page.goto(`${FRONT}/home`); await page.waitForTimeout(2500);
    needLogin = page.url().includes('/auth');
  }
  if (needLogin) {
    await page.goto(`${FRONT}/auth?passType=password`); await page.waitForTimeout(1500);
    await page.fill('input[name=mobile]', ACCOUNTS[role][0]); await page.fill('input[type=password]', ACCOUNTS[role][1]);
    await page.press('input[type=password]', 'Enter'); await page.waitForTimeout(3000);
    await ctx.storageState({ path: stateFile });
    fs.chmodSync(stateFile, 0o600);
  }
  const report = [];
  for (const t of targets) {
    errors.length = 0;
    await page.goto(`${FRONT}/b/${BASE}/${t}`); await page.waitForTimeout(wait);
    const file = `${outDir}/${role}-${t.replace(/\//g, '_').replace(/[^0-9a-zA-Z_]/g, '')}${mobile ? '-m' : ''}${dark ? '-dark' : ''}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
    const text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
    report.push({ target: t, file, url: page.url(), consoleErrors: [...new Set(errors)].slice(0, 5), text });
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
