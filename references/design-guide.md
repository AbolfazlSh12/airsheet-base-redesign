# Airsheet Portal Page-Builder Design Guide

How the Airsheet portal page-builder really renders: every block, its options, and the traps, with component citations.
Written for the first redesign (a supplier portal, 33 pages and 27 expand templates) and generalised. Examples that
mention suppliers, trades or contracts come from that project; the mechanics apply to every base.

Sources:
- **Code**: `cloud-front` (2026-09). File paths below are relative to `cloud-front/`, unless they start with `cloud-back/`. Line numbers drift: re-check a citation before relying on it.
- **Data**: 3,157 pages and 1,241 expand templates on the team test server, read only.
- **Compiled CSS**: Tailwind and Quasar as the dev server on :9003 served them. To check a class, grep the served CSS (or `cloud-front/src`) for it; a class that appears nowhere in `src` does not exist.
- **A headless render** of that CSS, used to check heading and class behaviour.

Where the code and the data disagree, the code wins. Every "known bug" below points to the line that causes it.

---

## 0. The 34 rules. Read these even if you read nothing else

1. **Blocks sit 4 px apart.** The block list is a `flex-wrap gap-1` (`NotionViewer.vue`, draggable class `tw-gap-1`), so vertical rhythm has to come from you. Use SECTION `padding`, TitleDivider (it has `my-4`), or inline `margin` inside TEXT HTML.
2. **Style everything in TEXT HTML inline**:
   - Give every `h1`–`h6` and `p` an explicit `font-size`, `font-weight`, `line-height` and `margin`. Tag defaults depend on CSS load order (§5.3).
   - Style links inline too. Tailwind preflight makes `<a>` look like plain text.
3. **Prefer theme tokens to raw hex** in HTML: `var(--blue)` … `var(--gray4)`, `hsl(var(--b1))`, `hsl(var(--bc))`, `hsl(var(--p))`. If you do use a hex background, also set a hex text colour on the same element. `localStorage.theme` is shared with the main app, so a collaborator who uses dark mode in Airsheet sees the portal in dark mode too (§2.3).
4. **Tailwind classes work only if they were compiled.** Only classes that appear literally somewhere in `cloud-front/src` exist. The default shade scales (`tw-bg-blue-50`, `tw-text-gray-800`, `tw-bg-red-500`) do **not** exist, because `blue`, `gray` and the rest are overridden by single CSS variables. Check against the served CSS, or just use inline `style`.
5. **Physical Tailwind classes flip in RTL.** `postcss-rtlcss` runs over all stylesheets, so `tw-text-left` becomes `text-align:right` under `[dir=rtl]`, and the same happens to `ml-*`, `pl-*`, `left-*` and `border-l`. Inline `style` is **not** flipped.
6. **Put a TitleDivider (or a styled TEXT heading) above every VIEW block.** Portal users (the `user` and `visitor` sides) never see a view's name or toolbar, because `ViewApp.vue:15` shows the header only to collaborators. On collaborator sides, set `displayListName:false` and still use your own heading.
7. **TitleDivider is truncated and ships a dead button.**
   - Its title is cut at 140 / 200 / 360 px (mobile / sm / md+).
   - `showButton` defaults to `true` with the text «مشاهده همه». Always write `"showButton": false`, or give the button a real `linktype` target.
8. **`filterType` / `filterInField` / `filterJoin*` only work where there is a record**: expand templates, the ExpandRecord profile, and form v2 pages. On a plain page, the mask becomes `has any of [undefined]` (`ViewApp.vue:~294-305`), which gives an **empty list**.
9. **A view shown on a `user` or `visitor` side must be "in the side"** (`cloud-back/src/modules/database/models/View.ts isInSide`). Its id has to appear in a **published** page of that side, or in an expand template whose `sides` array contains that side. Otherwise the portal user gets no data: an empty box or a skeleton that never resolves.
10. **Keep Kanban out of COLUMNS, and give it the full page width.**
    - COLUMNS2 column 1 is `overflow-hidden`, and q-splitter panels scroll, so a Kanban inside a column is clipped.
    - Kanban columns are a fixed 280 px, and the board is capped at `100dvh-200px` inside a page.
11. **Gallery type `cards` renders every field justified with a small grey label above it** (`ViewGallery.vue:783,1518`, `tw-text-justify`, `white-space:pre-wrap`).
    - For long text, use `featured` (no labels, not justified) or `news`.
    - Otherwise keep card fields short: at most 3–4 fields, no longText.
