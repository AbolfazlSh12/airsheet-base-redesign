// Open a page as a saved role (shot.cjs saves the login), click the first card/row whose text is exactly <match>, and
// screenshot the record dialog — the only way to see an expand template as its audience (shot.cjs shoots pages only).
// Usage: node shot-record.cjs <role> <out.jpg> <sideId>/<pageId> <match text>     env: WAIT, WAIT2, PLAYWRIGHT_MODULE, CHROMIUM_PATH
// Opening a record as the OWNER may make the editor rewrite that template: re-run the pages step afterwards (DRY=1 shows it).
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const P = JSON.parse(fs.readFileSync(`${__dirname}/project.json`, 'utf8'));
(async () => {
  const [role, out, target, text] = process.argv.slice(2);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ storageState: `${__dirname}/.auth/${role}.json`, viewport: { width: 1366, height: 2600 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  await page.goto(`${P.frontend}/b/${P.base}/${target}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(+(process.env.WAIT || 18000));
  const el = page.getByText(text, { exact: true }).first();
  await el.scrollIntoViewIfNeeded(); await el.click({ force: true }); // a card's title wrapper intercepts normal clicks
  await page.waitForTimeout(+(process.env.WAIT2 || 14000));
  await page.screenshot({ path: out, fullPage: false, type: 'jpeg', quality: 70 });
  await browser.close();
  console.log(out);
})().catch((e) => { console.error(e.message); process.exit(1); });
