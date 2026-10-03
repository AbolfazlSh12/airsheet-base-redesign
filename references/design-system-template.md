# Design-system template (filled example from the first project)

This is the design contract the design lead wrote for the first redesign (a supplier portal for a telecom operator,
five sides: public site, external portal, three internal workbenches) — kept whole because every component in it
was checked against the live renderer. For a new customer, copy it to `<work>/design/SYSTEM.md` and replace:

- **§0 direction** and **§2.2 fixed brand colours** — from the customer's own logo (measure the vector in their documents).
- **§1 theme table** — sides, `layoutType`, header names, logos; the palette closest to the brand hue.
- **§2.3 status map** — one row per status field of the new base (option → token).
- **§5 icon lexicon** — one row per business concept of the new base.
- Every `<id>` — read real ids with the lib getters. Persian copy in «…» is example text.

Keep: typography (§3), spacing (§4), component snippets (§8), page shells (§9), anti-bug checklist (§10). `design-guide.md`
explains why each rule exists (numbers like #5 refer to its §11 bug table).

## Corrections after the customer review (they override the sections below)

The customer liked the calm theme but rejected four choices. Apply these from day one. Mechanics with code citations:
`<workspace>/srm-build/round2/MECHANICS.md`; whitespace measurements: `…/round2/WHITESPACE-AUDIT.md`.

1. **Every select option has a colour.** §2.3 said "every categorical list → all options `gray`" — the customer read that
   as "options have no colours". Status and yes/no fields keep their semantic maps (green/yellow/red/blue/gray).
   Categorical fields: `L.updateField(id, { colors: {} })` on the **source** field. `Field.colors` is
   `{"<optionIndex>":"<token>"}`; an index with no entry falls back to the default cycle blue, cyan, teal, green, yellow,
   orange, red, pink, purple, gray (`index % 10`), which is exactly the look the customer expected. Lookups of the field
   follow automatically (`ufield` copies `colors` into them). Each `ufield` recomputes the table's formulas: batch per
   table, `DRY=1` first. Formula "statuses" are plain text: colour them with view `conditionalColors`, not chips.
2. **Every gallery has a cover.** §8.8 said "no `brandField`". Set `view.brandField` to an `attachments` field or a
   `lookup` of one (e.g. the parent's logo), keeping the other `layout[0]` keys. Only `image/*` files get a thumbnail
   (1024 px, what the gallery always shows); a PDF shows `noimage.webp`; an **empty cover draws a grey box** — there is no
   fallback image, so every row needs an image (seed mock rows with one; backfill real rows). A record attachment value
   is `[{id,key,url,mimetype,filename,size,fileSize,preview:true,type,thumbnails:{large:{url}}}]` with `thumbnails` as an
   **object** (a string falls back to `noimage.webp`). One uploaded image can be shared by many rows. Don't upload SVG as a
   gallery image. `view.galleryFields` is never read; card fields are the view's visible `fields[]`.
3. **No large empty areas.** A page that ends in the top half of a 1366×1080 screen looks unfinished (the footer never
   shows: the page wrapper is `min-h-[100dvh-48px]`). Gallery grids are hard-coded `auto-fill`, so 1–2 cards never
   stretch, and an empty gallery of any type but `search` renders nothing. Recipes: help side-column (COLUMNS2 66/33 with
   contact card + MENU type3) instead of a bottom band; short galleries as `featuredSize:"xl"` or `news`; tabular items
   (requests, contracts, orders, messages) as Grid, not cards; GALLERYMENU `fit:true` (the only grid that stretches);
   record-conditional empty states in templates; a KPI strip on work pages so an empty queue reads as «۰ در انتظار»;
   long inline forms moved into a MENU type3 dialog; a static step explainer or TIMELINE so a page has substance with no
   data. Measure with screenshots (verification.md §4).
4. **A soft page background is welcome.** §4 said "Page background: none". `content.background =
   {type:"image", value, fixed:false}` paints the whole page wrapper, always `cover/center/no-repeat`, with **no overlay,
   opacity or dark variant**. An opaque light photo (including the product's `/img/page%20bg/backgroundN.jpg`) breaks
   dark mode: light titles disappear on it. Use a **transparent SVG** (shapes at alpha ≤ 0.18, detail at the edges,
   `viewBox` ~1600×1000 with `preserveAspectRatio="xMidYMid slice"`, < 5 KB) stored as
   `"data:image/svg+xml," + encodeURIComponent(svg)`: the SVG must contain **no single quote** (the value is interpolated
   into `url('…')`), it needs no upload and is portable across servers, and the theme's own background shows through.
   Put body text on a surface (SECTION `color:"base-100"`, or an inline card with `hsl(var(--b1) / .9)`) because TEXT,
   headings and tabs are transparent. Apply to one page, screenshot light, `THEME=dark` and `MOBILE=1`, get the OK, then
   roll out. Never use a multi-layer "overlay" value (it works only through the unescaped interpolation — CSS injection a
   fix will break).

Second review (SRM, 2026-10-01) — also apply from day one. Scripts: `srm-build/build/steps/round3/` (s1, s5, s6, s8–s11).

5. **Portal users get a sidebar, not a website header.** Side `layoutType:"sidebar"` for every logged-in portal;
   `website` only for the public site. Give every `header.menuItems[]` (and children) `icon` (Lucide) + `iconColor`.
6. **Link-field pickers are galleries.** `cards` (short labelled fields, no cover), a copy of the old Grid's filters;
   the user-scope filter stays (pickers are readable by portal users).
7. **No table (Grid) view on the public site.** Archive lists become `cards` with a cover. Inside portals a Grid is fine
   for tabular staff work.
8. **Variety, not one card type everywhere.** `featured` (image visually left = stored `featuredImagePos:"right"`) for
   opportunities and contracts, with `featuredHero` + `heroFields` on a home page; `news` rows for inbox-like lists of
   0–3 items (needs-action tabs, invitations, messages, FAQ); `cards` for "my requests" (status colours); a
   `cardsHorizontal` carousel for news and guides. Several lone cards stacked in one column was the most visible defect.
9. **News looks like a carousel**: `cardsHorizontal`, fields = title only, cover image, full page width (not inside a
   column).
10. **A background on every page, one per portal.** The public site keeps one art; each portal gets its own transparent
    SVG of the same family (different hue + motif) on all of its pages (`round3/background/*.svg`).
11. **Public opportunities on the portal dashboard right after login, before approval too** (a carousel with the
    public site's filter, opening the portal's trade template; participation stays approved+active only).
12. **No empty list anywhere** in the demo (verified with `scripts/crawl-lists.cjs` per role).

---

## 0. Direction in one paragraph

A white, quiet workspace with one accent. The brand shows up in three places only: the BRAND logo in every header,
a compact navy-to-blue hero on each portal's landing page, and the blue accent (indicator bars, icons, links,
primary buttons). Everything else is neutral: white cards with a 1px hairline border, grey helper text, and
generous Persian line-height. Colour carries meaning only as **status** (green, amber, red). The accent and the
three status hues are the only colours on any page. Portals are told apart by the header name and the hero eyebrow,
never by colour. No photos, no picture tiles, no emoji, no rainbow gradients. Icons are line icons from one set per
context.

### Principles (each one fixes something visible in `shots/before/`)
1. **One hue.** All chromatic colour comes from the blue family (hue 199–212°). This replaces the current teal, indigo,
   purple, orange, pink and green heroes and tiles.
2. **Heroes are for landings only.** One compact dark hero per portal landing page. Every other page gets the light
   **page header** (§8.2). This removes the heavy full-bleed band that currently repeats on all 33 pages.
3. **Everything lines up.** Heroes, headers and content share one column width per page (`maxw`). There are no
   full-bleed bands, except that boards (Kanban and Calendar) get the full width.
4. **Every list has a heading, a one-line purpose, an explicit create policy and an explicit detail template.**
   No bare views, no «جدید» button that creates an empty record, no dead «مشاهده همه».
5. **State drives the page.** On record pages (supplier dashboard, profile, requests) the first thing under the header is
   what the viewer must do next, chosen by the record's status (§8.10, §8.11).
6. **Forms open where the task starts.** A request form opens in a dialog from a quick-action card, and the new draft
   opens right after save (`expandAfterSubmit`). Inline forms are not stacked on list pages.
7. **Dark mode keeps working.** Only tokens are used, except on the fixed-colour hero, where every hex background has
   its own hex text colour.

---

## 1. Theme setup (base and sides)

### 1.1 Base
| Setting | Value | Why |
|---|---|---|
| `preferences.palette` | `"alternative2"` | The sky scale. Primary `#0284c7` and blue3 `#0ea5e9` sit on the logo hue (199°). Every `var(--blueN)` and `hsl(var(--p))` turns BRAND blue in one step, and dark mode is included. `updateBase` shallow-merges, so pass only `{palette}`. |
| `preferences.cover` | `""` (remove) | The stored key 404s, and it is the default cover of every page created in the UI. |
| `base.logo` | upload `assets/brand-mark-tile-512.png` | The app sidebar draws it at 24px, `object-cover`. The white tile reads in both themes. |
| `preferences.expandMode` | leave `null` | Each VIEW block sets `expandMode:"dialog"` explicitly. |

### 1.2 Sides
| Side | id | `layoutType` | `header.name` | Logo | Footer |
|---|---|---|---|---|---|
| سایت (visitor) | `<id>` | `website` | سامانه تأمین‌کنندگان | horizontal (light/dark) | full (§8.14) |
| درگاه تأمین‌کننده (user) | `<id>` | `website` | درگاه تأمین‌کننده | horizontal (light/dark) | compact (§8.14) |
| میز کار زنجیره تأمین | `<id>` | `sidebar` | میز کار زنجیره تأمین | mark tile | none (sidebar has none) |
| درگاه برنامه‌ریزی خرید | `<id>` | `sidebar` | برنامه‌ریزی خرید | mark tile | none |
| پنل مدیریت | `<id>` | `sidebar` | پنل مدیریت | mark tile | none |

The `sidebar` layout for the three internal portals is decision **D-3**. It gives an app-like workbench with icons and
leaves more width for grids. The sidebar logo slot is a 32×32 `object-cover` square (`SidebarLayout.vue:62`), so it takes
the mark tile, and it has no `darkLogo`. Fallback: if a sidebar screenshot shows a problem that cannot be fixed by
configuration, keep `website` for that side and apply the same header JSON. The pages do not change.

Header JSON: §8.13. `themeButton.show:false` on every side.

### 1.3 Conflicts resolved
| Topic | BRAND.md | DESIGN-GUIDE.md | **Decision** |
|---|---|---|---|
| Brand hex | `#0095DA`, measured from the customer's SVG in the SRM docx | `#124f7d`→`#2195d2`, sampled from `public/img/brand-logo.webp` | **`#0095DA` family**. The customer's own document is the source of truth. Heroes use navy `#0B2540` → `#006FA6`, accent `#0095DA`. |
| Hero radius and padding | 16px | 20–24px, 32–48px padding | **16px**, compact padding (§8.1). This matches the cards. |
| Hero images | `hero-brand-*.jpg` uploads | full-URL SECTION backgrounds | **No images.** A pure CSS gradient in TEXT. It is environment-independent and needs no upload. |
| Navigation tiles | GALLERYMENU icon mode | GALLERYMENU or MENU | **MENU `type3`** for every quick action, because it has a subtitle. GALLERYMENU is not used. |
| `FileSignature`, `FilePlus2`, `CircleHelp` icons | used in examples | used in examples | Not in the validator list (`lucideIconNames.ts`, 1,748 names). They render only as legacy aliases. Use `ScrollText`, `FilePlus` and `CircleQuestionMark`. |

---

## 2. Colour

### 2.1 Tokens: use these names, never raw hex (except §2.2)
Values are from `tailwind.config.js` `alternative2_light` / `alternative2_dark`.

| Role | Inline CSS | Light | Dark | Use |
|---|---|---|---|---|
| Accent | `var(--blue3)` | `#0ea5e9` | `#38bdf8` | Indicator bars, icons, focus. Never small text on white (2.8:1). |
| Accent text | `var(--blue4)` | `#075985` | `#7dd3fc` | Links, eyebrows, icon on tint, info text. |
| Primary (daisy) | `hsl(var(--p))` | `#0284c7` | `#38bdf8` | Only where a component needs `primary`. |
| Tint | `var(--blue)` | `#e0f2fe` | `#0c2a4a` | Icon chips, info callouts, pale buttons. |
| Tint border | `var(--blue2)` | `#bae6fd` | `#1e4070` | Border of info callouts. |
| Ink | `hsl(var(--bc))` | `#172033` | `#e2e8f0` | Headings and body. |
| Muted | `var(--gray3)` | `#64748b` | `#94a3b8` | Helper lines, captions, labels. |
| Surface | `hsl(var(--b1))` | `#fbfcff` | `#0f172a` | Cards, page. |
| Surface alt | `hsl(var(--b2))` | `#f4f7ff` | `#0d1424` | Empty states, footer, quiet bands. |
| Hairline | `var(--gray2)` | `#e2e8f0` | `#2d3d52` | Every border and divider. |
| Success | `var(--green4)` on `var(--green)`, border `var(--green2)` | `#166534`/`#dcfce7` | `#86efac`/`#0a2e14` | Approved, active, done. |
| Warning | `var(--yellow4)` on `var(--yellow)`, border `var(--yellow2)` | `#854d0e`/`#fef9c3` | `#fde047`/`#3b2e00` | Needs the viewer's action, deadline close. |
| Danger | `var(--red4)` on `var(--red)`, border `var(--red2)` | `#b91c1c`/`#ffe4e6` | `#fca5a5`/`#3b0f1a` | Rejected, cancelled, overdue. |
| Neutral status | `var(--gray4)` on `var(--gray)`, border `var(--gray2)` | `#1e293b`/`#f1f5f9` | light/dark slate | Draft, archived. |

Rules:
- daisyUI variables are HSL triplets: write `hsl(var(--bc))`, never `var(--bc)`. `var(--base-content)`, `var(--primary)` and
  `var(--base-200)` are **undefined**. Never use them.
- Block settings take either a CSS value (`"var(--blue3)"`, used by TitleDivider, MENU, STATS and the header) or a **token
  name** (`"blue"`, `"gray2"`, used by SECTION `color`/`borderColor`, ALERT `color`, BUTTON `color` and view `conditionalColors`).
  Each component in §8 states which form it takes.
- The other token families (teal, cyan, purple, pink, orange) are **not used anywhere**.

### 2.2 Fixed brand colours (hero and logo only)
| Name | Hex | Where |
|---|---|---|
| Navy | `#0B2540` | Hero, text side |
| Brand dark | `#006FA6` | Hero, far side of the gradient |
| Brand | `#0095DA` | Hero accent bar and glow; the logo accent |
| On-navy eyebrow | `#BAE6FD` | Eyebrow text on the hero (9.3:1) |
| On-navy body | `#E0F2FE` | Hero lead text |
| White | `#FFFFFF` | Hero title |

The hero sets a hex background and hex text on the same element, so it looks identical in both themes.

### 2.3 Status colour map (one meaning, one colour, on every table)
**singleSelect `Field.colors`** (token names). Each domain agent owns its table's fields; the implementer verifies them
and applies anything still missing:

| Field | Mapping (option → token) |
|---|---|
| تأمین‌کنندگان.وضعیت احراز هویت | در حال تکمیل→`gray`, در انتظار بررسی→`blue`, تأییدشده→`green`, نیازمند اصلاح→`yellow`, ردشده→`red` |
| تأمین‌کنندگان.وضعیت فعالیت | فعال→`green`, غیر فعال→`gray` |
| 8 profile tables.وضعیت بررسی | در حال بررسی→`blue`, تأیید شده / تایید شده→`green`, تأیید مشروط / تایید شده به صورت مشروط→`yellow`, رد شده / تایید نشده→`red`, معاملات شرکت کرده→`gray` |
| مشارکت.نتیجه پاکت الف/ب/ج | عدم تعیین وضعیت→`gray`, قبول→`green`, مشروط→`yellow`, رد→`red` |
| مشارکت.وضعیت ارزیابی کیفی | در حال ارزیابی→`blue`, قبول→`green`, مردود→`red` |
| مشارکت.نتیجه | برنده اول/دوم/سوم→`green`, برنده نشده→`gray` |
| مشارکت.وضعیت دعوت | در انتطار تعیین وضعیت→`gray`, دعوت شده ولی پاسخ نداده→`yellow`, انصراف…→`gray`, اسناد دریافت شده ولی پاسخ نداده→`yellow`, پاکات تحویل داده شد→`green` |
| مشارکت.ثبت درخواست | در انتظار تکمیل→`yellow`, تکمیل شده→`green` |
| مبادلات قرارداد.آیا قرارداد مورد تأیید است؟ | بلی→`green`, خیر→`red` |
| پیام‌ها.وضعیت | جدید→`blue`, در حال پاسخ→`yellow`, بسته‌شده→`gray` |
| معاملات.وضعیت انتشار | انتشار→`green`, عدم انتشار→`gray` |
| Every yes/no (بله/خیر، بلی/خیر، فعال/غیر فعال) | yes→`green`, no→`gray` |
| Every categorical list (نوع تأمین‌کننده، بانک، استان، نوع معامله، دسته، نوع درخواست …) | `colors: {}` = the platform default cycle (Corrections 1). Not all `gray`. |

**Formula statuses** (`وضعیت` on the 5 request tables and مبادلات, `وضعیت مشارکت`, `وضعیت قرارداد`, `مرحله`) render as plain
text, not chips. Show their state with **row colour** (view `conditionalColors`, level-1 pale tokens) and, inside templates, with
the **stepper** (§8.10):

| Request status (formula) | Row colour token | Stepper |
|---|---|---|
| پیش‌نویس | `gray` | step 1 current |
| ارسال‌شده | `blue` | step 2 current |
| در حال بررسی | `blue` | step 3 current |
| نیازمند اصلاح | `yellow` | step 3 warning |
| تأییدشده | `green` | all done |
| رد یا لغو شده | `red` | step 3 danger |

`conditionalColors` JSON (one entry per status, first match wins):
```json
[{"id":"cc-draft","enabled":true,"color":"gray","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"پیش‌نویس","relativeDate":null,"relativeTime":null}}]},
 {"id":"cc-sent","enabled":true,"color":"blue","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"ارسال‌شده","relativeDate":null,"relativeTime":null}}]},
 {"id":"cc-review","enabled":true,"color":"blue","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"در حال بررسی","relativeDate":null,"relativeTime":null}}]},
 {"id":"cc-fix","enabled":true,"color":"yellow","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"نیازمند اصلاح","relativeDate":null,"relativeTime":null}}]},
 {"id":"cc-ok","enabled":true,"color":"green","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"تأییدشده","relativeDate":null,"relativeTime":null}}]},
 {"id":"cc-no","enabled":true,"color":"red","conditions":[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت>","operator":"is","operand":"رد یا لغو شده","relativeDate":null,"relativeTime":null}}]}]
```
Say in the list's helper line that row colour means status («رنگ هر ردیف، وضعیت آن را نشان می‌دهد.»), but do not spell out a legend.

---

## 3. Typography

The font is inherited: IRANSansXV with Persian digits. **Never set `font-family`.** Every heading and paragraph in TEXT sets
`font-size`, `font-weight`, `line-height`, `margin` and `letter-spacing:0` inline. Sizes are otherwise load-order dependent
(DESIGN-GUIDE §5.3), and the global negative tracking breaks joined Persian script.

| Role | Tag | Size | Weight | Line-height | Colour |
|---|---|---|---|---|---|
| Hero title (site home) | `h1` | `clamp(24px,3.6vw,34px)` | 800 | 1.5 | `#FFFFFF` |
| Hero title (portal landing) | `h1` | `clamp(22px,3vw,28px)` | 800 | 1.5 | `#FFFFFF` |
| Page title (page header) | `h1` | `24px` | 800 | 1.5 | `hsl(var(--bc))` |
| Section title | TitleDivider | component (≈16px bold) | – | – | `hsl(var(--bc))` |
| Sub-label (inside tabs) | `div` | `14px` | 700 | 1.7 | `hsl(var(--bc))` |
| Card title | `div` | `15px` | 700 | 1.7 | `hsl(var(--bc))` or status text |
| Body | `p`/`div` | `14px` | 400 | 1.9 | `hsl(var(--bc))` |
| Helper / caption | `p`/`div` | `13px` | 400 | 1.8 | `var(--gray3)` |
| Eyebrow | `div` | `13px` | 500 | 1.6 | `var(--blue4)` (on the hero, `#BAE6FD`) |
| Chip | `span` | `12px` | 600 | 1.6 | status text on status tint |
| Static KPI number | `div` | `28px` | 800 | 1.2 | `hsl(var(--bc))` |

Copy rules:
- Persian digits (۱۲۳) in all static copy. Money: «۱۲٬۵۰۰٬۰۰۰ ریال».
- Use the zero-width non-joiner correctly («درخواست‌ها», «می‌شود»).
- Address the supplier as «شما», politely and briefly. Use no exclamation marks. Say what happens next rather than what the system is.
- TitleDivider titles must be **25 characters or fewer** (they truncate at 140/200/360px). Helper lines are one sentence.
- Button labels name the result: «ثبت درخواست», «ارسال برای بررسی», «افزودن عضو». Never use a bare «ارسال» or «ثبت».
- The 24 decisions are recorded as defaults in BRIEF. Where copy asserts an unconfirmed fact (a phone number, a turnaround
  time, a legal rule), add the marker chip «متن پیشنهادی — نیازمند تأیید کارفرما» (§8.6.3).

---

## 4. Space, shape, elevation

| Item | Value |
|---|---|
| Grid | 4px base. Card padding 16–20px, gap between cards 12px, between sections 24px. |
| Block gap | The platform puts only 4px between blocks. Vertical rhythm comes from TitleDivider (`my-4`), SECTION `padding`, and the inline `margin` in TEXT components (they already carry it). |
| Radius | 16px for the hero and header cards (SECTION `radius:"16"`), 12px for cards, callouts and tiles, 8px for small buttons, 999px for chips and pills. |
| Border | `1px solid var(--gray2)`. SECTION: `borderLine:true, borderWeight:1, borderColor:"gray2"`. Prefer a border to a shadow. |
| Shadow | At most one level: SECTION `shadowEnabled:true, shadowIntensity:8`. It is used only on the header card of a detail template. MENU type3 carries its own soft shadow. No other shadows. |
| Page width (`content.maxw`) | Dashboards and lists `tw-max-w-6xl`. Forms and articles `tw-max-w-4xl`. Boards (Kanban, Calendar) `tw-max-w-7xl`. Templates `tw-max-w-5xl` (the site article template `tw-max-w-3xl`). |
| Page alignment | `align:{"value":"center","label":"وسط"}` on every page. |
| Page background | Transparent SVG data URI on short and content pages (Corrections 4). No opaque photo. |
| Page name | `content.name:""` on every page (the page header or hero is the title), `cover:""`, `icon:""`, `showBreadcrumb:false`. |
| Template title | `showTitle:false` on every template. The header card shows the title (§8.9). |

Mobile: no fixed widths above 320px in HTML. Card rows use `display:flex;flex-wrap:wrap;gap:12px` with children
`flex:1 1 220px`. COLUMNS2 stacks below 768px. MENU type3 becomes one column below 640px.

---

## 5. Icons

Two sets, one per context, never mixed within a context:
- **Block settings** (MENU `lucidIcon`, STATS `icon`, sidebar menu `icon`, header `dynamicButton.icon`): **Lucide**, PascalCase.
  Use names that are in the validator list.
- **TEXT HTML**: **Phosphor regular** `<i class="ph ph-<name>"></i>`, loaded globally (`src/css/fonts.scss`).

Colour: the accent (`var(--blue4)` on a `var(--blue)` chip, or bare `var(--blue3)`). Status icons take their status colour.
Icon sizes: 20px inline, 22px in callouts, 28px in empty states.

**Lexicon.** The same concept gets the same icon in every portal:

| Concept | Lucide (blocks) | Phosphor (TEXT) |
|---|---|---|
| Dashboard | `LayoutDashboard` | `squares-four` |
| Supplier profile / company | `Building2` | `buildings` |
| Identity verification | `BadgeCheck` | `seal-check` |
| Deals / opportunities | `Gavel` | `gavel` |
| Invitation | `Mail` | `envelope-simple` |
| Participation | `Handshake` | `handshake` |
| Contract | `ScrollText` | `scroll` |
| Contract exchange (review) | `FilePen` | `pen-nib` |
| Purchase order | `Package` | `package` |
| Delivery request | `Truck` | `truck` |
| Invoice / PAC / FAC | `Receipt` | `receipt` |
| Good-performance certificate | `Award` | `medal` |
| Insurance clearance | `Landmark` | `bank` |
| Clearance inquiry | `FileSearch` | `file-magnifying-glass` |
| Track requests / cartable | `Inbox` | `tray` |
| New request | `FilePlus` | `file-arrow-up` |
| Messages / support | `MessageSquare` | `chat-circle-text` |
| Help / FAQ | `LifeBuoy` | `question` |
| News | `Newspaper` | `megaphone` |
| Calendar / deadline | `CalendarDays` | `calendar-blank` / `clock` |
| Reports | `ChartColumn` | `chart-bar` |
| Sync monitor | `RefreshCw` | `arrows-clockwise` |
| Org structure | `Network` | `tree-structure` |
| Catalogue | `Tags` | `tag` |
| Register / login | `UserPlus` / `LogIn` | `user-plus` / `sign-in` |
| Contact | `Phone` | `phone`, `envelope-simple`, `map-pin` |
| Locked / gated | – | `lock-simple` |
| Info / warning / success / danger | – | `info` / `warning-circle` / `check-circle` / `x-circle` |
| Waiting | – | `hourglass-medium` |

---

## 6. Assets

`assets/` (prepared from the customer's SVG in the SRM docx, `word/media/image4.svg`; the black was recoloured only for
the dark variants):

| File | Size | Goes to |
|---|---|---|
| `brand-logo-horizontal-light.png` | 708×144, transparent | `header.logo` of the website sides (visitor, supplier). Rendered 36px high → 177px wide. |
| `brand-logo-horizontal-dark.png` | 708×144, transparent, white | `header.darkLogo` of the same sides. |
| `brand-lockup-light.png` / `-dark.png` | 800×331, transparent | The footer `brand` widget (`images:[key]`), light only. The dark variant is kept for later use. |
| `brand-mark-light.png` / `-dark.png` | 347×160, transparent | Spare; for any place that needs the mark alone on a known background. |
| `brand-mark-square-light.png` / `-dark.png` | 512×512, transparent, mark centred | Spare square marks. |
| `brand-mark-tile-512.png` | 512×512, white tile, black mark | `base.logo` and the `header.logo` of the 3 sidebar sides (32px square, no dark variant there). |
| `src/` | – | Source SVG, `render_svg.cjs` (headless-Chromium SVG→PNG) and `make_assets.py` (crop, trim, recolour). Rebuild command: see `assets/UPLOAD.md`. |

"Horizontal" is the one-line Persian wordmark «<نام برند>» with its blue accent, an unmodified crop of the official lockup.
No new arrangement of the brand was invented. The mark is the «brand» part of the same lockup.

**Uploading (implementation phase; do not do it in the design phase).** Components that show images prepend
`S3 + /cloud-uploads/`, so each file must become an uploaded storage **key**:
1. One script uploads every asset once with `L.uploadFile(path, "image/png")` (run `DRY=1` first) and writes the keys to
   `design/assets/keys.json`. Every other agent reads the keys from there; never upload twice (there is no delete API).
2. `base.preferences.maxImageSizeKB` caps client-side uploads; keep PNGs small anyway (the first project's were < 40KB).
3. The footer `brand` widget needs `images:[{id, src:<key>, width:"150px", widthNum:150, align}]`, not bare keys.
4. Never paste a full `https://<host>/cloud-uploads/...` URL: it breaks on another environment.

---

## 7. Filters used by the components (copy exactly, fill the ids)

Field and role ids are listed in `IA.md` Appendix A. `<F:name>` means "the id of that field".

**Supplier is approved and active** (it gates every transactional section in supplier templates):
```json
[{"index":0,"filter":{"andor":"and","field":"<F:وضعیت احراز هویت>","operator":"is","operand":"تأییدشده","relativeDate":null,"relativeTime":null}},
 {"index":1,"filter":{"andor":"and","field":"<F:وضعیت فعالیت>","operator":"is","operand":"فعال","relativeDate":null,"relativeTime":null}}]
```
**Supplier is not yet approved** (the locked card, §8.11). This is a group with `or` in the same shape as the existing planning STATS filters:
```json
[{"index":0,"filter":{"andor":"and","children":[
  {"filter":{"andor":"and","field":"<F:وضعیت احراز هویت>","operator":"is not","operand":"تأییدشده","relativeDate":null,"relativeTime":null}},
  {"filter":{"andor":"or","field":"<F:وضعیت فعالیت>","operator":"is not","operand":"فعال","relativeDate":null,"relativeTime":null}}]}}]
```
**Status is X** (one per state panel):
```json
[{"index":0,"filter":{"andor":"and","field":"<F:status>","operator":"is","operand":"<value>","relativeDate":null,"relativeTime":null}}]
```
**Staff only** (the staff action panels in templates that suppliers also open):
```json
[{"index":0,"filter":{"andor":"and","field":"[role]","operator":"has any of","operand":["<id>","<id>"],"relativeDate":null,"relativeTime":null}}]
```
(chain + admin). A portal supplier evaluates `[role]` as false, so staff sections disappear for them. The owner always sees them.
**Not planning** (hides edit/decision panels from the read-only planning role):
```json
[{"index":0,"filter":{"andor":"and","field":"[role]","operator":"has none of","operand":["<id>"],"relativeDate":null,"relativeTime":null}}]
```
Only put filters on SECTION blocks inside **expand templates**. On plain pages only `[role]` works (DESIGN-GUIDE rule 17).

---

## 8. Components (copy-paste)

Conventions:
- `<uuid>` means a fresh `crypto.randomUUID()` per block. Ids must be unique inside one page or template.
- Replace `«…»` with the copy from `IA.md`.
- TEXT HTML must stay **on one line** inside the JSON string (the build script can join the lines). Keep the `"` → `\"` escaping.
- Each component lists the bugs it avoids (DESIGN-GUIDE §11 numbers).

### 8.1 Hero (portal landing pages only)
TEXT. It uses fixed colours, so it looks identical in light and dark mode. The text sits on the navy (right) side.
`«MOTIF»` is the faint telecom-network texture (an inline, percent-encoded SVG with no quotes, stroke `#BAE6FD` at 28%). Paste the exact
contents of `assets/hero-motif.txt` in its place (2.4KB). The motif is part of the CSS, so it needs no upload and is not tied to any host. The
inset hairline keeps the hero's edge visible on a dark page.
```html
<div style="background:url(data:image/svg+xml,«MOTIF») no-repeat 0% 50%/min(30%,280px) auto,radial-gradient(90% 160% at 0% 100%,rgba(0,149,218,.42) 0%,rgba(0,149,218,0) 60%),linear-gradient(250deg,#0B2540 0%,#0B2540 45%,#006FA6 100%);box-shadow:inset 0 0 0 1px rgba(186,230,253,.12);color:#FFFFFF;border-radius:16px;padding:24px clamp(20px,4vw,32px);margin:12px 0 8px">
<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.6;letter-spacing:0;color:#BAE6FD;margin:0 0 8px"><span style="display:inline-block;width:20px;height:3px;border-radius:2px;background:#0095DA"></span>«eyebrow: portal name · <نام برند>»</div>
<h1 style="margin:0;font-size:clamp(22px,3vw,28px);font-weight:800;line-height:1.5;letter-spacing:0;color:#FFFFFF">«title»</h1>
<p style="margin:6px 0 0;font-size:14px;font-weight:400;line-height:1.9;letter-spacing:0;color:#E0F2FE;max-width:640px">«one-sentence lead»</p>
</div>
```
Block: `{"id":"<uuid>","type":"TEXT","details":{"value":"<html above, one line>"}}`

**8.1b Hero, site-home variant.** It is larger and adds up to three fact pills:
```html
<div style="background:url(data:image/svg+xml,«MOTIF») no-repeat 2% 50%/min(40%,440px) auto,radial-gradient(90% 160% at 0% 100%,rgba(0,149,218,.45) 0%,rgba(0,149,218,0) 60%),linear-gradient(250deg,#0B2540 0%,#0B2540 42%,#006FA6 100%);box-shadow:inset 0 0 0 1px rgba(186,230,253,.12);color:#FFFFFF;border-radius:16px;padding:clamp(28px,5vw,48px) clamp(20px,4vw,40px);margin:12px 0 8px">
<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.6;letter-spacing:0;color:#BAE6FD;margin:0 0 10px"><span style="display:inline-block;width:20px;height:3px;border-radius:2px;background:#0095DA"></span><نام برند> · سامانه ارتباط با تأمین‌کنندگان</div>
<h1 style="margin:0;font-size:clamp(24px,3.6vw,34px);font-weight:800;line-height:1.5;letter-spacing:0;color:#FFFFFF;max-width:760px">«title»</h1>
<p style="margin:10px 0 0;font-size:15px;font-weight:400;line-height:1.9;letter-spacing:0;color:#E0F2FE;max-width:640px">«lead»</p>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 0">
<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(186,230,253,.35);color:#E0F2FE;font-size:13px;line-height:1.6"><i class="ph ph-user-plus" style="font-size:16px;color:#BAE6FD"></i>«pill 1»</span>
<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(186,230,253,.35);color:#E0F2FE;font-size:13px;line-height:1.6"><i class="ph ph-gavel" style="font-size:16px;color:#BAE6FD"></i>«pill 2»</span>
<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(186,230,253,.35);color:#E0F2FE;font-size:13px;line-height:1.6"><i class="ph ph-tray" style="font-size:16px;color:#BAE6FD"></i>«pill 3»</span>
</div>
</div>
```
Avoids #16 (host-bound image), #20 (page name strip: set `content.name:""`), and the rainbow heroes.

### 8.2 Page header (every non-landing page)
TEXT, token-based. It replaces the dark band on inner pages.
```html
<div style="padding:20px 4px 14px;margin:4px 0 8px;border-bottom:1px solid var(--gray2)">
<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.6;letter-spacing:0;color:var(--blue4);margin:0 0 4px"><span style="display:inline-block;width:18px;height:3px;border-radius:2px;background:var(--blue3)"></span>«eyebrow: portal or parent menu»</div>
<h1 style="margin:0;font-size:24px;font-weight:800;line-height:1.5;letter-spacing:0;color:hsl(var(--bc))">«page title»</h1>
<p style="margin:4px 0 0;font-size:14px;font-weight:400;line-height:1.9;letter-spacing:0;color:var(--gray3);max-width:720px">«one-sentence purpose»</p>
</div>
```
On supplier pages the page header sits **on the page**, before the ExpandRecord block, so it is the first block. This keeps the page's
`maxw` active (DESIGN-GUIDE rule 20).

### 8.3 Section header: TitleDivider (+ optional helper line)
Always set the full object. The title is 25 characters or fewer.
```json
{"id":"<uuid>","type":"TitleDivider","details":{"value":"","title":"«title ≤25»","showIndicator":true,"indicatorOrient":"horizontal","indicatorSizeKey":"md","indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"hsl(var(--bc))","showButton":false}}
```
**With a real link** (only when a target page exists). The pale button stays readable in both themes:
```json
{"id":"<uuid>","type":"TitleDivider","details":{"value":"","title":"«title»","showIndicator":true,"indicatorOrient":"horizontal","indicatorSizeKey":"md","indicatorColor":"var(--blue3)","showLine":true,"lineColor":"var(--gray2)","titleColor":"hsl(var(--bc))","showButton":true,"buttonText":"«همه‌ی …»","buttonColor":"var(--blue)","buttonTextColor":"var(--blue4)","linktype":"page","side":"<sideId>","path":"<pageId>","openInNewTab":false,"url":""}}
```
**Helper line** (TEXT placed directly after the TitleDivider):
```html
<p style="margin:-10px 0 6px;padding:0 8px;font-size:13px;font-weight:400;line-height:1.8;letter-spacing:0;color:var(--gray3)">«one sentence that also reads well when the list is empty»</p>
```
**8.3b Sub-label** (small heading inside a tab, above a secondary list):
```html
<div style="display:flex;align-items:center;gap:8px;margin:14px 0 4px;font-size:14px;font-weight:700;line-height:1.7;letter-spacing:0;color:hsl(var(--bc))"><i class="ph ph-«icon»" style="font-size:18px;color:var(--blue3)"></i>«label»</div>
```
Avoids #6 (dead «مشاهده همه» button, truncation), #9 and #32.

### 8.4 KPI strip
**8.4a Live KPIs: STATS** (collaborator dashboards, and the supplier dashboard template using user-relative filters).
Leave `color` empty (a neutral tile). Every item gets `field` (the primary field), a Lucide `icon` and a short `unit`.
`drilldownView` works on collaborator sides only; set it there.
```json
{"id":"<uuid>","type":"STATS","details":{"value":[
 {"id":"<uuid>","label":"«label ≤22»","type":"dynamic","table":"<tableId>","field":"<primaryFieldId>","aggregate":"count","format":"quantity","unit":"«مورد»","icon":"«Lucide»","color":"","drilldownView":"<viewId or omit>","filter":[ «filter» ]}
]}}
```
Use 3–6 tiles, ordered by urgency (what needs action first). Avoids #16/#30 (saturated fills), the missing `field` refetch bug,
and #19 (a supplier KPI without a user-relative filter shows global counts: every supplier KPI filter must start with
`<F:موبایل تأمین‌کننده> has my mobile`).

**8.4b Record KPIs** (inside a supplier template, from rollups on the supplier record). RECORD `visibleTop` + `bg` in a COLUMNS
row: `{"type":"RECORD","details":{"value":["<F:تعداد قرارداد>"],"fieldsTheme":"visibleTop","valuesTheme":"bg","showFieldIcons":false,"immutable":{"<F:تعداد قرارداد>":[]}}}`.

**8.4c Static fact tiles** (public pages only, for numbers that do not change):
```html
<div style="display:flex;flex-wrap:wrap;gap:12px;margin:8px 0">
<div style="flex:1 1 200px;background:hsl(var(--b1));border:1px solid var(--gray2);border-radius:12px;padding:16px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-size:13px;line-height:1.6;color:var(--gray3)">«label»</span><i class="ph ph-«icon»" style="font-size:20px;color:var(--blue3)"></i></div>
<div style="font-size:28px;font-weight:800;line-height:1.2;letter-spacing:0;color:hsl(var(--bc));margin:8px 0 0">«۳ مرحله»</div>
<div style="font-size:12px;line-height:1.7;color:var(--gray3);margin:2px 0 0">«caption»</div>
</div>
</div>
```

### 8.5 Quick-action cards: MENU `type3`
Every card uses the same colours; only the icon, label and subtitle differ. There are three per row at 6xl and one per row on phones.
Use 3 or 6 cards (full rows).
**Page link:**
```json
{"id":"<uuid>","label":"«label ≤22»","subtitle":"«subtitle ≤40»","theme":"type3","cardMediaType":"icon","lucidIcon":"«Lucide»","bgColor":"hsl(var(--b1))","iconBgColor":"var(--blue)","textColor":"var(--blue4)","linktype":"page","side":"<sideId>","path":"<pageId>","filter":[],"value":""}
```
**Dialog form** (opens a Form view in a popup; used for request creation):
```json
{"id":"<uuid>","label":"«label»","subtitle":"«subtitle»","theme":"type3","cardMediaType":"icon","lucidIcon":"«Lucide»","bgColor":"hsl(var(--b1))","iconBgColor":"var(--blue)","textColor":"var(--blue4)","linktype":"dialog","dialogSize":"md",
 "dialog":{"label":"dialog","name":"<uuid>","content":{"name":"dialog","blocks":[
  {"id":"<uuid>","type":"TEXT","details":{"value":"<§8.2 page header without the border: eyebrow «ثبت درخواست», title = form name, one-line hint>"}},
  {"id":"<uuid>","type":"VIEW","details":{"value":{"value":"<formViewId>","expandTemplate":"<requestTemplateId>","displayListName":false,"viewToolbar":"invisible"}}}]}},
 "filter":[],"value":""}
```
Wrapper: `{"id":"<uuid>","type":"MENU","details":{"value":[ …items ]}}`.
- A form inside a dialog, inside an expand template, is "in side" because `isInSide` regex-matches the template layout
  (`View.ts:93`). Verify with the vendor account anyway (§12).
- Never MENU `type1` (subtitles are dropped, #7), and never GALLERYMENU image tiles.

### 8.6 Callouts
**8.6.1 TEXT callout.** Four variants; swap the token family and the icon:

| Variant | bg / border / title | icon |
|---|---|---|
| info | `var(--blue)` / `var(--blue2)` / `var(--blue4)` | `ph-info` |
| success | `var(--green)` / `var(--green2)` / `var(--green4)` | `ph-check-circle` |
| warning | `var(--yellow)` / `var(--yellow2)` / `var(--yellow4)` | `ph-warning-circle` |
| danger | `var(--red)` / `var(--red2)` / `var(--red4)` | `ph-x-circle` |
| neutral | `hsl(var(--b2))` / `var(--gray2)` / `hsl(var(--bc))` | `ph-info` in `var(--gray3)` |

```html
<div style="display:flex;gap:12px;align-items:flex-start;background:var(--blue);border:1px solid var(--blue2);border-radius:12px;padding:14px 16px;margin:8px 0">
<i class="ph ph-info" style="font-size:22px;line-height:1.5;color:var(--blue4)"></i>
<div style="flex:1 1 auto">
<div style="font-size:15px;font-weight:700;line-height:1.7;letter-spacing:0;color:var(--blue4)">«title»</div>
<div style="font-size:14px;font-weight:400;line-height:1.9;letter-spacing:0;color:hsl(var(--bc));margin:2px 0 0">«body, one or two sentences»</div>
</div>
</div>
```
**8.6.2 Callout SECTION with record fields** (for example «نیازمند اصلاح» plus the expert's comment, and a button). Use it inside templates.
The SECTION gives the tint; the TEXT inside is the callout **without** its own background and border:
```json
{"id":"<uuid>","type":"SECTION","details":{"value":""},"filter":[ «status filter» ],
 "color":"yellow","padding":"16","radius":"12","borderLine":true,"borderWeight":1,"borderColor":"yellow2",
 "section":{"label":"section","name":"<uuid>","content":{"name":"section","blocks":[
  {"id":"<uuid>","type":"TEXT","details":{"value":"<div style=\"display:flex;gap:12px;align-items:flex-start\"><i class=\"ph ph-warning-circle\" style=\"font-size:22px;line-height:1.5;color:var(--yellow4)\"></i><div><div style=\"font-size:15px;font-weight:700;line-height:1.7;letter-spacing:0;color:var(--yellow4)\">«title»</div><div style=\"font-size:14px;line-height:1.9;letter-spacing:0;color:hsl(var(--bc));margin:2px 0 0\">«body»</div></div></div>"}},
  {"id":"<uuid>","type":"RECORD","details":{"value":["<F:توضیح کارشناس>"],"fieldsTheme":"visibleTop","valuesTheme":"none","showFieldIcons":false,"immutable":{"<F:توضیح کارشناس>":[]}}},
  {"id":"<uuid>","type":"RECORD","details":{"value":["<F:button field>"],"fieldsTheme":"invisible","valuesTheme":"none","showFieldIcons":false}}]}}}
```
For info use `color:"blue", borderColor:"blue2"`; success `green`/`green2`; danger `red`/`red2`.
Don't use ALERT for new work: its string replace (#12) and fixed styling make it inconsistent. The existing ALERTs are replaced.

**8.6.3 "Suggested copy" marker chip** (decision 8). Put it at the end of any paragraph with unconfirmed facts:
```html
<span style="display:inline-block;padding:1px 10px;border-radius:999px;background:var(--yellow);border:1px solid var(--yellow2);color:var(--yellow4);font-size:12px;font-weight:600;line-height:1.6;letter-spacing:0;vertical-align:middle">متن پیشنهادی — نیازمند تأیید کارفرما</span>
```

### 8.7 Empty state
**8.7a Static TEXT** (intro pages; a list that is empty by design until something happens):
```html
<div style="text-align:center;padding:36px 16px;background:hsl(var(--b2));border:1px dashed var(--gray2);border-radius:12px;margin:8px 0">
<div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:999px;background:var(--blue)"><i class="ph ph-«icon»" style="font-size:28px;color:var(--blue4)"></i></div>
<div style="font-size:16px;font-weight:700;line-height:1.7;letter-spacing:0;color:hsl(var(--bc));margin:12px 0 0">«what is empty, positively phrased»</div>
<div style="font-size:14px;line-height:1.9;letter-spacing:0;color:var(--gray3);max-width:440px;margin:4px auto 0">«what to do next / when it will fill»</div>
</div>
```
**8.7b Record-conditional** (templates): a SECTION with no styling whose `filter` is `<F:count rollup> is empty` (or `is` `0`)
holds 8.7a, and a sibling SECTION with the opposite filter holds the list. Use this wherever a supplier rollup exists
(تعداد قرارداد، تعداد اعضا، تعداد زمینه فعالیت، تعداد پروژه).
**8.7c Plain lists:** Grid shows «رکوردی یافت نشد» by itself, while Gallery shows nothing. So every gallery has a helper line
(§8.3) that makes sense when the list is empty.

### 8.8 List blocks (always TitleDivider → helper line → VIEW)
**8.8a Portal read-only list** (suppliers and visitors):
```json
{"id":"<uuid>","type":"VIEW","details":{"value":{"value":"<viewId>","expandTemplate":"<templateId>","expandMode":"dialog","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"visible","newable":"denied","lockSettings":true}}}
```
**8.8b List with a create button that opens a form** (for example, adding a member to one's own profile):
```json
{"id":"<uuid>","type":"VIEW","details":{"value":{"value":"<listViewId>","expandTemplate":"<templateId>","expandMode":"dialog","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"visible","newable":"access","newForm":true,"newFormPage":{"id":"<uuid>","type":"VIEW","details":{"value":"<formViewId>"}},"buttenText":"«افزودن …»","buttonColor":"blue","lockSettings":true}}}
```
**8.8c Staff work grid** (collaborator portals):
```json
{"id":"<uuid>","type":"VIEW","details":{"value":{"value":"<viewId>","expandTemplate":"<templateId>","expandMode":"dialog","displayListName":false,"viewToolbar":"visible","showSettings":false,"showGroup":false,"showFilter":true,"showSort":true,"showSearchFields":true,"showPageSize":true,"viewFilterbar":"visible","downloadList":true,"newable":"denied"}}}
```
(For roles that may create records, use `newable:"access"` plus `newForm`/`newFormPage`, never `access` alone.)
**8.8d Related list inside a template** (record context only):
```json
{"id":"<uuid>","type":"VIEW","details":{"value":{"value":"<viewId>","expandTemplate":"<templateId or noExpand>","expandMode":"dialog","filterType":"in","filterInField":"<link field on the child table>","displayListName":false,"viewToolbar":"invisible","viewFilterbar":"invisible","newable":"denied"}}}
```
Views used by the existing templates are already filtered for their context (for example «… — این قرارداد»). Keep their current
filter mechanism; only restyle.

Rules for every VIEW: set `displayListName:false` (#32), set `viewToolbar`, set `newable` (#14), name an explicit `expandTemplate`
id (never `"default"` on user or visitor sides, DESIGN-GUIDE §8.1), and put no `filterType` on plain pages (#3).
View display (a view-level setting, shared by every block that uses the view):
- Text-heavy items (deals, news, invitations, FAQ): Gallery `layout[0].type:"featured"`, `featuredSize:"md"`, `featuredBorder:true`,
  `featuredShadow:false`, `featuredCardGap:12`, **no `brandField`** (#5 grey boxes), and at most 4 visible fields with the short
  identifying field first. Never `cards` (#1 justified text).
- Tabular items (requests, contracts, POs, members): Grid, at most 6–7 visible columns, newest first, status row colours (§2.3).
- Portal lists: `summaryFields` 0–1 and `freeSearch:true`.

### 8.9 Detail header (every expand template starts with this)
A card with the title on the right and status/meta on the left. Its fields are read-only.
```json
{"id":"<uuid>","type":"SECTION","details":{"value":""},"filter":[],
 "color":"base-100","padding":"20","radius":"16","borderLine":true,"borderWeight":1,"borderColor":"gray2","shadowEnabled":true,"shadowIntensity":8,
 "section":{"label":"section","name":"<uuid>","content":{"name":"section","blocks":[
  {"id":"<uuid>","type":"TEXT","details":{"value":"<div style=\"display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.6;letter-spacing:0;color:var(--blue4);margin:0 0 2px\"><i class=\"ph ph-«icon»\" style=\"font-size:18px;color:var(--blue3)\"></i>«entity label, e.g. درخواست تحویل کالا»</div>"}},
  {"id":"<uuid>","type":"COLUMNS2","details":{"value":""},
   "column1":{"label":"1","name":"<uuid>","splitter":62,"content":{"name":"1","blocks":[
     {"id":"<uuid>","type":"RECORD","details":{"value":["<F:title>"],"fieldsTheme":"invisible","valuesTheme":"none","showFieldIcons":false,"immutable":{"<F:title>":[]}}},
     {"id":"<uuid>","type":"RECORD","details":{"value":["<F:id1>","<F:id2>"],"fieldsTheme":"visibleSide","valuesTheme":"none","showFieldIcons":false,"immutable":{"<F:id1>":[],"<F:id2>":[]}}}]}},
   "column2":{"label":"2","name":"<uuid>","content":{"name":"2","blocks":[
     {"id":"<uuid>","type":"RECORD","details":{"value":["<F:status>","<F:date>"],"fieldsTheme":"visibleSide","valuesTheme":"none","showFieldIcons":false,"immutable":{"<F:status>":[],"<F:date>":[]}}}]}}}]}}}
```
Template document keys: `{"name":"","cover":"","maxw":"tw-max-w-5xl","align":{"value":"center","label":"وسط"},"showTitle":false,"blocks":[…]}`.
Then, in order: the stepper (§8.10) → the state panel (§8.6.2) → TABS of details (§8.15) → the staff panel (filtered to staff only, §7).
**One coloured level only:** no tinted SECTION inside a tinted SECTION (DESIGN-GUIDE §8.3.5).

### 8.10 Stepper (workflow position; TEXT, one variant per state)
Why not PROGRESS: PROGRESS turns **every** option of the state field into a step (including «ردشده»), it needs a singleSelect (the request
statuses are formulas), and it inserts status-changing «شروع» buttons (`ProgressBlock.vue:230`). So each state panel's SECTION starts
with a static stepper showing its own position.

Step styles:
- done: `background:var(--green);color:var(--green4)`, icon `ph-check-circle`
- current: `background:var(--blue);color:var(--blue4);border:1px solid var(--blue3)`, icon `ph-hourglass-medium`
- warning current: `background:var(--yellow);color:var(--yellow4);border:1px solid var(--yellow2)`, icon `ph-warning-circle`
- danger current: `background:var(--red);color:var(--red4);border:1px solid var(--red2)`, icon `ph-x-circle`
- upcoming: `background:hsl(var(--b1));color:var(--gray3);border:1px solid var(--gray2)`, a digit instead of an icon

Example: request, «در حال بررسی» (steps: پیش‌نویس، ارسال، بررسی کارشناس، نتیجه):
```html
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0 10px">
<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--green);color:var(--green4);font-size:13px;font-weight:600;line-height:1.6;letter-spacing:0"><i class="ph ph-check-circle" style="font-size:16px"></i>پیش‌نویس</span>
<span style="display:inline-block;width:16px;height:1px;background:var(--gray2)"></span>
<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--green);color:var(--green4);font-size:13px;font-weight:600;line-height:1.6;letter-spacing:0"><i class="ph ph-check-circle" style="font-size:16px"></i>ارسال به کارتابل</span>
<span style="display:inline-block;width:16px;height:1px;background:var(--gray2)"></span>
<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--blue);border:1px solid var(--blue3);color:var(--blue4);font-size:13px;font-weight:700;line-height:1.6;letter-spacing:0"><i class="ph ph-hourglass-medium" style="font-size:16px"></i>بررسی کارشناس</span>
<span style="display:inline-block;width:16px;height:1px;background:var(--gray2)"></span>
<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:hsl(var(--b1));border:1px solid var(--gray2);color:var(--gray3);font-size:13px;font-weight:500;line-height:1.6;letter-spacing:0"><span style="font-size:12px;font-weight:700">۴</span>نتیجه</span>
</div>
```
Stepper sets used (IA.md says which state shows which):
- **Request** (5 tables): پیش‌نویس → ارسال به کارتابل → بررسی کارشناس → نتیجه. نیازمند اصلاح = step 3 warning with the label «نیازمند اصلاح».
  تأییدشده = all done, last label «تأییدشده». رد یا لغو شده = step 4 danger with the label «رد یا لغو شده».
- **Supplier onboarding**: ثبت‌نام → تکمیل پرونده → بررسی کارشناس → فعال‌سازی. در حال تکمیل = step 2 current. در انتظار بررسی = step 3
  current. نیازمند اصلاح = step 3 warning («نیازمند اصلاح»). تأییدشده = all done.
- **Participation** (مشارکت من): اعلام تمایل → دریافت اسناد → ارسال پاکات → ارزیابی و نتیجه. The position follows the existing SECTION conditions
  (`ثبت درخواست`, `مرحله معامله`, `وضعیت مشارکت`).

### 8.11 Gate: locked card (unapproved suppliers)
Put the transactional content inside a SECTION with the **approved-and-active** filter. Directly before it, add the locked card SECTION with the
**not-approved** filter (§7). Both are unstyled SECTIONs (no colour or border); the card is TEXT:
```html
<div style="text-align:center;padding:36px 16px;background:hsl(var(--b2));border:1px dashed var(--gray2);border-radius:12px;margin:8px 0">
<div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:999px;background:var(--blue)"><i class="ph ph-lock-simple" style="font-size:28px;color:var(--blue4)"></i></div>
<div style="font-size:16px;font-weight:700;line-height:1.7;letter-spacing:0;color:hsl(var(--bc));margin:12px 0 0">این بخش پس از تأیید پرونده فعال می‌شود</div>
<div style="font-size:14px;line-height:1.9;letter-spacing:0;color:var(--gray3);max-width:460px;margin:4px auto 0">«page-specific sentence». وضعیت پرونده‌ی خود را در «پرونده من» ببینید.</div>
</div>
```
Follow it with a MENU type3 card «پرونده من» → page `<id>` inside the same locked SECTION. The header menu cannot be
filtered by supplier status (`SideHeader.vue` evaluates `userFilter` against the user, not the supplier record), so the gate lives
in the templates.

### 8.12 Form container
- Form v1 layout (a view setting): `title:""`, `description:""`, `logo:""` when the page, dialog or card already names the form. Set
  `button:{"text":"«ذخیره پیش‌نویس» or «ثبت درخواست»","color":"blue"}` (the submit button renders `blue4`). Set a `doneMessage` in
  one sentence with the next step. For request forms set `expandAfterSubmit:true`, `expandAfterSubmitMode:"dialog"` and
  `expandAfterSubmitTemplate:"<request template id>"`, so the new draft opens immediately with its «ثبت و ارسال» button. Keep
  inputs to 6–8, with a `description` only where the answer is not obvious.
- On a page: SECTION `{"color":"base-100","padding":"24","radius":"16","borderLine":true,"borderWeight":1,"borderColor":"gray2","maxWidth":"3xl","justifySelf":"center"}` holding the form VIEW
  `{"value":"<formViewId>","expandTemplate":"<tpl>","displayListName":false,"viewToolbar":"invisible"}`. For a form with guidance, use
  COLUMNS2 at `62`: the form SECTION on the right and an info callout (§8.6.1) on the left.
- In a dialog: §8.5 dialog variant (no SECTION).
- Known platform limit: in dark mode `blue4` is light (`#7dd3fc`), so a white submit label is low-contrast there. This is not fixable by
  configuration. Keep `themeButton` off.

### 8.13 Header JSON
**Website sides** (visitor, supplier):
```json
{"name":"«header.name»","logo":"<key horizontal-light>","darkLogo":"<key horizontal-dark>","toEnable":true,"headerMode":1,
 "hoverColor":{"enabled":true,"color":"var(--blue4)"},"themeButton":{"show":false},
 "dynamicButton":{"show":false},
 "menuItems":[ «IA.md menu tree; items: {"id":"<uuid>","title":"…","linktype":"page","side":"<sideId>","path":"<pageId>","link":"","children":[],"userFilter":[]}; a parent with children has "linktype":"" and no path» ]}
```
Visitor side only: `"dynamicButton":{"show":true,"action":"page","text":"ورود تأمین‌کنندگان","icon":"LogIn","iconPosition":"left","color":"blue4","side":"<id>","path":"<id>","openInNewTab":false,"hideAfterLogin":true}`.
**Sidebar sides**: the same keys, with `"logo":"<key mark tile>"`, no `darkLogo` or `dynamicButton`, and each menu item with
`"icon":"«Lucide»","iconColor":"var(--blue4)"`. Keep **every** existing key (read with `getSide`, merge, write); `menuItems` is
replaced.

### 8.14 Footer JSON (website sides)
**Visitor (full):**
```json
{"details":{"enabled":true,"backgroundColor":"hsl(var(--b2))","bottomBackgroundColor":"","linkHoverColor":"var(--blue4)","gap":24,"verticalGap":24,
 "columns":[
  {"id":"<uuid>","width":40,"widgets":[{"id":"<uuid>","type":"brand","title":"<نام برند>","titleSize":16,"description":"سامانه‌ی ارتباط با تأمین‌کنندگان شرکت ارتباطات سیار ایران. ثبت‌نام، شرکت در معاملات و پیگیری قراردادها و درخواست‌ها.","images":["<key lockup-light>"]}]},
  {"id":"<uuid>","width":30,"widgets":[{"id":"<uuid>","type":"menu","title":"دسترسی سریع","items":[
    {"id":"<uuid>","label":"فرصت‌های معاملاتی","linktype":"page","side":"<id>","path":"<id>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]},
    {"id":"<uuid>","label":"راهنما و پرسش‌ها","linktype":"page","side":"<id>","path":"<id>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]},
    {"id":"<uuid>","label":"ورود تأمین‌کنندگان","linktype":"page","side":"<id>","path":"<id>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]}]}]},
  {"id":"<uuid>","width":30,"widgets":[{"id":"<uuid>","type":"menu","title":"ارتباط با ما","items":[
    {"id":"<uuid>","label":"تماس با واحد تأمین","linktype":"page","side":"<id>","path":"<id>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]},
    {"id":"<uuid>","label":"درباره و قوانین","linktype":"page","side":"<id>","path":"<id>","url":"","openInNewTab":false,"bold":false,"userFilter":[],"children":[]}]}]}],
 "copyright":"© ۱۴۰۵ <نام حقوقی شرکت>. همه‌ی حقوق محفوظ است.","socialText":"","socials":[]}}
```
**Supplier (compact):** one column (`width:100`) with a `menu` widget: «راهنما و پشتیبانی» → `<id>`, «سایت سامانه» →
visitor `<id>`. Same `copyright`, same `backgroundColor`.

### 8.15 Tabs
```json
{"id":"<uuid>","type":"TABS","tabsBgColor":"base-100","details":[
 {"label":"«2–3 words»","name":"<uuid>","color":"base-100","bold":true,"userFilterTab":[],"content":{"name":"«label»","blocks":[ … ]}},
 {"label":"«…»","name":"<uuid>","color":"base-100","bold":false,"userFilterTab":[],"content":{"name":"«…»","blocks":[ … ]}}]}
```
Only the first tab is bold. Don't add SECTION padding inside tab panels (they already have 16px, #24). The tab is mirrored into the URL,
so it survives reload.

### 8.16 Result card (post-action page)
```html
<div style="text-align:center;padding:40px 16px 28px;background:hsl(var(--b1));border:1px solid var(--gray2);border-radius:16px;margin:24px 0 8px">
<div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:999px;background:var(--green)"><i class="ph ph-check-circle" style="font-size:34px;color:var(--green4)"></i></div>
<h1 style="margin:14px 0 0;font-size:22px;font-weight:800;line-height:1.5;letter-spacing:0;color:hsl(var(--bc))">«title»</h1>
<p style="margin:6px auto 0;font-size:14px;font-weight:400;line-height:1.9;letter-spacing:0;color:var(--gray3);max-width:460px">«body»</p>
</div>
```

### 8.17 Info card with rows (contact details, document checklists)
```html
<div style="background:hsl(var(--b1));border:1px solid var(--gray2);border-radius:12px;padding:16px 18px;margin:8px 0">
<div style="font-size:15px;font-weight:700;line-height:1.7;letter-spacing:0;color:hsl(var(--bc));margin:0 0 8px">«title»</div>
<div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--gray2)"><i class="ph ph-«icon»" style="font-size:20px;line-height:1.6;color:var(--blue3)"></i><div style="font-size:14px;line-height:1.9;color:hsl(var(--bc))"><span style="color:var(--gray3)">«label»: </span>«value»</div></div>
«…repeat the row…»
</div>
```

### 8.18 Three-step explainer (public home, onboarding)
```html
<div style="display:flex;flex-wrap:wrap;gap:12px;margin:8px 0">
<div style="flex:1 1 220px;background:hsl(var(--b1));border:1px solid var(--gray2);border-radius:12px;padding:18px">
<div style="display:flex;align-items:center;gap:10px"><span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:var(--blue);color:var(--blue4);font-size:14px;font-weight:800">۱</span><span style="font-size:15px;font-weight:700;line-height:1.7;letter-spacing:0;color:hsl(var(--bc))">«step title»</span></div>
<div style="font-size:14px;line-height:1.9;color:var(--gray3);margin:8px 0 0">«one sentence»</div>
</div>
«…steps ۲ and ۳ identical…»
</div>
```

---

## 9. Page shells (every page is one of these)

| Shell | Blocks in order | `maxw` |
|---|---|---|
| **Landing / dashboard** | Hero 8.1 → KPI 8.4 → TitleDivider «دسترسی سریع» + MENU 8.5 (3 or 6) → 1–3 list sections (8.3 + 8.8) → boards full width at the end | 6xl |
| **List** | Page header 8.2 → (callout 8.6 if the page has a rule) → TABS 8.15 or a single list section → view(s) | 6xl (7xl for a Kanban) |
| **Form** | Page header 8.2 → COLUMNS2 62/38: form SECTION 8.12 · callout + checklist 8.17 → TitleDivider «… اخیر من» + list 8.8a | 5xl |
| **Record portal page** (supplier) | Page header 8.2 → ExpandRecord (the template carries everything else) | 6xl |
| **Detail template** | Header 8.9 → stepper 8.10 → state panel 8.6.2 → TABS 8.15 → staff panel | 5xl |
| **Content / article** | Page header 8.2 → TEXT sections with TitleDividers → contact card 8.17 | 4xl |
| **Result** | Result card 8.16 → MENU 8.5 (2–3 next steps) | 4xl |

---

## 10. Anti-bug checklist (tick per page and template before publishing)

| # | Check | Bug avoided |
|---|---|---|
| 1 | `content.name:""`, `cover:""`, `icon:""`; the first block is a hero or page header | #20 empty title strip, duplicate titles |
| 2 | No hex outside the hero; every TEXT colour is a token; no `var(--base-*)` or `var(--primary)` | #11 dark mode, undefined vars |
| 3 | No `tw-*` or Quasar classes in TEXT (only `ph ph-*`) | #10 un-compiled classes |
| 4 | Every `h1`/`p`/`div` with text sets size, weight, line-height, margin and `letter-spacing:0` | #9 heading sizes |
| 5 | No `<style>`, `<script>`, `on*=`, `<img>`, `<a href>` to internal pages, `position:` | security, full reloads, leaks |
| 6 | Every TitleDivider has `showButton:false`, or a real page link with the pale button; title ≤25 characters | #6 dead «مشاهده همه» |
| 7 | Every VIEW has `displayListName:false`, `viewToolbar`, `newable`, an explicit `expandTemplate`; creation only through `newForm` | #14 empty records, #32 |
| 8 | No Gallery `cards` for text; no `brandField` on portal galleries | #1 justified text, #5 grey boxes |
| 9 | Kanban and Calendar never inside COLUMNS2/SECTION `maxWidth`; page `maxw` 7xl | #2 clipped Kanban |
| 10 | MENU only `type3`, with `iconBgColor` and `textColor`; no GALLERYMENU | #7, #8 |
| 11 | STATS `color:""`, `field` set; supplier STATS start with `has my mobile` | #16, #19, #30 |
| 12 | RECORD on read-only views: `immutable` for each field, `showFieldIcons:false` | #25 |
| 13 | `filterType` only in templates; SECTION filters only in templates (or `[role]`) | #3, #18 |
| 14 | Each template used on a user or visitor side has that side in `sides`; the page is published | #4 empty boxes |
| 15 | No ALERT in new work; no `justify:"justify"` on SECTION | #12, #33 |
| 16 | Form layouts have a button text, and `title:""` when named by the page | forms say «ارسال» |
| 17 | Mobile (`MOBILE=1`): COLUMNS stack, cards wrap, no horizontal scroll | – |

---

## 11. Build procedure notes (for the implementation phase)

1. Build page and template JSON in scripts under `build/steps/<agent>/` with `L.updatePage` / `L.updateExpand`, following `LIB.md`
   (DRY=1 first). Generate every block id with `crypto.randomUUID()`.
2. Keep TEXT HTML in the script as template literals, and join the lines with `.replace(/\n/g,"")` before writing.
3. Read current ids with getters. The `IA.md` Appendix A ids come from a snapshot taken on 2026-09-24.
4. After each portal: run `node build/shot.cjs <role> shots/after <side>/<page> …`, both desktop and `MOBILE=1`, then look at the images.
   For dark mode, set `localStorage.theme='dark'` in a copy of shot.cjs.
5. Apply `preferences.palette` **first**, so that every screenshot after it shows the final colours.

## 12. Preview

`preview/` holds `components-light.jpg`, `components-dark.jpg` and `components-mobile.jpg`: every TEXT component in this file, rendered in
the running app (`localhost:9003`, visitor home page) with the `alternative2` theme applied client-side. `preview/render.cjs` re-renders
them from the ```html blocks of this file. It writes nothing to the base.