12. **Every portal list needs `newable` set explicitly.**
    - `"denied"` hides the button.
    - `newForm:true` with a `newFormPage` makes it open a form.
    - Without either, the «جدید» button calls `create({}, true)` (`ViewGallery.vue:2719`), which **creates an empty record** straight away.
    - So **every list that keeps «جدید» gets a form** (`newable:"access"` + `newForm:true` + `newFormPage:{id, type:"VIEW",
      details:{value:<Form view id>}}`, the editor's own shape, `ViewSettingMenu.vue selectForm`), set by
      `scripts/new-forms.ts` as the last step. A table without a usable Form view first gets «فرم ثبت <table>» (v1 layout
      `[{inputs:[{id,name,description,required,invisible:false,conditions:[]}], doneMessage, button:{text,color}, splitFields:[]}]`;
      required = primary field + the fields the lists group/filter/date on + the parent link, never a collaborator field;
      no formula/lookup/rollup inputs; a link input's picker must be a Gallery).
    - Never default a rebuilt block to `"denied"` to dodge this: it silently removes a button users had.
    - **Never place a Form view on a page next to its list** (rejected by the customer as cluttered): the «جدید» dialog is
      the form. Forms stay on their own page only when the page *is* the form (a portal request page).
13. **Images: know what each block accepts.**
    - GALLERYMENU / MENU / STATS / header logo / IMAGE / FileBlock take **uploaded storage keys** (`<baseId>/<uuid>/<file>`). The component prepends `S3 + /cloud-uploads/`, so an external URL breaks.
    - SECTION `backgroundImage`, page `background` and page `cover` take any URL, including site paths like `/img/...`.
    - A full `https://<s3-host>/...` URL is tied to the environment and will break on another host.
14. **MENU `theme:"type1"` ignores `subtitle`.** It shows a 96 px tile with a label clipped to 72 px. Use `type3` (horizontal card) when you need a subtitle.
15. **GALLERYMENU icon mode needs `iconBgColor`.** Its fallback class `tw-bg-blue-50` doesn't exist, so without it the icon floats on nothing. Its `image` mode renders `item.image` only, so a `lucidIcon` is invisible there.
16. **STATS `color` fills the whole tile.** Use pale tokens (`var(--blue)`, `var(--green)` …). The saturated `var(--x3)` / `var(--x4)` fills make the grey label and icon unreadable. Always give dynamic stats a `field`.
17. **SECTION conditions (`filter`) are evaluated against the record.** On pages without a record, only `[role]` conditions do anything; every other condition counts as true (`utils/filter.js:84`).
18. **RECORD blocks are editable by the viewer** wherever the viewer has edit permission. On read-only portal detail views, mark the fields `immutable` (§4.15).
19. **Expand templates in a record context take the cover from `table.cover`, not from the template's `cover`.** The title is the record's `titleField`, shown when `showTitle !== false`.
20. **A page whose first block is `ExpandRecord` ignores its own `maxw`, cover, title and breadcrumb.** The expand template's `maxw` rules instead.
21. **Form v2 page buttons are inverted.** With `buttonLabel` empty, non-last pages say «ارسال» and the last page says «بعدی» (`ViewFormNotionPage.vue:120`). Always set `buttonLabel`.
22. **ALERT runs `.replaceAll("table"|"td"|"h2"|"h3"|"h4"|"a href")` over its HTML** (`AlertBlock.vue:104`). Don't put those substrings in ALERT text or styles, and keep ALERT HTML to simple `<b>` / `<br>`.
23. **Page `name` (`content.name`) is printed as a 1.5 rem bold title under the cover.** Leave it `""` when the page starts with a hero. An empty name still leaves a ~24 px strip.
24. **Don't use `<style>`, `<script>` or `on*=` attributes in TEXT.** HTML is injected with raw `v-html`, with no sanitizer. A `<style>` leaks to the whole app, and `on*` handlers execute.
25. **Kanban and card titles truncate at 140 px** (`ViewKanbanCard.vue`). Make the first visible field a short one.
26. **Every page and every template has a background, visible and different per side.** Set `background` on each page
    document and template layout; a bare white page reads as unfinished. Use `scripts/visual-kit.ts` `pageBg` (via
    `pageDoc`): a transparent SVG data URI = a diagonal wash in the side's tone + a **pattern of its own per side** (circuit,
    hex, waves, dots, grid, diagonal, plus, chevron, triangles, squares, rings, nodes, stars) + two soft corner circles.
    Calibrated with a customer over three rounds: a wash alone (stop opacities 0.10 / 0.02 / 0.06) was "barely visible,
    all pages alike"; patterns at stroke 0.13–0.20, dots 0.3–0.5 were "too busy"; accepted: wash 0.16 / 0.04 / 0.10,
    circles 0.065 / 0.08, patterns at 0.55 of those (`PATTERN_STRENGTH`, strokes ≈ 0.07–0.11, dots ≈ 0.11–0.27). Change
    only that knob when a customer asks for "more" or "less". Content cards stay on `base-100`, so they separate.
27. **Balance density: no large empty areas, no clutter.** The first screen of a page shows its purpose: a short hero
    (≤ ~200 px), the KPIs and the main action or list. Put related short blocks side by side (COLUMNS2/3: a form next to its
    help, two short lists next to each other); show figures as STATS tiles, not as a vertical stack of RECORD values; no
    single-column column of short fields. At most one hero and two or three titled sections per screen. A STATS row
    fits 4 tiles at `6xl`/`7xl`: use 3 or 4 (or 8), never 5, which leaves one orphan tile on a second row.
28. **Use images where they carry meaning, not as decoration.** A hero illustration, covers on catalogue-like galleries, a
    photo in a record header, an illustration in an empty state. Inline SVG in TEXT works on every server and in dark mode;
    uploaded images need keys (rule 13). One image per section at most.
29. **Choose every view type, gallery type and block by its use case, never by habit or default.** Decide what the user
    does with the list, then pick:

    | Use case | View / block |
    |---|---|
    | Pick from a catalogue with photos (items, rooms, buildings) | Gallery `featured`, cover = the photo |
    | "Latest N" strip on a home page (last deliveries, new items) | Gallery `cardsHorizontal` with cover |
    | Records that move through statuses, worked by a team | Kanban on the status field (full width) |
    | Transactional records a user scans or compares (requests, documents, rows) | Gallery `featured` without image + status colours, or Grid |
    | Data entry and bulk edit by staff | Grid |
    | News, announcements, articles | Gallery `news` (only here) |
    | Navigation, quick actions | MENU `type3` or GALLERYMENU |
    | Figures | STATS; status progress: PROGRESS; one person's or company's own record: ExpandRecord |

    `featured` cards print values **without labels**: give them only self-explanatory fields (title, status chip, date,
    a person's name). A bare figure or code («12», «A», a reservation number) needs a labelled view: Grid or
    `cardsHorizontal`. A `featured` card with an image beside the text needs `featuredSize:"lg"`; `md` squeezes the
    text into one-word lines. A Grid with `groups` on a portal shows only collapsed group headers: sort instead.
30. **Galleries get covers.** Set `brandField` on every Gallery whose records have an image or can get one through a lookup
    (an item photo on a request line, a building photo on a room), and seed an image on every row (§11 #5). If the table has
    no natural image, choose a non-gallery type (rule 29) rather than leave grey boxes.

31. **Links to the base's own pages are page links, never URLs.** Side `header.menuItems`, MENU, GALLERYMENU and
    TitleDivider buttons use `linktype:"page"` + `side` + `path` (+ `link:""`/`url:""`). A `url` of `/b/<base>/<side>/<page>`
    or a full app URL breaks on another host or custom domain and is flagged by the customer as wrong.
32. **Every side has a finished header.** Persian display `name`, a `logo`/`darkLogo` whose file exists on *this* server
    (a base restored from a backup keeps side-logo keys whose files are gone; the base logo usually survives), and a Lucide
    `icon` + `iconColor` (`var(--<hue>3)`, varied and meaningful) on **every** menu item and child — a sidebar of grey
    house icons was the first complaint. A side with pages but no menu gets one (each page of the side, page links). A
    landing/hub side (visitor menu) shows MENU `type3` icon cards (`visual-kit.ts navCards`), never a column of plain
    coloured buttons.
33. **One page look, from the hero down** (the reference the customer accepted, `visual-kit.ts`): dark gradient hero
    SECTION (eyebrow chip «side · area», title ≤ 5 words, optional one-line sub, round icon badge, `content.name:""`),
    then short `info` cards side by side, then icon-square headings over white cards holding the lists and dashboards.
    One tone and one background pattern per side.
34. **No long text, little scrolling.** A paragraph becomes ≤ 3 bullet lines of ≤ 10 words in an `info` card, or is
    dropped if it explains the obvious; no emoji headings, no DIVIDER/empty-TEXT spacers. Group what a page offers into
    TABS / COLUMNS / cards so the first screen shows the page's purpose; a page should not need a long scroll.

---

## 1. Rendering model

### 1.1 How a portal page is assembled

`src/pages/AppPage.vue` renders the side's layout:

```
layouts[side.layoutType || 'website']   // src/pages/AppPage.vue:~223
  └── NotionViewer :page="page.content" :root="page.content.blocks[0].type != 'ExpandRecord'" :inPage
        ├── Breadcrumbs            (page.showBreadcrumb)
        ├── Cover band             (page.cover / table.cover for records)
        ├── Emoji icon             (page.icon, 64px — avoid, looks playful)
        ├── Title                  (page.name, 1.5rem bold)   ← leave "" when you have a hero
        └── blocks  (flex-wrap, gap 4px, px-4 py-2 when root, inside page.maxw || tw-max-w-4xl)
              └── NotionBlock → BlockComponents[type]    (src/utils/types.js:41)
```

- `root` is true unless the first block is `ExpandRecord`. With root true:
  - `page.maxw` applies; the default is `tw-max-w-4xl`, about 896 px.
  - The content gets `px-4 py-2`.
  - `page.align.value` (`start` / `center` / `end`) positions the column. `align` is an **object** `{value,label}`, not a string.
- Nested containers (SECTION, COLUMNS, TABS …) render another NotionViewer with `noHeader` and `root=false`. They get no padding, a 4 px gap, and no title or cover.
- Layouts:
  - `website` (`src/layouts/WebsiteLayout.vue`): a sticky 48 px header (`SideHeader.vue`), `<main>`, and the footer (`SideFooter.vue`), shown only if `footer.details.enabled`.
  - `sidebar` (`src/layouts/SidebarLayout.vue`): a 256 px sidebar (76 px when collapsed), with content in a rounded card on a `bg-base-200/70` backdrop. **It has no footer.**
  - `none`: used by `?frameOnly`.

### 1.2 Contexts: which blocks are allowed where

From `src/components/organisms/notion/BlockMenu.vue:22-82`. The editor menu enforces this, and a component that is used outside its context breaks or renders empty.

| Context | Excluded blocks |
|---|---|
| Page on a `user` / `visitor` side, no record | LINK, BUTTON, RECORD, PROGRESS, COMMENTS, GROUPSECTION, ImageGallery, ControlledEdit |
| Page on a `collaborator` side, no record | BUTTON, RECORD, PROGRESS, COMMENTS, GROUPSECTION, ImageGallery, ControlledEdit |
| Record context (expand template, ExpandRecord, record page), user / visitor side | LINK |
| Record context, collaborator side | none |
| Form v2 page (`isForm`) | COMMENTS, ExpandRecord, TODO, MENU, GALLERYMENU, TASKMANAGER, LINK, CTA, STATS |

BUTTON, RECORD, FIELD, PROGRESS and GROUPSECTION need `record.table`, so use them only in expand templates.

### 1.3 Breakpoints

- **Tailwind**: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- **Quasar `$q.screen`**: the defaults are sm 600 / md 1024 / lg 1440. `SideHeader.vue` re-sets them to 640 / 768 / 1024 / 1280 when it mounts.
  - In the **website** layout, `lt.md` means < 768 px.
  - In the **sidebar** layout, `lt.md` means < 1024 px.
- **COLUMNS2/3/4** stack to one column when `lt.md` (`Columns*Block.vue`).
- **Cover** height per device comes from `coverVariants` (`src/utils/cover.js`): mobile < 640, tablet < 1024.
- **Headings** from `typography.scss` shrink below 1024 px (§5.3).

### 1.4 Spacing primitives

| Source | Spacing |
|---|---|
| Page root | `px-4 py-2` |
| Between blocks | 4 px |
| TEXT block | `q-py-xs` = 4 px top/bottom |
| TitleDivider | `my-4 px-2` |
| ExpandItem | `mb-1.5` |
| q-tab-panel (TABS content) | 16 px on all sides (Quasar default) |
| SECTION | `padding` (px, inline, default 0), `radius` (px) |

---

## 2. Colour, type and theme

### 2.1 Palette tokens (daisyUI 3 + custom vars, `tailwind.config.js`)

| Family | Use | Light (default palette) | Dark |
|---|---|---|---|
| `blue` `cyan` `teal` `green` `yellow` `orange` `red` `pink` `purple` `gray` (level 1) | pale fills: sections, tiles, chips | blue `#d1e2ff`, green `#cff5d1`, yellow `#ffeab6`, red `#ffd4e0`, gray `#e5e9f0` | deep tints (`#1e40af` …) |
| `…2` | mid tints, chips, borders | blue2 `#a0c6ff`, green2 `#9ae095` | `#0d52ac` … |
| `…3` | saturated accents, icons, buttons | blue3 `#3b82f6`, green3 `#22c55e`, red3 `#ef4444` | `#60a5fa` … |
| `…4` | dark text on pale fills, button hover | blue4 `#2563eb`, gray4 `#4b5563` | light (`#93c5fd`) — readable on dark |
| `base-100/200/300` | page, card and muted surfaces | `#fff` / `#f9f9f8` / `#f3f4f6` | `#1d232a` / `#191e24` / `#15191e` |
| `base-content`, `neutral-content`, `primary` | text, muted text, brand | `#333`, `#6b7280`, `#2563eb` | `#dedede`, `#A6ADBB`, `#3b82f6` |

**Class form.** `tw-bg-<token>` exists for every level and every colour (verified). `tw-text-*` exists only for some combinations; `tw-text-teal`, `tw-text-red`, `tw-text-pink3`, `tw-text-yellow2` and others are **missing**.

**Inline form.** Use these in any `style`:

| Token | Inline value |
|---|---|
| Palette colours | `var(--blue)` … `var(--gray4)` |
| base-100 / 200 / 300 | `hsl(var(--b1))` / `hsl(var(--b2))` / `hsl(var(--b3))` |
| base-content | `hsl(var(--bc))` |
| neutral-content | `hsl(var(--nc))` |
| primary | `hsl(var(--p))` |
| primary-content | `hsl(var(--pc))` |

`var(--base-200)`, `var(--primary)` and `var(--base-content)` are **not defined**. Some components use them as defaults anyway: the footer bg, TitleDivider, MENU. Don't copy them.

### 2.2 Base-level palette

`base.preferences.palette` ∈ `default | alternative | alternative2` (`src/pages/SettingsPage.vue:2358`, `src/utils/useThemeManger.js`) switches the whole daisy theme, `<palette>_light|dark`:

| Palette | Primary | Base | Character |
|---|---|---|---|
| `default` | `#2563eb` | white / grey | the current setting of this base |
| `alternative` | `#013e37` | cream `#FFFCF5` | dark green |
| `alternative2` | `#0284c7` | `#fbfcff` / `#f4f7ff` | sky blue, and `--blue` = `#e0f2fe` etc. |

**Customer brand**: sample the customer's own logo (preferably the vector in their documents, not a web thumbnail) and pick
the built-in palette whose primary hue is closest; it recolours every `var(--blueN)` and `hsl(var(--p))` in one step.
- Example (first project): the logo measured `#0095DA`, so `alternative2` (sky, hue 199°) was chosen.
- Hand-written HTML can only set flat colours (`background-color`; page HTML is sanitised — platform-lessons «Page HTML sanitiser»). A brand hero is a TEXT with a fixed `background-color:<navy>` and white text, a photo hero is a SECTION with `backgroundImage` (asset-pipeline A5); both read the same in both themes.
- Logo files must be uploaded (`L.uploadFile`) to become storage keys.

### 2.3 Dark mode

- The theme is `localStorage.theme`, shared across Airsheet.
- A `data-theme` attribute and a `dark` class go on `<html>` and `<body>` (`useThemeManger.js`).
- The portal header can show a toggle (`header.themeButton.show`). Keep it **off** unless every page is token-based.
- Rules:
  - (a) Where you use tokens, both themes work automatically.
  - (b) Where you use hex, set background **and** text colour on the same element.
  - (c) Never rely on inherited text colour inside a hex-coloured box.

### 2.4 Fonts

- Body: `IRANSansXV` (FaNum digits), 14 px, line-height 1.5 (`src/css/app.scss`).
- Families available in inline style: `"Doran FaNum"`, `IRANSans`, `IRANSansDN`, `"IRANSansXFaNum"`, `iranyekan`, `ModamFaNumWeb`, `Panchang`, and the Plasma dot fonts. These are the names the q-editor offers (`src/components/Utils/Editor.vue`).
- For a clean look, use one family, `IRANSansXV` (the inherited default), and vary weight and size instead.

---

## 3. Page document (`Page.content`, a JSON **string**) and expand-template layout (`ExpandTemplate.layout`, same shape)

```json
{
  "name": "",
  "blocks": [],
  "maxw": "tw-max-w-6xl",
  "align": {"value": "center", "label": "وسط"},
  "cover": "",
  "fitMode": "cover",
  "coverPosition": {"x": 50, "y": 50},
  "coverHeight": 220,
  "coverVariants": {"mobile": {"height": 140}, "tablet": null},
  "background": {"type": "color", "value": "hsl(var(--b2))"},
  "showBreadcrumb": false,
  "showBreadcrumbBelowCover": false,
  "breadcrumbItems": [],
  "icon": "",
  "showTitle": true,
  "titleField": "<fieldId>",
  "seo": "{\"title\":\"…\",\"description\":\"…\"}"
}
```

| Key | Effect | Source |
|---|---|---|
| `name` | Title under the cover, 1.5 rem bold. It is also synced to `Page.name` when the owner edits | `NotionViewer.vue`, `AppPage.vue update()` |
| `maxw` | `tw-max-w-{2xl,3xl,4xl,5xl,6xl,7xl,full}`; the default is `tw-max-w-4xl`. Only for root pages and templates | `NotionViewer.vue changeMaxWidth` |
| `align.value` | `start`, `center` or `end`; applies when `maxw` < full | `NotionViewer.vue alignment` |
| `cover` | A storage key, an http(s) URL, or a site path (`/img/…`). Empty means no band when readonly | `src/utils/cover.js resolveCoverUrl` |
| `coverHeight` | 80–600, default 200 | `cover.js` |
| `fitMode` | `cover` or `contain` | `cover.js` |
| `coverPosition` | `{x,y}` in % | `cover.js` |
| `coverVariants.mobile/tablet` | Sparse overrides: `{cover, height, fitMode, position}` | `cover.js normalizeCoverSettings` |
| `background` | `{type:"color", value:<css>}` or `{type:"image", value:<url>, fixed:bool}`, painted behind the whole page (the wrapper is at least one screen tall, so it also covers the blank band under a short page). The product ships `/img/page%20bg/background1.jpg` … `background11.jpg` (percent-encode the space; `.webp` twins are lighter), but they are opaque photos that break dark mode (light titles vanish): prefer a transparent SVG `data:image/svg+xml,…` URI with no single quote. Always `cover/center/no-repeat`; no overlay, opacity or dark variant. An uploaded file needs its full storage URL (environment-bound); a relative `/cloud-uploads/…` returns the SPA's HTML without a same-origin proxy | `NotionViewer.vue pageBackgroundStyle`, `BackgroundSettings.vue` |
| `showBreadcrumb`, `showBreadcrumbBelowCover`, `breadcrumbItems` | Items are `[{id,title,linktype:"page"\|"url",side,path,url}]`. Rendered as a rounded bar | `NotionBreadcrumbs.vue` |
| `showTitle`, `titleField` | **Record context only.** Hide the record title, or choose which field shows | `NotionViewer.vue` |
| `icon` | Emoji at 64 px | `atoms/EmojiIcon.vue` |
| `seo` | JSON string with `title`, `description`, `keywords`, `metaTags[]`. Visitor sides only | `AppPage.vue useMeta` |

Other Page document fields (not in `content`):
- `name`: the name shown in lists and menus.
- `slug`: the URL path can be `_id`, `name` or `slug` (`src/composables/page.js:22`).
- `status`: `draft` pages are visible only to owners.
- `type`: `minimal`, or `record` for record pages.

**Cover in a record context.** `normalizeCoverSettings(page, table.cover)` makes the **table's** cover win; see `NotionViewer.vue coverSettings`. The template's `cover` key is ignored whenever a record is shown. Tables usually have no cover, so templates render with no band. That is fine: use a header SECTION instead (§8.3).

---

## 4. Block reference

Every block is `{ "id": "<unique string, uuid>", "type": "<TYPE>", "details": { … } }`. Some blocks also carry sibling keys at the block level:
- SECTION style keys, `filter`, and `section`
- `column1` … `column4`
- `tabsBgColor`

Ids must be unique within a document.

### 4.1 TEXT: `blocks/TextBlock.vue`
- **Shape**: `{"type":"TEXT","details":{"value":"<html>"}}`.
- **Render**: readonly output is `<div class="q-py-xs text-block-container" v-html="value">`, raw HTML with no sanitizer. When editing, it is a Quasar `q-editor`, which keeps the HTML unless the owner types into it.
- The most powerful block. Heroes, card grids, callouts and steps can all be TEXT. See §5 for the HTML rules.

**Minimal example:**
```json
{"id":"t1","type":"TEXT","details":{"value":"<p style=\"margin:0;font-size:14px;line-height:1.9;color:hsl(var(--nc))\">متن توضیح کوتاه.</p>"}}
```

### 4.2 H1 / H2 / H3 / QUOTE: `blocks/Heading{1,2,3}Block.vue`, `QuoteBlock.vue`
- **Shape**: `details.value` is **markdown-lite**: plain text with `**bold**` / `*italic*` (tiptap `EditorPage.vue`: Document, Paragraph, Bold, Italic only).
- **Size**: H1 is `tw-text-3xl` extrabold, H2 `tw-text-2xl` bold, H3 `tw-text-lg` bold.
- There is no colour or alignment option. Prefer TitleDivider or styled TEXT for professional headings.

### 4.3 DIVIDER: `blocks/DividerBlock.vue`
- **Shape**: `{"type":"DIVIDER","details":{}}`.
- **Render**: a 16 px spacer with a bottom border in `base-content` (dark, strong), then 12 px. It looks heavy. Prefer a TitleDivider, or SECTION spacing.

### 4.4 TitleDivider: `blocks/TitleDividerBlock.vue`
The best section header: an accent bar, a title, a hairline, and an optional button.

| Key | Values and defaults |
|---|---|
| `title` | Text. Rendered with `{{ }}`, so HTML is not allowed. Truncated to 140 / 200 / 360 px |
| `titleColor` | CSS colour; `""` means inherit |
| `showIndicator` | Boolean, default true |
| `indicatorOrient` | `vertical` or `horizontal` |
| `indicatorSizeKey` | `sm`, `md` or `lg` |
| `indicatorColor` | Default `var(--blue2)` |
| `showLine` | Boolean, default true |
| `lineColor` | Default `var(--gray3)` |
| `showButton` | **Defaults to true.** Set it to `false` unless the button has a target |
| `buttonText`, `buttonColor`, `buttonTextColor` | Button text and colours; hover auto-steps `--x` → `--x2` |
| `linktype` | `page` (with `side` + `path`), `url` (with `url` and `openInNewTab`), or `dialog` (with `dialog: {label,name,content:{name,blocks}}` and `dialogSize` `xs\|sm\|md\|lg\|xl`, which map to 360 / 480 / 700 / 960 / 1280 px) |

The `dialog` link type opens a popup page. For example, a «ثبت درخواست» button can open a Form VIEW.

**Minimal example:**
```json
{"id":"td1","type":"TitleDivider","details":{"title":"درخواست‌های من","showIndicator":true,"indicatorOrient":"vertical","indicatorSizeKey":"md","indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":false}}
```

With a button that opens a form in a dialog:
```json
{"id":"td2","type":"TitleDivider","details":{"title":"درخواست‌های تحویل","showIndicator":true,"indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","showButton":true,"buttonText":"ثبت درخواست جدید","buttonColor":"var(--blue3)","buttonTextColor":"#ffffff","linktype":"dialog","dialogSize":"md","dialog":{"label":"dialog","name":"d-uuid","content":{"name":"dialog","blocks":[{"id":"fv1","type":"VIEW","details":{"value":{"value":"<formViewId>","expandTemplate":"default"}}}]}}}}
```

### 4.5 ALERT: `blocks/AlertBlock.vue`
- **Shape**: `{"type":"ALERT","details":{"value":"<title html>","subtitle":"<body html>","color":"<token>"}}`.
- **Render**: `tw-bg-{color}` (default `blue`), `p-2`, `rounded-xl`, `text-base-content`. The title is bold 1.1 em and the body 0.9 em.
- `color` must be a class token: `blue`…`gray`, `blue2`…`gray2`, or `base-100`. Levels 3 and 4 exist as classes, but they are too dark for dark text.
- Gotcha: `improve()` string-replaces `table`, `td`, `h2`/`h3`/`h4` and `a href` in both fields. Keep the content to plain text plus `<b>` and `<br>`.

```json
{"id":"al1","type":"ALERT","details":{"value":"<b>راهنما</b>","subtitle":"پس از ثبت، وضعیت درخواست را از «پیگیری درخواست‌ها» دنبال کنید.","color":"blue"}}
```

### 4.6 SECTION: `blocks/SectionBlock.vue`
A styled container with children in `section.content.blocks`. The styling lives in **block-level** keys, not in `details`:

| Key | Effect |
|---|---|
| `color` | `tw-bg-{token}`. Ignored when `backgroundImage` is set |
| `tcolor` | Inline `color: var(--{token})`. Use a content token such as `gray4` or `blue4` |
| `backgroundImage` | Full URL; rendered as cover / center / no-repeat |
| `backgroundBlur` | Backdrop blur 12 px, plus a white 10% fill if there is no colour |
| `padding`, `radius` | px (strings in the data, e.g. `"24"`) |
| `border` | Boolean: `tw-border tw-shadow-sm` |
| `borderLine`, `borderWeight` (1–20), `borderColor` | Inline border; the colour defaults to `var(--gray2)` |
| `shadowEnabled`, `shadowIntensity` (5–80, default 25), `shadowColor` | Two-layer shadow, colour `var(--{token})` or `rgba(0,0,0,.15)` |
| `maxWidth` | `2xl`…`7xl` or `full`: inner width (`tw-max-w-*`) |
| `justifySelf` | `start`, `center` or `end`: where the box sits. **Set `center` whenever `maxWidth` < full** |
| `justify` | `right`, `center`, `left` or `justify`: text alignment. It is inverted and then RTL-flipped, so the result is right = right. **Never use `justify`** |
| `filter` | Visibility condition (§4.24). The UI shows it only in a record context or on collaborator sides |
| `section.otp` | Enterprise OTP gate; not used here |

```json
{"id":"s1","type":"SECTION","details":{"value":""},"filter":[],
 "color":"base-100","padding":"24","radius":"16","borderLine":true,"borderWeight":1,"borderColor":"gray","shadowEnabled":true,"shadowIntensity":12,
 "maxWidth":"6xl","justifySelf":"center",
 "section":{"label":"section","name":"s1-uuid","content":{"name":"section","blocks":[
   {"id":"s1t","type":"TEXT","details":{"value":"<p style=\"margin:0\">…</p>"}}]}}}
```

The style values observed across the data: radius is usually 10, 15 or 20; padding 10, 15, 20 or 30. `border:true` was used 320 times.

### 4.7 COLUMNS2 / COLUMNS3 / COLUMNS4: `blocks/Columns{2,3,4}Block.vue`
- **Shape**: `columnN = {label:"N", name:<uuid>, splitter:<number>, content:{name:"N", blocks:[…]}}`.
- **Splitters are nested.** `column1.splitter` is column 1's share of the **whole** row. `column2.splitter` is column 2's share of **what remains**, and the last column has none.
  - Equal widths: 2 columns → `50`; 3 → `33.33, 50`; 4 → `25, 33.33, 50`.
  - 2:1 split: `66.67`. 1:2 split: `33.33`.
- In RTL, `column1` is the **right-hand** column.
- Readonly hides the separator.
- Below `md` the columns stack, with `mt-4` between them.
- Column 1 of COLUMNS2 has `overflow-hidden`, and q-splitter panels scroll. **Never put a Kanban, Calendar or wide Grid in a column.**

```json
{"id":"c2","type":"COLUMNS2","details":{"value":""},
 "column1":{"label":"1","name":"c2a","splitter":66.67,"content":{"name":"1","blocks":[{"id":"c2a1","type":"TEXT","details":{"value":"…"}}]}},
 "column2":{"label":"2","name":"c2b","content":{"name":"2","blocks":[{"id":"c2b1","type":"TEXT","details":{"value":"…"}}]}}}
```

### 4.8 TABS: `blocks/TabsBlock.vue`
- **Shape**: `details` **is the array** of tabs: `[{label, name:<uuid>, color:"base-100", bold:false, userFilterTab:[], content:{name, blocks}}]`. The block-level key `tabsBgColor` is the pill background token for every tab.
- **Render**:
  - Pills are 28 px high. Inactive tabs are at 40% opacity; the active tab has a bottom border in `base-content`.
  - With the fa locale, the first tab appears on the right.
  - Content goes in a `q-tab-panel`, which adds 16 px padding.
  - The selected tab is mirrored into the URL query, keyed by the block id.
- `userFilterTab` is a visibility condition, evaluated like the SECTION filter.
- Use `bold:true` for the primary tab, and keep labels short: 2–3 words.

```json
{"id":"tb","type":"TABS","tabsBgColor":"base-100","details":[
 {"label":"باز","name":"tab-open","color":"base-100","bold":true,"content":{"name":"باز","blocks":[{"id":"v1","type":"VIEW","details":{"value":{"value":"<viewOpen>","expandTemplate":"default"}}}]}},
 {"label":"بسته‌شده","name":"tab-closed","color":"base-100","bold":false,"content":{"name":"بسته‌شده","blocks":[{"id":"v2","type":"VIEW","details":{"value":{"value":"<viewClosed>","expandTemplate":"default"}}}]}}]}
```

### 4.9 ExpandItem (accordion): `blocks/ExpandItemBlock.vue`
- **Shape**: `{"details":{"title":"<html>","label":"…","name":"<uuid>","defaultOpen":false,"content":{"name":"…","blocks":[…]}}}`.
- **Render**: a bordered, shadowed, rounded card, with `title` injected through `v-html`. Content is lazy-mounted on first open.
- Good for FAQs and help pages.

### 4.10 TIMELINE: `blocks/TimelineBlock.vue`
- **Shape**: `details.value = [{point:"<label>", content:{name:<index>, blocks:[…]}}]`.
- **Render**: a vertical line on the start side, with dots. Use it for process explanations such as the registration steps.

### 4.11 VIEW: `blocks/ViewBlock.vue` → `organisms/ViewApp.vue`
- **Shape**: `{"type":"VIEW","details":{"value":{ …context… }}}`. The `value` object is the **page context** of this view instance.
- The aliases `Grid`, `Gallery`, `Form`, `Kanban`, `Dashboard` and `Intelligence` are the same component.

| Context key | Meaning (defaults in bold) | Consumer |
|---|---|---|
| `value` | View id | ViewApp |
| `expandTemplate` | Template id, `"default"` (resolved per side, §8.1) or `"noExpand"` | ViewSettingMenu, gallery / grid |
| `expandMode` | `dialog`, `drawer`, `newTab` or `recordPage`; falls back to `base.preferences.expandMode` or `dialog` | `ViewGallery.vue expand()` |
| `displayListName` | **true**. Shows the view name for collaborators. Set it to `false` | ViewApp |
| `viewToolbar` | **visible** (collaborators) or `invisible`. Owners always see it | ViewApp:67 |
| `showSettings`, `showFilter`, `showSort`, `showGroup`, `showSearchFields`, `showPageSize` | Individual toolbar items; they default to true when the toolbar is visible | ViewApp `initToolbarDefaults` |
| `viewFilterbar` | **visible** or `invisible`. The search box and filter chips row of Gallery / Grid for non-owners | `ViewGallery.vue:213` |
| `newable` | **access** (by permission), `all` (via form, for everyone) or `denied` | ViewSettingMenu, `ViewGallery.vue:143` |
| `newForm` + `newFormPage` | Open this form in a dialog for «جدید». `newFormPage = {"id":"<uuid>","type":"VIEW","details":{"value":"<formViewId>"}}` | `ViewGrid.vue:665`, gallery `createOrDialog` |
| `buttenText` (sic) | Label of the new button (default «جدید») | ViewGrid / ViewGallery |
| `buttonColor` | Token; renders `var(--{token}4)` | ViewGrid / ViewGallery |
| `downloadList`, `uploadList`, `export`, `import` | Download / upload buttons | ViewGrid / Gallery / Kanban |
| `lockSettings` | Non-owners can't edit inline or use the context menu | ViewApp `isCollaboratorLocked` |
| `filterType` + `filterInField` / `filterOutField` / `filterJoinInField` + `filterJoinOutField`, `showAll`, `autoLinkField`, `bgField` | **Record context only**: related-list filters and auto-link on create | ViewApp mask / contextInit |
| `defaultValues` | Default field values for a Form view in this block | `ViewForm.vue useForm(... pageContext.defaultValues)` |
| `backButtonAlignment` | Form v2 back button | ViewForm |
| `recordPagePath`, `recordPageSlug`, `recordPageSide`, `recordPageTable` | For `expandMode:"recordPage"` | ViewSettingMenu |

**Clean portal list (supplier sees only their own rows through the view's filter or record roles):**
```json
{"id":"v1","type":"VIEW","details":{"value":{"value":"<viewId>","expandTemplate":"<templateId>","expandMode":"dialog","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"visible","newable":"denied","lockSettings":true}}}
```

**List with a create button that opens a form:**
```json
{"id":"v2","type":"VIEW","details":{"value":{"value":"<listViewId>","expandTemplate":"<templateId>","displayListName":false,"viewToolbar":"invisible","newable":"access","newForm":true,"newFormPage":{"id":"nf-uuid","type":"VIEW","details":{"value":"<formViewId>"}},"buttenText":"ثبت درخواست جدید","buttonColor":"blue"}}}
```

View-level display settings are covered in §6.

### 4.12 ExpandRecord ("profile"): `blocks/ExpandRecordBlock.vue`
- **Shape**: `details.value = {value:<viewId>, expandTemplate:<templateId>, profileAccreditField:<fieldId>, profileCondition:"has my mobile"|"has my email"|"has my national ID"}`.
- **Render**:
  - It shows the **first record** of the view, filtered to the current user by `profileAccreditField` + `profileCondition`.
  - The record is drawn through `ViewSideRecord` with `inlineExpand` and the template's layout, followed by the record's own `layout` field (per-record notion page).
  - The template title is hidden unless the table has a `logoField`.
- As the **first block** of a page it switches off the page cover, title and maxw (§1.1), so the template controls the design.
- This is how the supplier dashboard and profile pages work: «پیشخوان تأمین‌کننده», «پرونده من» and so on are expand templates. Everything a supplier sees about *their own company* is designed **in the template**, where record context lets you use RECORD, PROGRESS, BUTTON, `filterInField` lists and record-conditional SECTIONs.

### 4.13 STATS: `blocks/StatsBlock.vue`, `StatsBlockItem.vue`, `composables/stats.js`
- **Shape**: `details.value = [item]`.

| Item key | Meaning |
|---|---|
| `id` | Required; also the server lookup key |
| `label` | Tile label |
| `type` | `dynamic` or `static` |
| `table`, `field`, `aggregate` | `sum`, `avg`, `count`, `min` or `max`. **`field` is required even for count**: the watcher only refetches when table, field and aggregate are all set. Use the primary field |
| `filter` | Filter array (§4.24) |
| `value` | For static items |
| `format` | `id`, `quantity`, `percent`, `date` or `duration` (`utils/statFormat.js`) |
| `unit` | Small text under the value |
| `icon` | Lucide name, or legacy HeroIcon `*Icon`. Default `ChartBarIcon`. Rendered 24 px in `hsl(var(--nc))` |
| `image` | Storage key; rendered 80 px high instead of the icon |
| `color` | Inline tile background. Use pale tokens: `var(--blue)`, `var(--green)`, `var(--yellow)`, `var(--red)` |
| `drilldownView` | View id. Clicking opens a bottom-sheet list, **collaborator sides only** |

- **Grid**: `repeat(auto-fill, minmax(180px, 1.9fr))`, gap 12. Tiles are `rounded-xl`, bordered, and carry a grey gradient overlay.
- The value size steps down with length: 3xl, 2xl, xl, lg.
- On `user` / `visitor` sides the query runs as `type:"shared"`, server-side `sharedStats` (§11.19).

```json
{"id":"st","type":"STATS","details":{"value":[
 {"id":"st-1","label":"درخواست‌های باز","type":"dynamic","table":"<tableId>","field":"<primaryFieldId>","aggregate":"count","icon":"Inbox","color":"var(--blue)","format":"quantity",
  "filter":[{"index":0,"filter":{"andor":"and","field":"<statusFieldId>","operator":"is","operand":"در انتظار بررسی","relativeDate":null,"relativeTime":null}}]}]}}
```

### 4.14 MENU (link tiles and cards): `blocks/MenuBlock.vue`
- **Shape**: `details.value = [item]`.

| Item key | Values |
|---|---|
| `id`, `label` | Required |
| `subtitle` | **type3 only** |
| `theme` | `type1` (icon tile), `type2` (image tile) or `type3` (horizontal card) |
| `cardMediaType` | `icon` or `image` (type3) |
| `lucidIcon` | Lucide name; preferred |
| `icon` | Legacy HeroIcon; the default is `ArrowLeftIcon` |
| `image` | Storage key |
| `bgColor` | Tile or card background. Default `hsl(var(--b1))` |
| `iconBgColor` | type3 icon square. Default `var(--orange2)` |
| `textColor` | Icon colour |
| `linktype` | `page` (`side`, `path`), `url` (`url`) or `dialog` (`dialog`, `dialogSize`) |

- **Grid**: `auto-fill minmax(70px, 1fr)`, gap 12.
  - type1 and type2 are 96 px high, with a 72 px label under the tile.
  - type3 spans 4 columns: at `tw-max-w-6xl` you get 3 cards per row. Each card is 82 px high, `rounded 18px`, soft-shadowed, with a 60 px icon square, a 17 px bold title and a 13 px muted subtitle, and it lifts on hover.
- Below 640 px, everything is one column.
- **type3 is the most "product-like" quick-action component available.**

```json
{"id":"mn","type":"MENU","details":{"value":[
 {"id":"mn1","label":"ثبت درخواست","subtitle":"تحویل کالا، پرداخت، مفاصاحساب","theme":"type3","cardMediaType":"icon","lucidIcon":"FilePlus2","bgColor":"hsl(var(--b1))","iconBgColor":"var(--blue)","textColor":"var(--blue4)","linktype":"page","side":"<sideId>","path":"<pageId>","filter":[],"value":""}]}}
```

### 4.15 RECORD (record-fields block): `blocks/RecordBlock.vue` (record context only)

| `details` key | Values |
|---|---|
| `value` | Array of field ids, in order |
| `fieldsTheme` | `visibleSide` or undefined (label on the side, 110 / 150 px wide), `visibleTop` (label above) or `invisible` (value only) |
| `valuesTheme` | `border` (bordered, shadow-sm), `bg` (base-300 at 70%) or `none` / undefined |
| `showFieldIcons` | Default true; shown to collaborators only. **Set it to `false`** |
| `hidden` | `{fieldId: <filter[]>}`. An empty array means **always hidden**; with conditions, hidden when they match |
| `immutable` | `{fieldId: <filter[]>}`. Read-only: `[]` means always, conditions mean when they match |
| `limits.conditions` | `{fieldId: filter[]}`: selection scope for link fields |
| `openRecords` | `{fieldId: …}`: open linked records |
| `linkType` | `{fieldId: "create"\|"select"\|"selectOrCreate"}` |

- Across the data, `fieldsTheme` is `invisible` 1,213 times and `visibleTop` 499 times; `valuesTheme` is `border` 1,141 times and `bg` 622 times.
- Recommended for detail views: `visibleTop` + `bg`, arranged 2–3 per row using COLUMNS.
- Use `invisible` + `none` to display a single value as "big text", for example a title or a status chip.
- It is also used inside form v2 pages to lay out inputs.

```json
{"id":"rf","type":"RECORD","details":{"value":["<f1>","<f2>","<f3>"],"fieldsTheme":"visibleTop","valuesTheme":"bg","showFieldIcons":false,"immutable":{"<f1>":[],"<f2>":[],"<f3>":[]}}}
```

### 4.16 FIELD: `blocks/FieldBlock.vue` (record context)
- **Shape**: `details.value = [fieldId]`, `details.label` (custom label), `details.fieldsTheme`, plus a block-level `maxWidth`.
- **Render**: always a bordered value box.
- RECORD is more flexible.

### 4.17 GALLERYMENU (image or icon tiles): `blocks/GalleryMenuBlock.vue`

**`details`:**

| Key | Values |
|---|---|
| `value` | Array of items |
| `displayMode` | `image` (default) or `icon` |
| `cardSize` | `xs`…`xl`. Image mode: min column 100 / 140 / 180 / 220 / 300 px. Icon mode: tile 80–190 px, icon 24–56 px |
| `fit` | Bool. `auto-fit` stretches the tiles to fill the row; image mode also gets a 150 px minimum image |
| `imageFit` | `cover` or `contain` |

**Item keys:**

| Key | Values |
|---|---|
| `id`, `label` | `label` is a truncated h6 under the image or icon |
| `align` | `start`, `center` or `end` |
| `image` | Storage key |
| `lucidIcon` | Icon mode |
| `icon` | Legacy HeroIcon |
| `color` | Card background |
| `iconBgColor` | **Required in icon mode** |
| `iconColor` | Icon colour |
| `shadow` | Image mode: border + shadow-sm |
| `shadowEnabled`, `shadowIntensity`, `shadowColor` | Hover shadow |
| `borderEnabled`, `borderWidth`, `borderColor` | Border |
| `linktype` | `page` (`side` + `path`, `openInNewTab`), `url` or `dialog` (`dialog`, `dialogSize`) |

- In image mode, image height by `cardSize`: xs 100, sm 150, md natural, lg 220, xl 300 (object-fit cover).

```json
{"id":"gm","type":"GALLERYMENU","details":{"displayMode":"icon","cardSize":"md","fit":true,"value":[
 {"id":"gm1","label":"قراردادهای من","lucidIcon":"FileSignature","iconBgColor":"var(--blue)","iconColor":"var(--blue4)","color":"hsl(var(--b1))","borderEnabled":true,"borderWidth":1,"borderColor":"var(--gray)","shadowEnabled":true,"shadowIntensity":18,"align":"center","linktype":"page","side":"<sideId>","path":"<pageId>","openInNewTab":false,"filter":[],"value":""}]}}
```

### 4.18 BUTTON: `blocks/ButtonBlock.vue` (record context only)
- **Shape**: `details = {text, color:<base token e.g. "blue">, actions:[…]}`.
- **Render**: 32 px high, `tw-bg-{color}3`, hover `{color}4`, white text.
- Actions:
  - `{"type":"change-field-value","config":{"editingField":{"value":<fieldId>,"label":…,"type":"singleSelect","possibleValues":[…]},"record":{<fieldId>:<newValue>}}}`
  - `{"type":"record-export","config":{exportType, exportTemplate:{value}, tableTemplate}}`
- Show it conditionally by wrapping it in a SECTION with a `filter` on the status field. The PROGRESS «شروع» pattern does exactly this (`NotionViewer.vue insertProgressStartButtonBlock`).

### 4.19 PROGRESS (state stepper): `blocks/ProgressBlock.vue` (record context)
- **Shape**: `details = {stateField:<singleSelect id>, direction:"horizontal"|"vertical", states:[{label:<option>, name:<uuid>, content:{name, blocks}}]}`.
- **Render**: a q-stepper whose active step is the record's option index. Every step can hold blocks.
- Great for request workflows: draft → submitted → reviewed → approved.

### 4.20 CTA (banner): `blocks/CTABlock.vue`
- **Shape**: `details = {title, subtitle, btnLabel, type:"image"|"video", images:[<key>], video, dir, linktype:"page"|"url", side, path, url}`.
- **Render**: on lg screens, the image half (a swiper, 270 px, **object-fit contain**, default `/icons/earth.webp`) sits next to a text half with 48 px padding.
- The title uses `tw-text-gray-800`, which **is not compiled**, so the title just inherits. The button always renders, even when `btnLabel` is empty.
- **It looks dated. Use a flat TEXT hero (§10.1) or a SECTION photo hero (asset-pipeline A5) instead.**

### 4.21 IMAGE: `blocks/ImageBlock.vue`
- **Shape**: `details.value = {image:<storage key>, caption, width:300, mobileMax:320, direction:""|"rtl"|"ltr"}`.
- The src is always `S3/cloud-uploads/<image>`, so only uploaded keys work.
- The width is in px, capped at 100%.

### 4.22 FileBlock: `blocks/FileBlock.vue`
- **Shape**: `details = {listTitle:"فرم‌ها و مستندات", files:[{key:<storage key>, title:"…"}]}`.
- **Render**: a list of `bg-base-200` rounded cards, each with an icon by extension and a download action.
- Use it for downloadable templates and guides.

### 4.23 Other blocks (brief)

| Block | Details | Notes |
|---|---|---|
| DateBlock | `dateType` (today / yesterday / tomorrow), `dateFormat`, `includeTime`, `timeFormat`, `clockStyle` (digital / vertical) | |
| EMBED | `value` (iframe HTML or URL) and `mobileValue` | Sanitized with `sanitize-html` (iframes allowed) |
| COMMENTS | Record context | |
| TODO | `value`, `checked` | |
| LINK | Opens `/app/<view>`, collaborators only | **Don't use** |
| GenerateText | AI | |
| TASKMANAGER | | |
| ImageGallery | Record attachments field: `field`, `overlayField`, `border*` | |
| ControlledEdit | | |
| GROUPSECTION | Record context; a per-option section of a singleSelect | |
| IranMap | | |
| FORM / ExitForm | E-commerce token only | |

### 4.24 Filter / condition JSON (shared by SECTION `filter`, STATS `filter`, TABS `userFilterTab`, RECORD `hidden` / `immutable`, form input `conditions`, menu `userFilter`)

```json
[{"index":0,"filter":{"andor":"and","field":"<fieldId>","operator":"is","operand":"تأییدشده","relativeDate":null,"relativeTime":null}}]
```

**Operators** (`src/utils/filter.js`):
- `is`, `is not`, `contains`, `does not contain`, `is empty`, `is not empty`
- `is any of`, `is none of`
- `has any of`, `has all of`, `has none of`, `is exactly`
- Dates: `is before`, `is after`, `is on or before`, `is on or after`, `is within`, with `relativeDate` values `today`, `tomorrow`, `yesterday`, `one week ago`, `number of days ago` …
- User-relative: `is me`, `has me`, `is not me`, `has my mobile`, `has my email`, `has my national ID`, `has my role`
- Special states: `is signed`, `is clicked`, `is payed`, and their negations

**Pseudo-field `"[role]"`** (operand = role ids, with `has any of`, `has all of`, `is exactly` or `has none of`):
- It is the **only** condition that works on pages without a record.
- The owner is always true.
- Non-collaborators (portal suppliers) are false.

**Groups**: `{"filter":{"andor":"and","children":[…]}}`.

---

## 5. TEXT HTML: what is safe and what looks good

### 5.1 Sanitizer
**Since cloud-front 5b1968b5e (2026-10-15) there is one**: inline styles are whitelisted and `background`, gap, flex
alignment, line-height, position, shadows… are dropped silently (platform-lessons «Page HTML sanitiser»). What follows
in §5.1–5.2 about "everything renders" describes older builds; put gradients and patterns in SVG data URIs (SECTION
`backgroundImage`, page `background`, `<img src="data:…">`) as `scripts/visual-kit.ts` does. Old notes: `TextBlock.vue:8` was `v-html="value"`, rendering tags, classes, inline `style`, `<img>`, `<a>`, `<svg>`, `<table>`, and CSS grid / flex.
- `<script>` does not execute, because it is set through innerHTML.
- `on*` attributes **do** execute.
- `<style>` elements apply globally.

The only people who can author pages are the owner and editors, but still:
- **No `<style>`, no `on*`, no iframes.** Use EMBED for iframes.
- The owner's editor is `q-editor`, a contenteditable. If someone types into a complex HTML block there, the browser may restructure it. Regenerate such blocks from source, not by hand.

### 5.2 Styles that actually apply
- **Inline `style`**: everything works. It is not RTL-flipped, so use `text-align:right` for start in fa, or `start`.
- **Tailwind classes**: only the compiled ones (see rule 4). Safe, verified examples:
  - Radius: `tw-rounded-lg/xl/2xl/3xl/full`
  - Shadow: `tw-shadow`, `tw-shadow-sm/md/lg/xl`
  - Padding: `tw-p-{0.5,1,1.5,2,2.5,3,3.5,4,5,6,8,10,12}`
  - Gap: `tw-gap-{0.5..16}`
  - Grid: `tw-grid`, `tw-grid-cols-1..8/10/12`, `sm:/md:/lg:tw-grid-cols-2..4`
  - Text size: `tw-text-{xs..5xl}`
  - Weight: `tw-font-{light..black}`
  - Leading: `tw-leading-{tight,snug,normal,relaxed}`
  - Colours: `tw-bg-{token}` for all tokens, `tw-text-{blue3,blue4,green3,green4,gray3,gray4,…}`, `tw-bg-primary`, `tw-text-base-100`
  - Gradients: `tw-bg-gradient-to-{b,br,l,r,t,tr}` with `tw-from-{blue,blue3,teal,teal3,primary,…}`
- **Quasar classes**: all of Quasar's CSS is loaded, e.g. `row`, `col-*`, `q-pa-md`, `text-h6`, `bg-primary`, `text-white`. `text-h1`…`text-h6` are re-sized by `typography.scss` (§5.3).
- **Inherited defaults inside TEXT**:
  - `p` margin 0 (`.lotion p`, and preflight).
  - `ul` / `ol` markers restored (`.text-block-container`; RTL `ol` uses Persian digits).
  - `a` has colour inherit and no underline (preflight). Style links yourself.

### 5.3 Headings: always set sizes inline
Three sources fight over `h1`–`h6`:
1. Quasar sets h1 to 6 rem and so on.
2. Tailwind preflight, which is loaded later, sets font-size and weight to `inherit` and margin to 0.
3. `src/css/Theme/Typography/typography.scss` is imported by `quasar.variables.scss`, which Quasar injects into **every** `<style lang="scss">`. Any **non-scoped** SCSS block, such as `Utils/Editor.vue`, which TextBlock imports, therefore re-emits global rules **after** preflight:

| Tag | ≥1024 px | <1024 px |
|---|---|---|
| h1 | 48 px / 800 | 40 px |
| h2 | 40 px / 700 | 32 px |
| h3 | 32 px / 700 | 24 px |
| h4 | 24 px / 700 | 20 px |
| h5 | 20 px / 600 | 18 px |
| h6 | 18 px / 600 | 16 px |

All of them get `line-height:normal`, negative letter-spacing and margin 0.

- On a live portal page, an unstyled `<h3>` renders about 32 px bold. The current heroes use that: `vendor-10.jpg`, «پاسخ شما ثبت شد».
- In a harness without that injection, the same `<h3>` rendered 14 px normal.
- So heading size is load-order-dependent. **Always set `font-size`, `font-weight`, `line-height` and `margin` inline**, or use a `<div>` with inline styles.

### 5.4 Images, icons, links
- **Inline icons as `<img>` need `display:inline-block;vertical-align:middle`**: Tailwind preflight sets `img{display:block}`,
  so an icon before a heading otherwise lands on its own line. In an SVG data URI built from Lucide paths, wrap the paths
  in `<g fill="none" stroke="…">`: without `fill="none"` the paths fill black.
- **`<img src>`**: prefer site-relative public assets (`/img/page%20bg/background3.jpg`, the "page bg" set `background1..11.jpg`), or uploaded files by their full URL. Full URLs depend on the environment (§11.16). Always set `width`/`height` or `max-width:100%`.
- **Icons in HTML**:
  - You can't use Vue components.
  - Paste an inline Lucide SVG (24×24, `stroke="currentColor"`, `fill="none"`, `stroke-width="2"`).
  - Emoji works, but it renders differently per OS and looks less formal. Fine for a kindergarten template; for a corporate portal prefer SVG, Phosphor (`<i class="ph ph-<name>">`) or no icon.
- **Internal links**:
  - `href` must be `/b/<baseId>/<sideId>/<pageId>` on the app domain. On a custom domain (`stateStore.directBase`) it is `/<sideId>/<pageId>` (`composables/baseRouter.js getUrl`).
  - Because the prefix differs by host, **use MENU / GALLERYMENU / TitleDivider buttons for navigation**, not `<a>` in TEXT.
  - External links: `target="_blank" rel="noopener"`.

### 5.5 Dark-mode-safe HTML snippets
Surface card, adapts to theme:
```html
<div style="background-color:hsl(var(--b1));color:hsl(var(--bc));border:1px solid hsl(var(--b3));border-radius:16px;padding:20px">
  <div style="font-size:16px;font-weight:700;line-height:1.6;margin:0 0 6px">عنوان کارت</div>
  <div style="font-size:13px;line-height:1.9;color:hsl(var(--nc))">توضیح کوتاه دو خطی.</div>
</div>
```

Tinted info card (tokens):
```html
<div style="background-color:var(--blue);color:var(--blue4);border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.9">…</div>
```

Brand hero (flat fixed colour — gradients, `url()`, shadows and line-height are sanitised away since 2026-10-15; a photo hero is a SECTION, asset-pipeline A5):
```html
<div style="background-color:#124f7d;color:#ffffff;border-radius:20px;padding:36px 32px">
  <div style="font-size:13px;font-weight:600;opacity:.85;margin:0 0 8px;letter-spacing:0">«نام درگاه» · «نام سازمان»</div>
  <div style="font-size:30px;font-weight:800;line-height:1.45;margin:0 0 10px">سلام، به پیشخوان خوش آمدید</div>
  <div style="font-size:15px;line-height:2;max-width:720px;opacity:.92">وضعیت پرونده، معاملات و درخواست‌های شما در یک نگاه.</div>
</div>
```

Card grid: `display:grid`, `grid-template-columns` and `gap` are sanitised away (the cards stack). Use a COLUMNS3 / COLUMNS4 block
(`column1..4 = {label, name, splitter, content:{name, blocks:[TEXT card]}}`, nested `splitter` 33/50 or 25/33/50; columns stack under `md`)
with one card per column:
```html
<div style="background-color:hsl(var(--b1));color:hsl(var(--bc));border:1px solid hsl(var(--b3));border-radius:16px;padding:18px">…</div>
```

---

## 6. View-level display settings (the View document, not the block)

Storage (`cloud-back/src/modules/database/models/View.ts`, and `cloud-back/src/modules/ai-agent/tools/viewSettings.ts serializeViewSettings`, which mirrors the frontend writers):

| Setting | Stored as | Effect |
|---|---|---|
| Visible fields and their order | `fields: [fieldId]` | Order = display order. Empty means Grid shows the first 10 fields plus primary, and other views show the primary only (`resolvers/meta.ts:659`). **Cards, Kanban and featured use this list** |
| Card cover image | `brandField: <attachments field>` | Gallery image carousel, 140 / 200 px. If set but the record has no file, you get a **grey placeholder box** — so when you set a cover (customers expect one on every gallery), guarantee an image on every row: the table's own image field, a lookup of a parent's image (e.g. the linked company logo), or a per-category illustration |
| Gallery look | `layout: "[{…}]"` with `layout[0].type` | See below |
| Sort | `sorts: ["{\"field\":…,\"direction\":\"AZ\"}"]` | |
| Grouping | `groups: ["{\"index\":0,\"field\":…,\"direction\":\"AZ\",\"collapse\":false,\"stats\":[]}"]` | |
| Records filter | `filters: "[filter…]"` | |
| Row / card colour | `conditionalColors: "[{id,enabled,color,conditions}]"`, where `color` ∈ `blue…gray`, `blue2…gray2`, `base-100` | Card background in Gallery, `getRecordCardStyle`. First match wins |
| Search fields | `summaryFields: "id1,id2"` | Filter chips in the filterbar (`inline-filter`). Keep 0–2 on portal lists |
| Free search | `freeSearch: true` | Grid and Gallery |
| Page size | `pageSize` (default 20) | A «نمایش بیشتر» pager follows. Use small (4–6) views for dashboards |
| Kanban | `kanbanSettings: "{kanbanField, doneStates, assigneeField, deadlineField, signatureMove, createForm}"` | |
| Calendar | `layout[0] = {calendarType:"monthly"\|"weekly", timeField, startTimeField, endTimeField, fontBold, weekViewStartTime, weekViewEndTime, dualCalendar}` | |
| Grid row colour | `theme: "{\"color\":\"<token>\",\"colorMap\":{…},\"shadowRows\":true}"` | ViewGridItem |
| Form | `layout[0]` | §9 |

**Gallery `layout[0].type`** (`ViewGallery.vue`):

| type | Look | Use |
|---|---|---|
| `cards` (default) | Cards min 230 px (140 px on mobile), `rounded-2xl`, shadow. Optional image carousel (brandField). Each field after the first gets a tiny grey label, and all values are **justified** and pre-wrapped. A «+ جدید» tile at the end | Short, structured items only |
| `featured` | Clean cards. First field bold, text-lg; the rest text-sm with **no labels** and no justification. Options: `featuredSize` (min width xs 150, sm 200, md 250, lg 320, xl 400), `featuredImageHeight` (enum xs 80, sm 120, md 160, lg 220, xl 300 px; the image is a square beside the text), `featuredImagePos` (`left`/`right`), `featuredTextNearImage`, `featuredBorder` (default true), `featuredShadow`, `featuredShadowColor`, `featuredShadowSize`, `featuredCardGap` (16), `featuredFieldGap` (8), `featuredHero` (first card large) with `heroSize` (`wide`/`square`/`full`), `heroPosition`, `heroFields`, `heroOverlayField` | **Best-looking list type**: deals, contracts, news |
| `news` | Rows: image 144 px next to fields with labels | News and announcements |
| `cardsHorizontal` | Swiper strip of 320 / 360 px cards (82 vw on mobile) | "Latest" rails on home pages |
| `menu` | Small 80 px tiles | Icon-like pickers |
| `compare` | Side-by-side columns | Rarely |
| `search` | Search-first: shows nothing until the user types (`minCharsSearch`) | Lookups |

Featured card sizing (from `ViewGallery.vue getCardMinWidth` / `getImageHeightPx`): card min width xs 150 · sm 200 · md 250 ·
lg 320 · xl 400 px; image square xs 80 · sm 120 · md 160 · lg 220 · xl 300 px, placed beside the text. The text column is
the card width minus the image, so a title or price breaks mid-word unless the pair is one of: **lg + md** (catalogue
cards with photo), **xl + lg** (showcase), **md + sm** (short labels only). At 6xl page width lg gives 3 cards per row,
md 4. Labels in GALLERYMENU and Kanban titles truncate at ~140 px: keep tile labels ≤ 14 characters or accept the ellipsis.

Other gallery `layout[0]` keys:
- `imageFit`: `cover` or `contain`.
- `advancedHeader`: true shows a header bar with search, chips for every option of the view's singleSelect fields, and sort buttons from `customSortFields: [{_key, field, ascTitle, descTitle}]`. This is the nicest built-in filter UI.
- `voteField`.

**Kanban** (`ViewKanban.vue`, `ViewKanbanCard.vue`):
- Column width is fixed at 280 px.
- Header colours come from the kanban field's option colours.
- Cards show the view's fields except the kanban field. The first is bold and **truncated at 140 px**; the others carry labels.
- Deadline and assignee chips come from `kanbanSettings`.
- Use at most 4–5 states per board and a page width of 7xl or full.

**Status chips everywhere**: a singleSelect value renders as `q-chip tw-bg-{colors[index]}`.
- `Field.colors` is a JSON map `{"<optionIndex>":"<token>"}`. It defaults to cycling blue, cyan, teal, green, yellow, orange, red, pink, purple, gray (`cells/the-singleSelect.vue:140`).
- **Set semantic colours on the status fields.** Example: a status `["در حال تکمیل","در انتظار بررسی","تأییدشده","نیازمند اصلاح","ردشده"]` with `{}` shows «تأییدشده» teal and «ردشده» yellow. Recommended: `{"0":"gray","1":"yellow","2":"green","3":"orange","4":"red"}`, the same scheme on every workflow-status field.
- **Never grey out every option.** On the first project, categorical fields (type, bank, province, …) were set to all-`gray`; the customer read that as "options have no colour" and disliked it. Keep a distinct pale token per option on categorical fields (the default cycle is fine, or an explicit map with no repeats), and reserve meaning-bearing colours (green/yellow/red) for status fields.

---

## 7. Side level: header, footer, layout, default page

`Side` (`cloud-back/src/modules/notion/models/Side.ts`):
- `type`: `visitor`, `user` or `collaborator`.
- `layoutType`: `website` or `sidebar`.
- `header` and `footer` are **JSON strings**.
- `pagesOrder: [pageId]`: the first page is the landing page when the URL has no page.
- `default`: this side is the base's landing side.
- `userRole`: for `user` sides.

### 7.1 Website header: `organisms/SideHeader.vue`
```json
{
  "name": "درگاه تأمین‌کنندگان",
  "logo": "<storage key of the logo>",
  "darkLogo": "<optional white logo key>",
  "toEnable": true,
  "headerMode": 1,
  "hoverColor": {"enabled": true, "color": "var(--blue4)"},
  "themeButton": {"show": false},
  "dynamicButton": {"show": false, "action": "page", "text": "ورود به درگاه", "icon": "LogIn", "iconPosition": "left", "color": "blue4", "side": "<sideId>", "path": "<pageId>", "openInNewTab": false, "hideAfterLogin": true},
  "menuItems": [
    {"id": "m1", "title": "پیشخوان", "linktype": "page", "side": "<sideId>", "path": "<pageId>", "link": "", "children": [], "userFilter": []},
    {"id": "m2", "title": "معاملات", "linktype": "", "side": "<sideId>", "link": "", "children": [
      {"id": "m2a", "title": "فرصت‌های باز", "linktype": "page", "side": "<sideId>", "path": "<pageId>", "children": []}]}
  ]
}
```

- **Header**: 48 px, sticky, white (`bg-base-100`), bottom border.
- **Logo**: `S3/cloud-uploads/<logo>`, 24 px high on mobile and 36 px on md+. `toEnable` makes the logo and name link to the side home.
- **Name**: bold, 1.2 rem.
- **Menu**: 14 px grey items (`text-gray4`). Children open a dropdown.
  - `hoverColor` gives a coloured hover and a 3 px underline on the active item.
  - `headerMode:1` inserts a spacer, pushing the menu to the far side. Absent (the "rtl" mode) keeps it next to the logo.
- **Dynamic button**: a coloured CTA on the far side. `color` is a token → `var(--{token})`, or a hex.
- **Right-hand controls**: notifications and the user avatar and name are shown automatically when logged in.
- **Mobile**: a hamburger opens a full-screen menu.
- **Recommendation**:
  - Every side gets the customer logo and a short name.
  - `hoverColor` `var(--blue4)`.
  - On the visitor site, a dynamic button (e.g. «ورود تأمین‌کنندگان») → the logged-in portal, with `hideAfterLogin:true`.
  - `headerMode:1` can squeeze the menu to half the free width and clip items at 1366 px; `headerMode:2` (menu next to the logo) showed all items. Screenshot to decide.
- Logo keys already uploaded in the old base's sides are reusable storage keys.

### 7.2 Sidebar header (when `layoutType:"sidebar"`): `layouts/SidebarLayout.vue`
It uses the same `header` JSON: `name`, `logo`, `menuItems`, `themeButton`.
- Menu items get a Lucide `icon` (default `Home`) and an `iconColor` (a token or CSS colour), shown in a 32 px square.
- The active item is `bg-primary/10 text-primary`.
- The user card and theme toggle sit at the bottom.
- **No footer.**

Consider `sidebar` for internal collaborator sides. It gives an app-like, dense feel. Keep `website` for the external portal and the public site.

### 7.3 Footer (website only): `organisms/SideFooter.vue`
```json
{"details":{"enabled":true,"backgroundColor":"hsl(var(--b2))","bottomBackgroundColor":"","linkHoverColor":"var(--blue4)","gap":24,"verticalGap":24,
 "columns":[
  {"id":"f1","width":40,"widgets":[{"id":"w1","type":"brand","title":"«نام سازمان»","titleSize":16,"description":"«یک جمله درباره‌ی سامانه»","images":["<logo key>"]}]},
  {"id":"f2","width":30,"widgets":[{"id":"w2","type":"menu","title":"دسترسی سریع","items":[{"id":"i1","label":"راهنما","linktype":"page","side":"<sideId>","path":"<pageId>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]}]}]},
  {"id":"f3","width":30,"widgets":[{"id":"w3","type":"socials","title":"ارتباط با ما","items":[]}]}],
 "copyright":"© ۱۴۰۵ «نام سازمان» — کلیه حقوق محفوظ است.","socialText":"","socials":[]}}
```

- The default `backgroundColor` `var(--base-200)` is undefined, which means transparent. Set `hsl(var(--b2))`.
- Column `width` is a %; below md the columns go full width.
- Widget types: `menu`, `brand`, `trust` (a `code` snippet), `socials`.
- Put the footer on the visitor site (and optionally on the external portal). Keep it off on internal workbenches.
- `brand` widget `images` must be objects `{id, src:<key>, width:"150px", widthNum:150, align}`, not bare keys (`FooterBrandWidget.vue`): a bare key renders a broken image. Column widths are % plus a px gap with `flex-shrink:0`, so 40/30/30 wraps; 38/27/27 fits.

---

## 8. Expand templates (record detail design)

### 8.1 Which template renders (`cloud-back/src/modules/database/resolvers/search.js:152-175`)
- If the VIEW block context has `expandTemplate: <id>`, that template is used.
- If it is `"default"` or absent:
  - The template whose `defaultSides` contains the current side is used.
  - Otherwise, on collaborator sides, `table.layout` is used.
  - Otherwise, on user or visitor sides, **`{}`**: an empty layout, and the frontend falls back to a bare RECORD block.
- `"noExpand"` means clicking a card does nothing.

**The rule for portal lists:** always name the template id explicitly. Also make sure `template.sides` contains the side. It is required for views embedded in the template to be "in side" (rule 9).

The template document: `{table, name, sides:[sideId], defaultSides:[sideId], layout:"<page JSON>"}`.

### 8.2 Where it appears
- **Dialog** (`organisms/views/ViewSide.vue`):
  - Nearly full screen, `max-width:1600px`, `rounded-xl`.
  - A sticky top bar has the close and navigation controls.
  - **Set template `maxw` to `tw-max-w-5xl` or `tw-max-w-4xl`** so the content stays readable in a wide dialog.
- **Drawer**: resizable, on the right side.
- **Inline**: via ExpandRecord (the profile pages).

Title and cover behaviour:
- The title is the `titleField` value (`showTitle !== false`) at 1.5 rem, **editable inline** if the viewer may edit that field.
- A 112 px round avatar appears when `table.logoField` is set. It is empty in this base.
- The cover comes from `table.cover` (§3).

### 8.3 Template layout pattern that looks professional
1. **Header card**: a SECTION with `color:"base-100"`, border, radius 16, padding 20.
   - Inside: COLUMNS2 at 66.67 / 33.33.
   - The right-hand column holds a RECORD `invisible` + `none` with 1–2 key fields: reference number and title.
   - The left-hand column holds a RECORD `invisible` + `none` with the status field (a coloured chip) and the date.
2. **Workflow**: a PROGRESS block `horizontal` on the status field, or a TEXT "steps" strip.
3. **Action bar**: a SECTION shown only when the status allows it (a `filter` on status). It holds BUTTON(s), or an ALERT saying what the supplier must do next («نیازمند اصلاح: …»).
4. **TABS**:
   - «مشخصات»: COLUMNS2 of RECORD `visibleTop` + `bg` with `immutable` for read-only fields.
   - «اقلام» / «پیوست‌ها» / «سوابق»: VIEWs with `filterType:"in"` and `filterInField:<link field>`, plus `displayListName:false`, `viewToolbar:"invisible"`, `newable:"denied"`.
5. Keep **one** visual level. Don't nest coloured SECTIONs inside coloured SECTIONs; the existing templates here have 5–8 stacked SECTIONs.

---

## 9. Forms

### 9.1 Version 1 (all 23 forms in this base): `views/ViewFormBody.vue`, `ViewFormButton.vue`
```json
[{"title":"ثبت درخواست تحویل","description":"قرارداد را انتخاب و اقلام را وارد کنید.","logo":"",
  "inputs":[{"id":"<fieldId>","name":"قرارداد","description":"از فهرست قراردادهای خود انتخاب کنید","required":true,"invisible":false,"conditions":[],
             "recordsSelect":true,"recordsCreate":false,"recordsMultiple":false,"recordsForm":"","recordsContext":false}],
  "button":{"text":"ثبت و ارسال","color":"blue"},
  "doneMessage":"درخواست ثبت شد.","redirect":false,"redirectURL":"","delayedRedirect":false,"redirectDelay":3,
  "submitAnotherBtn":false,"showNewBlank":false,
  "expandAfterSubmit":false,"expandAfterSubmitMode":"dialog","expandAfterSubmitTemplate":"",
  "splitBy":"","splitFields":[],"defaultValues":{}}]
```

- **Render**:
  - The form is `max-w-xl`, centred. In a page, `app` gives 600 px.
  - A **bordered title card** holds the optional logo (50 px), `title` (text-lg) and `description` (text-xs).
  - Each input has a 0.9 rem label, a red `*` when required, a muted text-xs `description`, and a bordered, shadowed value box at least 40 px high.
  - The submit button is `tw-bg-{color}4`, hover `{color}3`.
- **Inputs**:
  - Only `inputs` whose field is in the form's field list and which are not `invisible` render.
  - `conditions` are live filters on the record being entered, which is how you do conditional inputs. `invisible:true` hides the input but keeps any default value.
  - Order is the order of `inputs`.
- **After submit**: `doneMessage` shows in a bordered box with a green info icon. `redirect` goes to `redirectURL`. `expandAfterSubmit` opens the new record.
- **Defaults**:
  - Per page block: VIEW context `defaultValues: {fieldId: value}` (`ViewForm.vue useForm(... pageContext.defaultValues)`).
  - Link auto-fill in a record context: VIEW context `autoLinkField`.
- **Making forms short and clean**:
  - At most 6–8 visible inputs; move the rest to later edits in the record template.
  - Write a description only where the answer isn't obvious.
  - Hide technical fields (`invisible`), and set them through `defaultValues` or automations.
  - When the page already has a TitleDivider or hero naming the form, leave `title` `""`: the bordered title card is then skipped only if `title`, `description` and `logo` are all empty.
  - Put the form in a SECTION: `color:"base-100"`, border, radius 16, padding 24, `maxWidth:"3xl"`, `justifySelf:"center"`. Or use COLUMNS2 with the form on the right and a help ALERT or steps TEXT on the left.
  - Use one button label that describes the result («ثبت درخواست»), not «ارسال».

### 9.2 Version 2 (step / page forms): `views/ViewFormNotion.vue`, `ViewFormNotionPage.vue`
- **Shape**: `layout[0] = {version:2, pages:[{id, name, notion:{name, blocks:[…RECORD blocks with the input fields, TEXT, ALERT, SECTION…]}, required:{fieldId:{condition:[…]}}, buttonLabel, buttonColor:<contentColor token e.g. "blue4">}], thankYouPage:{type:"thank-you", notion:{…}}, redirect, redirectURL, submitAnotherBtn, showNewBlank, defaultValues}`.
- Each page is a block page. Inputs are RECORD blocks, so fieldsTheme, valuesTheme and COLUMNS work, and forms can be designed like pages.
- Required fields are `pages[i].required`, with a condition.
- Buttons: `tw-bg-{buttonColor || primary}`. **Always set `buttonLabel`** (rule 21).
- The «بازگشت» (back) button appears on pages after the first.
- Converting v1 to v2 is a structural change. Do it only if the plan calls for multi-step forms.

---

## 10. Patterns that look good (copy these recipes)

Placeholders: `<…>`. Read side and page ids with `L.listSides()` / `L.listPages(side)`.

### 10.1 Portal home: hero, KPI strip, quick actions, two lists (collaborator dashboard)
```json
{"name":"","maxw":"tw-max-w-6xl","align":{"value":"center","label":"وسط"},"background":{"type":"color","value":"hsl(var(--b2))"},"blocks":[
 {"id":"h","type":"TEXT","details":{"value":"<div style=\"background-color:#124f7d;color:#fff;border-radius:20px;padding:32px 28px;margin:8px 0 12px\"><div style=\"font-size:13px;font-weight:600;opacity:.85;margin:0 0 6px\">میز کار زنجیره تأمین</div><div style=\"font-size:28px;font-weight:800;line-height:1.45;margin:0 0 8px\">پیشخوان</div><div style=\"font-size:14px;line-height:2;opacity:.92;max-width:680px\">روی هر عدد بزنید تا فهرست همان موارد باز شود.</div></div>"}},
 {"id":"k","type":"STATS","details":{"value":[
   {"id":"k1","label":"در انتظار احراز هویت","type":"dynamic","table":"<suppliers>","field":"<primary>","aggregate":"count","icon":"UserCheck","color":"var(--yellow)","drilldownView":"<view>","filter":[{"index":0,"filter":{"andor":"and","field":"<status>","operator":"is","operand":"در انتظار بررسی","relativeDate":null,"relativeTime":null}}]},
   {"id":"k2","label":"معاملات در فروش اسناد","type":"dynamic","table":"<deals>","field":"<primary>","aggregate":"count","icon":"Gavel","color":"var(--blue)","filter":[]},
   {"id":"k3","label":"درخواست‌های بی‌پاسخ","type":"dynamic","table":"<requests>","field":"<primary>","aggregate":"count","icon":"Inbox","color":"var(--red)","filter":[]},
   {"id":"k4","label":"قراردادهای فعال","type":"dynamic","table":"<contracts>","field":"<primary>","aggregate":"count","icon":"FileSignature","color":"var(--green)","filter":[]}]}},
 {"id":"td1","type":"TitleDivider","details":{"title":"دسترسی سریع","showIndicator":true,"indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":false}},
 {"id":"qa","type":"MENU","details":{"value":[
   {"id":"q1","label":"کارتابل درخواست‌ها","subtitle":"بررسی و پاسخ به درخواست‌ها","theme":"type3","cardMediaType":"icon","lucidIcon":"Inbox","bgColor":"hsl(var(--b1))","iconBgColor":"var(--blue)","textColor":"var(--blue4)","linktype":"page","side":"<sideId>","path":"<pageId>","filter":[],"value":""},
   {"id":"q2","label":"تأمین‌کنندگان","subtitle":"احراز هویت و پرونده‌ها","theme":"type3","cardMediaType":"icon","lucidIcon":"Building2","bgColor":"hsl(var(--b1))","iconBgColor":"var(--teal)","textColor":"var(--teal4)","linktype":"page","side":"<sideId>","path":"<pageId>","filter":[],"value":""},
   {"id":"q3","label":"معاملات","subtitle":"فراخوان، ارزیابی و نتایج","theme":"type3","cardMediaType":"icon","lucidIcon":"Gavel","bgColor":"hsl(var(--b1))","iconBgColor":"var(--purple)","textColor":"var(--purple4)","linktype":"page","side":"<sideId>","path":"<pageId>","filter":[],"value":""}]}},
 {"id":"c","type":"COLUMNS2","details":{"value":""},
  "column1":{"label":"1","name":"c-a","splitter":50,"content":{"name":"1","blocks":[
    {"id":"td2","type":"TitleDivider","details":{"title":"تأمین‌کنندگان در انتظار","showIndicator":true,"indicatorColor":"var(--yellow3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":false}},
    {"id":"v1","type":"VIEW","details":{"value":{"value":"<galleryFeaturedView pageSize 5>","expandTemplate":"<tpl>","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"invisible","newable":"denied"}}}]}},
  "column2":{"label":"2","name":"c-b","content":{"name":"2","blocks":[
    {"id":"td3","type":"TitleDivider","details":{"title":"مهلت‌های نزدیک","showIndicator":true,"indicatorColor":"var(--red3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":false}},
    {"id":"v2","type":"VIEW","details":{"value":{"value":"<featured list sorted by deadline>","expandTemplate":"<tpl>","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"invisible","newable":"denied"}}}]}}}
]}
```

Notes:
- Put Kanban and Calendar **below** the columns, full width, never inside a column.
- For the supplier portal home, the same shape lives **inside the «پیشخوان تأمین‌کننده» expand template**, reached through an ExpandRecord page. KPI tiles there can be STATS (shared), or RECORD blocks over rollup/count fields of the supplier record. The second option is user-scoped and needs no server-side stats.

### 10.2 List page with a filter header
```json
{"name":"","maxw":"tw-max-w-6xl","blocks":[
 {"id":"h","type":"TEXT","details":{"value":"<div style=\"padding:18px 4px 6px\"><div style=\"font-size:24px;font-weight:800;line-height:1.5;margin:0\">قراردادهای من</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc));margin:4px 0 0\">برای دیدن بندها، سفارش‌ها و مبادلات روی هر قرارداد بزنید.</div></div>"}},
 {"id":"tb","type":"TABS","tabsBgColor":"base-100","details":[
   {"label":"فعال","name":"t1","color":"base-100","bold":true,"content":{"name":"فعال","blocks":[{"id":"v1","type":"VIEW","details":{"value":{"value":"<activeContractsFeatured>","expandTemplate":"<contractTpl>","expandMode":"dialog","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"visible","newable":"denied"}}}]}},
   {"label":"خاتمه‌یافته","name":"t2","color":"base-100","bold":false,"content":{"name":"خاتمه‌یافته","blocks":[{"id":"v2","type":"VIEW","details":{"value":{"value":"<closedContracts>","expandTemplate":"<contractTpl>","displayListName":false,"viewToolbar":"invisible","newable":"denied"}}}]}}]}
]}
```

The alternative to tabs is a single Gallery view with `layout[0].advancedHeader:true`. It gives status chips for every singleSelect option, plus `customSortFields` («جدیدترین / قدیمی‌ترین»).

### 10.3 Detail / expand template: header, workflow, tabs
```json
{"name":"","cover":"","maxw":"tw-max-w-5xl","showTitle":false,"blocks":[
 {"id":"hd","type":"SECTION","details":{"value":""},"filter":[],"color":"base-100","padding":"20","radius":"16","borderLine":true,"borderWeight":1,"borderColor":"gray","section":{"label":"section","name":"hd-s","content":{"name":"section","blocks":[
   {"id":"hc","type":"COLUMNS2","details":{"value":""},
    "column1":{"label":"1","name":"hc1","splitter":66.67,"content":{"name":"1","blocks":[
      {"id":"hr1","type":"RECORD","details":{"value":["<titleField>","<refNoField>"],"fieldsTheme":"invisible","valuesTheme":"none","showFieldIcons":false,"immutable":{"<titleField>":[],"<refNoField>":[]}}}]}},
    "column2":{"label":"2","name":"hc2","content":{"name":"2","blocks":[
      {"id":"hr2","type":"RECORD","details":{"value":["<statusField>","<dateField>"],"fieldsTheme":"visibleTop","valuesTheme":"none","showFieldIcons":false,"immutable":{"<statusField>":[],"<dateField>":[]}}}]}}}]}}},
 {"id":"pg","type":"PROGRESS","details":{"stateField":"<statusField>","direction":"horizontal","states":[
   {"label":"پیش‌نویس","name":"p1","content":{"name":"پیش‌نویس","blocks":[{"id":"p1t","type":"TEXT","details":{"value":"<p style=\"margin:0;font-size:13px;color:hsl(var(--nc))\">درخواست هنوز ارسال نشده است.</p>"}}]}},
   {"label":"در انتظار بررسی","name":"p2","content":{"name":"در انتظار بررسی","blocks":[{"id":"p2t","type":"TEXT","details":{"value":"<p style=\"margin:0;font-size:13px;color:hsl(var(--nc))\">کارشناس در حال بررسی است.</p>"}}]}}]}},
 {"id":"ac","type":"SECTION","details":{"value":""},"color":"yellow","padding":"14","radius":"12",
  "filter":[{"index":0,"filter":{"andor":"and","field":"<statusField>","operator":"is","operand":"نیازمند اصلاح","relativeDate":null,"relativeTime":null}}],
  "section":{"label":"section","name":"ac-s","content":{"name":"section","blocks":[
   {"id":"act","type":"TEXT","details":{"value":"<div style=\"font-size:14px;font-weight:700;margin:0 0 4px\">نیازمند اصلاح</div><div style=\"font-size:13px;line-height:1.9\">موارد خواسته‌شده را اصلاح و دوباره ارسال کنید.</div>"}},
   {"id":"acb","type":"BUTTON","details":{"text":"ارسال مجدد","color":"blue","actions":[{"type":"change-field-value","config":{"editingField":{"value":"<statusField>","label":"وضعیت","type":"singleSelect","possibleValues":["…"]},"record":{"<statusField>":"در انتظار بررسی"}}}]}}]}}},
 {"id":"tb","type":"TABS","tabsBgColor":"base-100","details":[
   {"label":"مشخصات","name":"d1","color":"base-100","bold":true,"content":{"name":"مشخصات","blocks":[
     {"id":"dc","type":"COLUMNS2","details":{"value":""},
      "column1":{"label":"1","name":"dc1","splitter":50,"content":{"name":"1","blocks":[{"id":"r1","type":"RECORD","details":{"value":["<f1>","<f2>","<f3>"],"fieldsTheme":"visibleTop","valuesTheme":"bg","showFieldIcons":false}}]}},
      "column2":{"label":"2","name":"dc2","content":{"name":"2","blocks":[{"id":"r2","type":"RECORD","details":{"value":["<f4>","<f5>","<f6>"],"fieldsTheme":"visibleTop","valuesTheme":"bg","showFieldIcons":false}}]}}}]}},
   {"label":"اقلام","name":"d2","color":"base-100","bold":false,"content":{"name":"اقلام","blocks":[
     {"id":"iv","type":"VIEW","details":{"value":{"value":"<itemsGrid>","expandTemplate":"noExpand","filterType":"in","filterInField":"<itemsLinkToParent>","displayListName":false,"viewToolbar":"invisible","newable":"denied"}}}]}}]}
]}
```

### 10.4 Form page (clean, centred, with guidance)
```json
{"name":"","maxw":"tw-max-w-5xl","blocks":[
 {"id":"h","type":"TEXT","details":{"value":"<div style=\"padding:18px 4px 8px\"><div style=\"font-size:24px;font-weight:800;line-height:1.5;margin:0\">ثبت درخواست تحویل کالا</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc));margin:4px 0 0\">سه قدم: قرارداد را انتخاب کنید، اقلام را وارد کنید، ارسال کنید.</div></div>"}},
 {"id":"c","type":"COLUMNS2","details":{"value":""},
  "column1":{"label":"1","name":"c1","splitter":62,"content":{"name":"1","blocks":[
    {"id":"s","type":"SECTION","details":{"value":""},"filter":[],"color":"base-100","padding":"24","radius":"16","borderLine":true,"borderWeight":1,"borderColor":"gray","section":{"label":"section","name":"s1","content":{"name":"section","blocks":[
      {"id":"f","type":"VIEW","details":{"value":{"value":"<formViewId>","expandTemplate":"default","defaultValues":{}}}}]}}}]}},
  "column2":{"label":"2","name":"c2","content":{"name":"2","blocks":[
    {"id":"a","type":"ALERT","details":{"value":"<b>پیش از ارسال</b>","subtitle":"اقلام باید با بندهای قرارداد هم‌خوان باشند. پس از ثبت، درخواست را از «پیگیری درخواست‌ها» دنبال کنید.","color":"blue"}},
    {"id":"fb","type":"FileBlock","details":{"listTitle":"فرم‌های نمونه","files":[]}}]}}},
 {"id":"td","type":"TitleDivider","details":{"title":"درخواست‌های اخیر من","showIndicator":true,"indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":false}},
 {"id":"v","type":"VIEW","details":{"value":{"value":"<myRequestsFeatured>","expandTemplate":"<reqTpl>","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"invisible","newable":"denied"}}}
]}
```

In the form view's layout, set `title:""`, `description:""` and `logo:""`, because the page header already names the form. Set `button:{text:"ثبت درخواست",color:"blue"}`.

### 10.5 Empty-state treatment
There is no count-based conditional in pages, and Gallery `cards`/`featured` render **nothing** when a list is empty. Use these instead:
- **Always** give a one-line explanation (TitleDivider plus a muted TEXT line) above a list, so an empty list still reads as intentional.
- In a **record context** (the supplier dashboard or profile template), show an empty-state card with a SECTION whose `filter` checks a count or rollup field of the supplier record (`operator:"is empty"`, or `is` `0`). Show the list SECTION with the opposite condition.
  ```json
  {"id":"es","type":"SECTION","details":{"value":""},"color":"base-100","padding":"28","radius":"16","borderLine":true,"borderColor":"gray","justify":"center",
   "filter":[{"index":0,"filter":{"andor":"and","field":"<countOfOpenDeals>","operator":"is empty","relativeDate":null,"relativeTime":null}}],
   "section":{"label":"section","name":"es-s","content":{"name":"section","blocks":[
    {"id":"est","type":"TEXT","details":{"value":"<div style=\"text-align:center;padding:8px\"><div style=\"font-size:16px;font-weight:700;margin:0 0 6px\">فعلاً معامله‌ی بازی ندارید</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc))\">فرصت‌های جدید را از «فرصت‌های باز» ببینید.</div></div>"}}]}}}
  ```
- Where creation is allowed (`newable` access with `newForm`), the gallery's own «+ جدید» tile acts as the empty-state call to action.
- Grid shows «رکوردی یافت نشد», Calendar shows «رکوردی نیست», and ExpandRecord shows `view.no_records_found`.

### 10.6 Public landing (visitor side)
```json
{"name":"","maxw":"tw-max-w-6xl","cover":"","blocks":[
 {"id":"hero","type":"TEXT","details":{"value":"<div style=\"background-color:#124f7d;color:#fff;border-radius:24px;padding:48px 36px;margin:12px 0\"><div style=\"display:flex;align-items:center;gap:12px;margin:0 0 18px\"><img src=\"<site-relative logo path>\" alt=\"\" style=\"height:40px;width:auto;background-color:#fff;border-radius:10px;padding:4px\"><span style=\"font-size:14px;font-weight:600;opacity:.9\">«نام سازمان»</span></div><div style=\"font-size:34px;font-weight:800;line-height:1.4;margin:0 0 12px\">سامانه ارتباط با تأمین‌کنندگان</div><div style=\"font-size:16px;line-height:2;max-width:640px;opacity:.92\">ثبت‌نام، شرکت در معاملات، قراردادها و درخواست‌ها — یکجا و آنلاین.</div></div>"}},
 {"id":"cta","type":"GALLERYMENU","details":{"displayMode":"icon","cardSize":"lg","fit":true,"value":[
   {"id":"g1","label":"ثبت‌نام تأمین‌کننده","lucidIcon":"UserPlus","iconBgColor":"var(--blue)","iconColor":"var(--blue4)","color":"hsl(var(--b1))","borderEnabled":true,"borderWidth":1,"borderColor":"var(--gray)","shadowEnabled":true,"shadowIntensity":16,"align":"center","linktype":"page","side":"<sideId>","path":"<registrationPage>","filter":[],"value":""},
   {"id":"g2","label":"فرصت‌های معاملاتی","lucidIcon":"Gavel","iconBgColor":"var(--teal)","iconColor":"var(--teal4)","color":"hsl(var(--b1))","borderEnabled":true,"borderWidth":1,"borderColor":"var(--gray)","shadowEnabled":true,"shadowIntensity":16,"align":"center","linktype":"page","side":"<sideId>","path":"<oppsPage>","filter":[],"value":""},
   {"id":"g3","label":"راهنما","lucidIcon":"LifeBuoy","iconBgColor":"var(--yellow)","iconColor":"var(--yellow4)","color":"hsl(var(--b1))","borderEnabled":true,"borderWidth":1,"borderColor":"var(--gray)","shadowEnabled":true,"shadowIntensity":16,"align":"center","linktype":"page","side":"<sideId>","path":"<helpPage>","filter":[],"value":""}]}},
 {"id":"feat","type":"TEXT","details":{"value":"<div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0\"><div style=\"background-color:hsl(var(--b1));color:hsl(var(--bc));border:1px solid hsl(var(--b3));border-radius:16px;padding:20px\"><div style=\"font-size:16px;font-weight:700;margin:0 0 6px\">شفافیت معاملات</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc))\">فراخوان‌ها، مهلت‌ها و نتایج در دسترس همه.</div></div><div style=\"background-color:hsl(var(--b1));color:hsl(var(--bc));border:1px solid hsl(var(--b3));border-radius:16px;padding:20px\"><div style=\"font-size:16px;font-weight:700;margin:0 0 6px\">پرونده‌ی یکپارچه</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc))\">اطلاعات شرکت، گواهی‌ها و سوابق در یک پرونده.</div></div><div style=\"background-color:hsl(var(--b1));color:hsl(var(--bc));border:1px solid hsl(var(--b3));border-radius:16px;padding:20px\"><div style=\"font-size:16px;font-weight:700;margin:0 0 6px\">پیگیری آنلاین</div><div style=\"font-size:13px;line-height:1.9;color:hsl(var(--nc))\">وضعیت درخواست‌ها و پرداخت‌ها را لحظه‌ای ببینید.</div></div></div>"}},
 {"id":"tdn","type":"TitleDivider","details":{"title":"آخرین اخبار","showIndicator":true,"indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"","showButton":true,"buttonText":"همه‌ی اخبار","buttonColor":"var(--blue)","buttonTextColor":"var(--blue4)","linktype":"page","side":"<sideId>","path":"<newsPage>","openInNewTab":false}},
 {"id":"news","type":"VIEW","details":{"value":{"value":"<newsGallery layout type cardsHorizontal, brandField=image>","expandTemplate":"<newsTpl>","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"invisible","newable":"denied"}}}
]}
```

Add a footer (§7.3) and a header dynamic button «ورود تأمین‌کنندگان».

### 10.7 Internal workbench / queue page (collaborator)
A TEXT header strip, then a STATS strip with `drilldownView`, then TABS of Grid views:
- `viewToolbar:"visible"` with `showSettings:false` and `showGroup:false`
- `downloadList:true`
- `displayListName:false`
- `newable` per role

Then a full-width Kanban (page `maxw:"tw-max-w-full"`, with the other content in SECTIONs at `maxWidth:"6xl"` and `justifySelf:"center"`).

### 10.8 Help / FAQ page
A TEXT header, then TABS by topic. Each tab holds ExpandItem blocks (a question as `title`, a TEXT answer inside). Add a FileBlock of downloadable guides and a final ALERT with contact information.

---

## 11. Known rendering bugs and limitations (with cause)

| # | Symptom | Cause (file) | Workaround |
|---|---|---|---|
| 1 | Justified, gappy card text; tiny grey labels on every field | Gallery `cards` uses `tw-text-justify` and pre-wrap (`views/ViewGallery.vue:783,1518`) | Use `featured`, `news` or `cardsHorizontal`; show at most 3–4 short fields |
| 2 | Clipped Kanban, only 2 columns visible | COLUMNS2 column 1 `overflow-hidden` (`Columns2Block.vue:10`); fixed 280 px columns (`ViewKanban.vue:825`); max-height `100dvh-200px` (`:96`) | Full-width only, outside COLUMNS and SECTION `maxWidth`; ≤5 states |
| 3 | Empty list on a normal page | `filterType:"in"` mask uses `record.id` = undefined (`ViewApp.vue` mask) | Use `filterInField` only in templates or ExpandRecord |
| 4 | Skeleton or empty box for portal users | View not "in side" (`cloud-back/.../View.ts isInSide`): not on a published page of the side, and not in a template whose `sides` includes the side | Add the side to `template.sides`; keep the page published |
| 5 | Grey box with an image icon on cards | `brandField` set but the record has no file (`ViewGallery.vue:~740`) | The customer wants covers on every gallery: guarantee an image on every row (seed, backfill, or a lookup of the parent's logo); `thumbnails` must be an object |
| 6 | «مشاهده همه» button that does nothing; truncated heading | TitleDivider `initDefaults` sets `showButton=true`; title max 140/200/360 px (`TitleDividerBlock.vue:19,504`) | `showButton:false`; titles ≤ 25 characters |
| 7 | MENU subtitles invisible; labels cut | type1 renders only `label` at 72 px (`MenuBlock.vue`) | Use `type3` |
| 8 | GALLERYMENU icons float without a tile | Fallback `tw-bg-blue-50` not compiled (`GalleryMenuBlock.vue:48,69`) | Always set `iconBgColor` |
| 9 | Heading sizes differ between pages or loads | `typography.scss` injected by non-scoped SCSS blocks vs preflight (§5.3) | Inline sizes on every heading |
| 10 | Class has no effect | Tailwind JIT only has literal classes from `src`; default shade scales overridden (`tailwind.config.js`) | Inline style, or check `tw-classes.txt` |
| 11 | Unreadable text in dark mode | Hex backgrounds without a text colour; theme shared with the app | Tokens, or explicit fg/bg pairs; keep `themeButton` off |
| 12 | Broken ALERT markup | `improve()` string replace (`AlertBlock.vue:104`) | Plain text plus `<b>`/`<br>` |
| 13 | Form v2 says «ارسال» on page 1 and «بعدی» on the last page | Inverted ternary (`ViewFormNotionPage.vue:120`) | Set `buttonLabel` on every page |
| 14 | Empty records created by «جدید» | `createOrDialog` → `create({}, true)` without `newForm` (`ViewGallery.vue:2719`) | `newForm` + `newFormPage`, or `newable:"denied"` |
| 15 | Broken image in IMAGE, MENU, GALLERYMENU, STATS or header logo | Components prepend `S3/cloud-uploads/` | Use uploaded keys only |
| 16 | Hero or background image missing on another server | SECTION `backgroundImage` stores a full `https://<s3-host>/cloud-uploads/...` URL (`SectionBlock.vue` upload watcher) | Re-point per environment, or use site `/img/...` assets (TEXT gradients and `url()` are sanitised away) |
| 17 | Footer transparent or absent | Default bg `var(--base-200)` undefined; SidebarLayout has no footer (`SideFooter.vue:843`, `SidebarLayout.vue`) | Set `hsl(var(--b2))`; footer on website sides only |
| 18 | Section condition ignored on a normal page | `filter()` returns true when there is no `record.table`, except `[role]` (`utils/filter.js:84`) | Record-conditional content only in templates |
| 19 | KPI on the supplier portal shows global counts; drill-down does nothing | `useStats` sends `type:"shared"`; `sharedStats` does no ACL; drilldown is collaborator-only (`StatsBlock.vue expandView`) | Filter STATS by user-relative operators, or use rollups on the supplier record |
| 20 | Empty 24 px strip or duplicate title at the top | `content.name` rendered as the page title (`NotionViewer.vue`) | `name:""` when a hero exists |
| 21 | Blocks glued together | Container `gap-1` (4 px) | Explicit spacing |
| 22 | Template cover not shown | Record cover = `table.cover` (`NotionViewer.vue coverSettings`) | Use a header SECTION or TEXT |
| 23 | Wrong column widths | Nested splitter semantics (`Columns3/4Block.vue` defaults 33.33/50, 25/33.33/50) | §4.7 math |
| 24 | Extra padding in tabs | `q-tab-panel` 16 px | Account for it; don't add more SECTION padding inside tabs |
| 25 | Viewer edits a field by accident on a detail view | RECORD values editable when permitted (`RecordBlock.vue data-cell :readonly="immutables…"`) | `immutable:{fieldId:[]}` |
| 26 | Field never appears | `hidden:{fieldId:[]}` means always hidden (`RecordBlock.vue blockFields`) | Remove the key, or give it a condition |
| 27 | Page settings ignored | First block ExpandRecord → `root=false` (`AppPage.vue`) | Design inside the template |
| 28 | Card title cut | Kanban first field `max-w-[140px]` (`ViewKanbanCard.vue`) | Short first field |
| 29 | CTA looks dated; empty button | Fixed 270 px contain image; missing title class; unconditional button (`CTABlock.vue`) | Use a TEXT hero plus GALLERYMENU |
| 30 | Saturated STATS tiles with low contrast | Inline `color` fills under a grey gradient; label and icon are grey (`StatsBlock.vue`) | Pale tokens only |
| 31 | Status colours meaningless (approved teal, rejected yellow) | `Field.colors` `{}` → cyclic defaults (`cells/the-singleSelect.vue:140`) | Semantic `colors` map per status field |
| 32 | View name shown above every list for collaborators | `displayListName` defaults to true (`ViewSettingMenu.vue`) | `displayListName:false` |
| 33 | `justify` text in SECTION | `justify:"justify"` → `tw-text-justify` | Never use it |
| 34 | A short list leaves empty columns; an empty list leaves a hole | Gallery grids are `repeat(auto-fill, minmax(size,1fr))`, so 1–2 cards never stretch; every type but `search` renders nothing when empty (`ViewGallery.vue:580, 1340, 1859`) | `featuredSize:"xl"`, `news`, or a Grid for short lists; an explanatory TEXT above the list; GALLERYMENU `fit:true` stretches |
| 35 | Gallery card fields ignore the settings you wrote | `view.galleryFields` is never read; cards show the view's visible `fields[]` | Set `fields[].visible` |

---

## 12. Pre-publish checklist (per page or template)

- [ ] `npx tsx build/page-lint.ts` exits 0: every list with «جدید» has a form, no Form block beside a list, no URL
      links into the base, every page has a background, every side a name/logo/coloured menu, nothing the editor
      autosaves on open (rules 12, 26, 31, 32).
- [ ] `background` set (rule 26); no large empty area on the first screen, nothing crowded (rule 27).
- [ ] Every view type, gallery type and block chosen for its use case (rule 29); galleries have covers (rule 30).
- [ ] Every list on the page has mock rows that pass its filter for each demo account (demo-data.md «Seed per placed view»).
- [ ] `maxw` chosen:
  - forms 4xl / 5xl
  - dashboards and lists 6xl
  - boards `full`, with centred SECTIONs
  - templates 4xl / 5xl
- [ ] `content.name` is `""` when a hero exists; no emoji `icon`.
- [ ] Every VIEW:
  - [ ] has a heading above it
  - [ ] has `displayListName:false`
  - [ ] has `viewToolbar` set
  - [ ] has `newable` set, and `newForm` + `newFormPage` whenever it is not `"denied"` (rule 12)
  - [ ] names an explicit `expandTemplate` id
- [ ] Every template used on a user or visitor side has that side in `sides`; the page `status` is not draft.
- [ ] No `filterType` on non-record pages; no BUTTON, RECORD or PROGRESS outside templates.
- [ ] TitleDividers have `showButton:false` or a real link; titles ≤ 25 characters.
- [ ] TEXT HTML:
  - [ ] inline font-size, weight, line-height and margin
  - [ ] tokens, or fg+bg pairs
  - [ ] no `<style>`, `on*` or `<script>`
  - [ ] no hard-coded internal `href`
- [ ] Images are uploaded keys where required; no environment-bound URLs in new content.
- [ ] Kanban, Calendar and wide Grids are full width, outside COLUMNS.
- [ ] Gallery type is `featured`, `news` or `cardsHorizontal` for text-heavy items; `cards` only with short fields.
- [ ] Status fields have semantic `Field.colors`.
- [ ] RECORD blocks on read-only portal views have `immutable` and `showFieldIcons:false`.
- [ ] Form v1: short `inputs` list, `title` empty when the page names it, button text set. Form v2: `buttonLabel` on every page.
- [ ] Mobile check: COLUMNS stack below `$q.screen.md` (1024 px by default, 768 px once `SideHeader` has reset the breakpoints in the website layout); heroes use `auto-fit minmax()` grids; no fixed widths > 360 px in HTML.

---

## Appendix A: Icon vocabularies

- **Lucide** (`lucide-vue-next` 0.554, `atoms/LucidIcon.vue`): used by MENU `lucidIcon`, GALLERYMENU `lucidIcon`, STATS `icon`, sidebar menu `icon`, and the header dynamic button `icon`. Use exact PascalCase export names. The full list (1,748 names) is in `cloud-back/src/modules/ai-agent/pageBuilder/lucideIconNames.ts`.
  - Verified names (procurement/portal vocabulary): `House` / `Home`, `LayoutDashboard`, `FileSignature`, `FileText`, `FileCheck`, `FileCheck2`, `FileSpreadsheet`, `ScrollText`, `Stamp`, `Truck`, `PackageCheck`, `Package`, `Boxes`, `Handshake`, `Gavel`, `Scale`, `ClipboardCheck`, `ListChecks`, `Receipt`, `Wallet`, `Banknote`, `HandCoins`, `Landmark`, `BadgeCheck`, `ShieldCheck`, `Award`, `Star`, `Building2`, `Building`, `Factory`, `BriefcaseBusiness`, `Users`, `UserRound`, `IdCard`, `Inbox`, `Send`, `MessageSquare`, `Mail`, `Phone`, `MapPin`, `Bell`, `Megaphone`, `Newspaper`, `LifeBuoy`, `CircleHelp`, `Info`, `CircleCheck`, `CircleAlert`, `TriangleAlert`, `Clock`, `CalendarClock`, `ChartColumn`, `Search`, `Download`, `Upload`, `Paperclip`, `Tags`, `Network`, `Workflow`, `Settings`.
- **HeroIcons v1 outline** (legacy, `atoms/icons/*.js`, names end in `Icon`): the MENU `icon` fallback, and STATS/`AppIcon` whenever a name ends in `Icon`. Examples: `DocumentTextIcon`, `TruckIcon`, `ClipboardCheckIcon`, `CashIcon`, `OfficeBuildingIcon`, `ChatAltIcon`, `ScaleIcon`, `BadgeCheckIcon`, `ShieldCheckIcon`, `InboxIcon`, `SupportIcon`, `SpeakerphoneIcon`, `NewspaperIcon`, `CreditCardIcon`, `ReceiptTaxIcon`, `UserGroupIcon`, `IdentificationIcon`, `ChartBarIcon`, `CalendarIcon`, `ClockIcon`, `ViewGridIcon`. Prefer Lucide for new work.
- **Phosphor `ph:*`**: used internally by `q-icon`, not configurable in blocks.

## Appendix B: Where each thing is stored

| Thing | Collection.field | Format |
|---|---|---|
| Page blocks | `pages.content` | JSON string (§3) |
| Template blocks | `expandtemplates.layout` | JSON string; `sides`, `defaultSides` are ObjectId arrays |
| Header / footer | `sides.header`, `sides.footer` | JSON strings |
| Landing page order | `sides.pagesOrder` | string array |
| Palette | `bases.preferences` (JSON string) `.palette` | `default` / `alternative` / `alternative2` |
| View visible fields and order | `views.fields` | ObjectId array |
| View look | `views.layout` | JSON string of an **array**, `[ {…} ]` |
| Card cover | `views.brandField` | field id |
| Card colours | `views.conditionalColors` | JSON string |
| Kanban | `views.kanbanSettings` | JSON string |
| Chip colours | `fields.colors` | JSON string `{"idx":"token"}` |
| Record cover / avatar | `tables.cover`, `tables.logoField` | key / field id |

## Appendix C: Real examples worth opening (read-only, ids on the team test server)

| Example | Id | What it shows |
|---|---|---|
| Kindergarten template home | page `<id>` | TEXT gradient hero, MENU, TitleDividers, card-grid TEXT, STATS, dark CTA TEXT. Its MENU subtitles are dropped because the items are type1 |
| Parent portal home | page `<id>` | ExpandRecord portal pattern |
| Gym admin welcome | page `<id>` | Purple SECTION around STATS, COLUMNS2 of two VIEWs |
| Rich detail template | template `<id>` | COLUMNS4 info tiles, TABS of coloured SECTIONs with filtered VIEWs, `[role]`-gated "no access" SECTION |
