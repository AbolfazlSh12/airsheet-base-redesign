# Photos and visual assets: from the customer's folder to the base

Why this file exists: the first SafarClub build shipped 25 products, 13 categories and 4 cities with generated line-icon
PNGs. The customer saw a catalogue of triangles and circles, and the completion report had to say «تصاویر جایگزین
تولیدشده‌اند». A site that sells gear is judged by its photos first; a placeholder is never "good enough for the demo".

## A0. Ask for the photos on day one

- Put **real photos** in the day-one dependency list of `rfp-analysis.md` A7, next to the product list and the contract
  text: one photo per product (landscape, ≥ 1600 px wide), one per category (or name the product whose photo stands for
  it), one per city, the logo as a vector or ≥ 512 px PNG.
- If the customer has a live site, the photos are already there (SafarClub: rent.safar.club): ask for the export, or for
  permission to download them, before generating anything.
- Generate placeholders only when the photos are promised but late, and say so in the design package and the completion
  report. Never let a placeholder reach the customer without the sentence «عکس واقعی جایگزین می‌شود».

## A1. Folder in, mapping out

The customer sends a folder of files named freely (`03-package-shab-mani-2-nafare.jpeg`). Row order is not a contract:
map **by name**, never by position.

1. Make a contact sheet (PIL: 5 columns of 352×192 thumbnails with the file name under each) and look at it once: a
   wrong or duplicated photo is cheaper to catch here than in a screenshot sweep.
2. Write the mapping in the step script as `product name → file`, normalising ZWNJ and spaces on both sides, and fail
   on an unmapped name, a file mapped twice, or a count that differs from the table's row count (`steps/20-product-images.ts`
   of the SafarClub upgrade is the template).
3. Derived crops come from the same source files: category tiles (4:3, 640×480, the category's flagship product), hero
   and section banners (1600×760, 1400×560), a mobile hero (900×900) when the composition needs it.

## A2. Web size

`base.preferences.maxImageSizeKB` is enforced only in the browser, so the script keeps files small itself: longest side
≤ 1200 px for product photos (≤ 1600 px for a hero), JPEG quality 76–82, progressive, ≈ 100–250 KB. Filenames: ASCII,
no spaces.

## A3. Upload once, keep the keys

`L.uploadFile(path, "image/jpeg", {tableId, recordId})` for record covers, `{sideId}` for page assets. Keys go to
`design/assets/keys.json` keyed by file name; a re-run uploads nothing that has a key. **Never store a `DRY/…` key**
(`uploadFile` returns it in dry mode). Files are never deleted from S3: upload once.

## A4. Write the attachment

```ts
const att = [{ id: randomUUID(), key, url: key, mimetype: "image/jpeg", filename, size, fileSize: size, preview: true,
               type: "jpg", thumbnails: { large: { url: key } } }];   // thumbnails is an OBJECT (platform-lessons «Uploads»)
await L.updateRecord(table, row.id, { [imageField]: att });            // skipped when the row already carries that key
```

GALLERYMENU / MENU / IMAGE / logos take the **key**; TEXT `<img>`, SECTION `backgroundImage` and page `background`
take the **full URL** `<S3 host>/cloud-uploads/<key>` (server-bound: keep the host in one constant
at the top of the pages step, and say in the report that a move to another server means re-running that step).

## A5. Photo hero recipe (SECTION block with a baked-in tint)

Page HTML is sanitised to a style whitelist (platform-lessons «Page HTML sanitiser», cloud-front 5b1968b5e, 2026-10-15):
no `url()`, no `background` shorthand, no position/min-height/gap/grid/shadows/line-height. A photo hero is therefore
a **SECTION** block whose `backgroundImage` is the platform's own setting, with one TEXT child that uses only allowed
styles. The dark gradient that keeps white text readable has no SECTION option, so it is baked into the JPEG:

```bash
python3 darken-hero.py hero-home.jpg hero-home-dark.jpg          # tint 12,44,27; alpha .94 at the RTL text edge → .30 at the far edge
```

```ts
const url = (k) => `${S3}/cloud-uploads/${KEYS[k]}`;            // full URL (server-bound, see A4)
const hero = (id, img, padding, radius, html) => ({ id, type: "SECTION", details: { value: "" }, filter: [], padding, radius,
  borderLine: false, backgroundImage: url(img), section: { label: "section", name: id + "-s", content: { name: "section",
  blocks: [{ id: id + "-t", type: "TEXT", details: { value: html } }] } } });
```

```html
<div style="color:#ffffff;max-width:700px;padding:8px 0 2px">
  <div style="font-size:13px;font-weight:600;margin:0 0 10px">«eyebrow»</div>
  <div style="font-size:34px;font-weight:800;margin:0 0 12px">«title»</div>
  <div style="font-size:15px;margin:0 0 22px;max-width:560px">«one sentence»</div>
  <div style="margin:0 0 14px">
    <a href="/b/<base>/<side>/<page>" style="display:inline-block;background-color:#F26B21;color:#ffffff;font-size:15px;font-weight:700;padding:13px 22px;border-radius:12px;text-decoration:none;margin:0 0 10px 10px">«primary»</a>
    <a href="…" style="display:inline-block;background-color:#ffffff;color:#2F7A4A;…same…">«secondary»</a>
  </div>
  <div><span style="display:inline-block;background-color:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;color:#ffffff;margin:0 0 8px 8px">«trust chip»</span>…</div>
</div>
```

- Home hero: padding `44`, radius `24` (≈ 360 px tall with buttons and chips); page banner: padding `32`, radius `20`;
  CTA strip and dashboard header: padding `20–28`. The SECTION's children render through NotionViewer, each with its own
  `px-4 py-2`, so the visible inset is padding + 16 px.
- Inline-block + margins replace flex/gap (RTL: the **left** margin is the space between neighbours); `background-color`
  only, never `background`; no text-shadow, so keep the baked tint ≥ .30 at the light end for phones, where the text
  spans the whole photo.
- Fixed hex colours and white text: anonymous visitors do not receive the base palette, and dark mode must not flip the
  text (design-guide §2.3).
- Buttons inside the hero are `<a href="/b/<base>/<side>/<page>">`; on a custom domain the `/b/<base>` prefix is wrong
  (design-guide §5.4). Note it in the hand-over or switch the CTAs to a GALLERYMENU before the domain is attached.
- Card grids next to the hero («۴ قدم», contact cards) are COLUMNS3/COLUMNS4 blocks, one TEXT card per column, not a
  `display:grid` TEXT (grid-template-columns is sanitised away and the cards stack).

## A6. Look at it as the visitor, on both widths

- Desktop and mobile screenshots of every changed page **as anonymous** (`scripts/shot-chrome.sh`, no Playwright needed;
  mobile goes through DevTools emulation because Chrome's `--screenshot` flag ignores the window size on phone widths and
  produces a clipped picture that looks like an overflow bug).
- `scripts/probe-chrome.cjs <url>` with `MOBILE=1` prints `scrollWidth` vs the viewport and the widest elements: the only
  acceptable "overflow" is a carousel's off-canvas slides.
- Card word-wrap: a `featured` card whose title or price breaks mid-word needs `featuredSize:"lg"` (design-guide §6).
- A gallery or GALLERYMENU may render empty in a screenshot taken before its images arrived: re-shoot with `WAIT=30000`
  before calling it a bug.
