// Browser check that no list on a page is empty for a given account: opens each page as that role, clicks every tab,
// and records the row count of the last searchAPI answer per view (what the user really sees, including template and
// record-context filters that a filter-only count cannot evaluate).
// Usage: node crawl-lists.cjs <role|visitor> <sideId> <pageId> [...]      (run shot.cjs once per role first: it saves
//        the login in .auth/<role>.json, which this script reuses)
// env: WAIT (ms per page, default 14000), FRONTEND, PLAYWRIGHT_MODULE, CHROMIUM_PATH, as for shot.cjs.
// Prints one line per page with the empty lists, then a JSON array; exit code 1 if any list is empty or errored.
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const P = fs.existsSync(`${__dirname}/project.json`) ? JSON.parse(fs.readFileSync(`${__dirname}/project.json`, 'utf8')) : {};
const BASE = process.env.AIRSHEET_BASE || P.base;
const FRONTEND = process.env.FRONTEND || P.frontend || 'http://localhost:9003';

(async () => {
  const [role, sideId, ...pages] = process.argv.slice(2);
  if (!BASE || !role || !sideId || !pages.length) throw new Error('usage: node crawl-lists.cjs <role|visitor> <sideId> <pageId> ...');
  const auth = `${__dirname}/.auth/${role}.json`;
  if (role !== 'visitor' && !fs.existsSync(auth)) throw new Error(`no saved login ${auth}: run shot.cjs ${role} … once first`);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ ...(role === 'visitor' ? {} : { storageState: auth }), viewport: { width: 1366, height: 2400 } });
  const page = await ctx.newPage();
  let seen = {};
  page.on('response', async (r) => {
    if (!r.url().includes('graphql')) return;
    let body; try { body = JSON.parse(r.request().postData() || '{}'); } catch { return; }
    const view = body.variables?.viewId || body.variables?.view;
    if (!view || body.operationName !== 'searchAPI') return;
    try {
      const raw = Object.values((await r.json()).data || {})[0];
      const d = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
      if (Array.isArray(d.records)) seen[view] = d.records.length;
    } catch { seen[view] = 'ERR'; }
  });
  const out = [];
  let bad = 0;
  for (const pageId of pages) {
    seen = {};
    await page.goto(`${FRONTEND}/b/${BASE}/${sideId}/${pageId}`);
    await page.waitForTimeout(+(process.env.WAIT || 14000));
    if (page.url().includes('/auth')) throw new Error(`${role}: login expired, run shot.cjs ${role} again`);
    for (const tab of await page.locator('.q-tab').all()) { await tab.click().catch(() => {}); await page.waitForTimeout(2500); }
    const empty = Object.entries(seen).filter(([, n]) => n === 0 || n === 'ERR');
    bad += empty.length;
    out.push({ page: pageId, lists: seen, empty: empty.map(([v]) => v) });
    console.log(`${pageId}: ${Object.keys(seen).length} lists, empty: ${empty.map(([v, n]) => `${v}=${n}`).join(', ') || '-'}`);
  }
  console.log(JSON.stringify(out));
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
