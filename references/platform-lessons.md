# Airsheet platform lessons (learned the hard way on the first redesign)

Each line is something that silently produced a wrong result at least once. Code locations are from 2026-09; re-check
before quoting them to anyone.

## Environment and safety

- **"Local" Mongo/Redis/Splunk may be SSH tunnels to the team's shared test server.** Check with `ss -ltnp` and `ps`
  before the first command. Every write is real and visible to colleagues; colleagues also edit the same bases while you
  work (a teammate's edits appeared mid-project twice; one removed a form section from a home page).
- **`/tmp` is RAM on the workstation and is wiped on reboot, and the scratchpad lives under it.** A reboot deleted every
  research file once; they were rebuilt from agent transcripts. Put every lasting output in `<work>/` from the start.
- **Any script that imports record or field resolvers becomes a Bull worker** on the shared `Automation` queue (cron
  jobs of every base). `lib.ts` neutralises `Bull.prototype.process` before loading app modules; early scripts that did
  not were workers for 20-35 s each.
- **Raw snapshots of a base contain real API keys** (in automation action URLs, and also in button-field `actions`).
  Keep them in `<workspace>/snapshots-private/` (mode 700), never under `documents/` or `<work>/`. The dump
  tool redacts the whole output, not just automation actions.
- **Claude's safety layer refuses** extracting passwords/credentials from transcripts, matching people's mobiles to
  accounts, and deleting records nobody explicitly approved. Create test accounts (with the user's approval) instead of
  borrowing real ones, and get explicit approval per deletion.
- **Concurrent-session cap per user** («محدودیت تعداد نشست‌های همزمان»): many headless logins with one account lock it.
  Reuse a saved login per role (`shot.cjs` does), give parallel agents different accounts, and clear sessions before a demo.
- Claude's permission classifier treats editing a **shared** helper (e.g. adding functions to `build/lib.ts` while other
  agents use it) as "Modify Shared Resources" and refuses it mid-run; the demo-data run stopped at G2 for that. Get the
  user's approval for every lib addition before launching the agent that needs it, and give it the approved file.
- More than two parallel headless browsers made pages capture half-loaded and repeated logins hit the captcha.
- **Know which code the running dev server executes before debugging it.** Once the server on :3000 ran from a
  different checkout (`<another-checkout>/cloud-back`, an automation-refactor branch) than the one the scripts used
  (`<workspace>/cloud-back`, develop), and another session was committing in it every few minutes. Check
  `readlink /proc/$(ss -ltnp | grep -o 'pid=[0-9]*' …)/cwd`, its branch and `git reflog`; never edit a checkout another
  session is working in — hand over the diagnosis and the patch instead.
- **Automation actions carry API keys inside URLs** (`…/processes/<id>?apiKey=<key>`) and payloads. A "read-only"
  summary that printed `options.url` leaked two keys into a session transcript. Print URLs with the query stripped
  (`url.replace(/\?.*/, "?…")`), never whole `options`, and keep full action backups in `snapshots-private/`.

- **Own the checkout your build runs from.** Mid-build, another session switched the shared cloud-back checkout to a
  branch where `modules/automation/models/*` had moved; every `lib.ts` import failed. Run build steps from a git worktree
  you own (detached at the build's commit, `node_modules` symlinked, `.env` copied).
- **Waiting on a background step:** `pgrep -f "<script name>"` also matches the wait loop's own command line (it never
  ends), and `pkill -f` with that string kills the shell running it. Wait on the PID.
- In zsh, `$VAR` holding several ids is passed as one argument; use `${=VAR}` when feeding page lists to scripts.

## Access model (what AI atlases got wrong)

- Empty `canview` on a table means **owner only**, not "everyone".
- A portal user (side type `user`) gets in via `userrole.accreditView` (who may log in at all); `userProperty=mobile`
  matches by **substring** on a text field (mock mobiles must not contain each other). `recordrole.canedit` holds field
  ids, `canadd` holds table ids.
- `has my mobile` on a view is a **display filter, not a security boundary.** Any view used as a link-field picker, placed
  on a portal page, or reachable by id is readable by portal users: keep a user-scope filter on each and send only the
  fields the card needs.
- A view shown to both staff and portal users cannot carry `has my mobile` (staff searches send the view's own filters).
  Make a copy «… (پرتال)» plus a template limited to the portal side; check with `scripts/portal-invariant.ts`.
- Self-registration depends on the **server-wide** `auth.register.enable`, not on `base.preferences.signup`.
- **Field `canedit` is not applied on create** (`record.ts` create: «TODO: check access»), so form defaults for fields
  a role may not edit still land. **On update** only `canedit` fields survive, plus the clicked button: a button's
  `doneProcess` / `signs` writes happen in the invariants after the permission filter. So a status field can be
  locked to an oversight role while buttons still move it.
- **Split portal record roles per actor.** One record role on «requester, supervisor, manager» mobiles gives the
  requester edit rights on the approval buttons of their own request (only the UI hid them). Use one role per actor on
  a plain-string formula field (`@{lookup mobile} . ""`); when routing never makes the requester the approver, the
  "last match wins" rule never conflicts. Re-test child-row edits through the parent token afterwards.
- Menu items carry their own `userFilter` with `[role]`: the panel menu may be role-filtered even when `side.roles` is
  empty. Check before reporting "menus are not role-based". TABS take the same filter in `userFilterTab`, which works on
  plain pages.
- Status locks you build with conditions are UI-only; the server does not enforce `candelete`, row ownership, or
  "editable only while draft". Say so in the report instead of promising it.
- Platform holes seen (fix in code, not config; list them in the product-feedback file): views requested with
  `blockId "-"` skip the side check (anonymous read of any view); `searchAPI` with `recordId` returns the full record;
  `contextCriteria` is client-controlled; `sharedStats` trusts client table/filter; `drecords`, `uautomation`,
  `uaction`, `caction`, `createConstraint` lack base auth; TEXT blocks render unsanitised `v-html`.

## Automations

- `update` automation with `fields=[]` and `allFields=false` **never fires**.
- `form` automation fires only if `forms` contains the id of **the form view actually used**; rebuilding views breaks it.
- `cron` runs once with `record={}`; per-record reminders need `period`.
- `update` automations ignore automation-level conditions and fire on every write to a watched field, even unchanged:
  put the guard in the **action** condition. All actions evaluate the snapshot at click time.
- Keep every automation **inactive** during a build (`ALLOW_LIVE` guard in lib). Verify wiring statically with the
  engine's own evaluators (`filter.match`, `automation.test`) — see verification.md. Before go-live: test providers,
  one manual run per process, read the run log, and run each sync once **before** enabling its status SMS (one table had
  483 open requests: an SMS flood waiting to happen).
- **Engine facts** (cloud-back `automation/resolvers check()`, develop 2026-10): one automation = one trigger type + one
  table; actions run in order, each with its own conditions, all evaluated on the triggering record's snapshot;
  `match` fires when a record *starts* matching (also on create); `update` fires when a watched field is in the write's
  change list and **never on create** (`modifiedtime == createdtime` is skipped, which also skips lookup/formula writes
  right after a create); formula recomputes write a change list, so a formula field can be watched; `cron` actions get
  `record = {}`, so action conditions on a cron always fail. `updateRecord` values take `{record:<fieldId>}` and
  `{time:now}` templates. There is no "field X changed" operator: `is clicked` reads the button's stored state.
- **Read nested conditions before calling one broken.** A summary that flattened a children group printed
  «روز تا مهلت = ۲ & = ۱» for a condition that is really «۲ **or** ۱»; the reminder had been reported as dead to the user
  and had to be retracted.
- **Scheduling (develop since 2026-10-02):** the hourly interval accepts an hour window in the UI («از ساعت / تا ساعت»,
  cron `A-B/N`, e.g. `1 10-18/2 * * *` replaces five «at 10, 12, 14, 16, 18» automations); `startDate`/`endDate` limit
  any scheduled automation to a date range (the job is skipped outside it, like an inactive one). REST API responses
  mapped to an attachments field keep file names when each file is `{fileName, content}` or a data URI with `name=`;
  a bare base64 string is still saved as `file.<ext>` (customers used to zip files to work around it).
- **Consolidating automations** (one base went from 60 to 27; playbook.md «Automation consolidation»): every fetch with one schedule
  goes into one cron automation; send, resend, status inquiry and per-status SMS of one request table go into one
  `update` automation whose actions are made mutually exclusive by state (tracking code empty or not, «resend» = yes or
  not, «sent at» empty or not). Status SMS without duplicates: a text field «notified» plus a watched formula
  `if(key!=notified, key, "")`; SMS actions are conditioned on the formula's value and a last `updateRecord` sets
  notified := `{record:<formula>}`. Backfill «notified» on existing rows before activation, or every old request gets
  an SMS for its current status.
- **A `create` trigger sees no lookups or formulas yet**: a message whose recipient is a lookup goes nowhere. Use
  `match` on «status is X and recipient is not empty».
- **Recipients from a settings table.** Customer-supplied recipient lists (experts, internal affairs, …) live in a
  one-row «تنظیمات» table that relevant tables link to; actions use `@{lookup}`. An empty `to` fails «no recipient» once
  active.
- **In-app notification reaches only some users depending on the branch:** `automation-hardening` resolves recipients
  through `baseMemberByMobile` (base collaborators only, `pushNotification.ts:112-122`), develop through
  `User.findOne({mobile})`. Portal users are not collaborators: test portal notifications on the branch that will ship,
  or use SMS.
- Automation scenario checks with `filter.match` need `table` on the constructed record (field types load from it).
- The nightly 02:00 Tehran cron (22:30 UTC) recomputes `now()` formulas and writes "system" events: not a user change,
  and don't run bulk deletes/restores within 30 minutes of it.

## Filters, views and the query builder

- The query builder **silently drops** a condition it cannot compile for the field type (e.g. `has my mobile` on a
  rollup) and the view returns every row. Test every portal filter as a real user and as anonymous
  (`scripts/view-count-as.ts`).
- `is not` compiles to Splunk `field!="x"`, which drops rows where the field is empty (299 of 300 once). Use
  `does not contain` or `is none of` when empty rows must stay.
- **Link filters «has any of [id]» compare `_id` only when the operand is uuid-shaped**; any other id (`MOCK-x`,
  `DEMO-x`, an ObjectId) is compared with the link's `primaryFieldValue` and matches nothing. Every record-context
  list (`filterType:"in"` + `filterInField`) sends the parent id this way, so **records that are link targets must have
  uuid ids**. Readable seed ids emptied every related list of a demo; fixed by re-seeding with
  deterministic uuids plus a MOCK-id → uuid map.
- `filterType`/`filterInField` only work with a record (templates, ExpandRecord, form v2); on a plain page they yield an
  empty list. SECTION conditions on plain pages: only `[role]` works; everything else counts as true.
- A list VIEW inside a MENU/TitleDivider **dialog** of a template on a `user` side is refused by searchAPI («خطا در
  آوردن داده‌ها»). Put lists in TABS/SECTIONs or on a page; forms in dialogs are fine.
- A view is visible to portal users only if it is in a **published** page of that side, a template whose `sides`
  contains the side, a link field's `linkView`/`linkForms`, or a share. Draft pages grant nothing.
- STATS items need a real `field` id even for `count`: a STATS item saved with `"field":"undefined"` (string) counts a
  field literally named "undefined" and always shows 0. Portal STATS run as `sharedStats`: start every filter with the
  user-scope condition or the tile shows global counts.
- Staff-queue filters that hide test names (e.g. contains «تست», «آزمایشی») also hide demo data with those words: name
  demo companies realistically.

## Reports, validation, signatures and formulas (verified 2026-10)

- **Pivot2 and Dashboard cannot group by a link field** (records, or lookup of records). `stats.ts` runs
  `stats … by <field id>`; link values are arrays (`<id>{}.primaryFieldValue`), so every row lands in one «-» group and
  charts stay empty. Group by a text formula copy (`@{اداره ثبت} . ""`), which flattens to the names. Text, formula
  and lookup-of-text fields group fine. `lint-base.cjs` flags it.
- **The `line` chart type rendered nothing** where `bar` with the same data worked (develop 2026-10). No other base on
  the server used `line`.
- Shapes, read from existing views (re-check on your server): Pivot2 `layout:[{type:"new", reportTitle,
  rowFields:[{field}], colFields, measures:[{field, function: sum|count|avg|min|max|median, format, title}],
  rowSubtotal:{level,label}, …}]`; Dashboard `layout:[{type, by, stats: "count"|"summary", field, aggregate:
  "Sum"|"Average"|…, title, x, y, w, h, i, …}]`; Calendar `[{calendarType:"monthly", timeField}]`; Gantt
  `[{startTimeField, endTimeField, titleField, colorField, zoom, …}]`; PROGRESS block `details:{stateField,
  direction:"horizontal", states:[{label, name, content:{blocks:[]}}]}` (shows every option of the select, in order).
- **Constraints compare against other rows only** (`constraint.ts` check: filters with field operands are filled from
  the written record and searched among the others; any hit rejects). They express uniqueness and conflicts, never a
  rule on the row itself. Use `operandType:"field"` and `table:true` so an empty value skips the rule. A rule like
  «only if this row is occupying» cannot be expressed; use the picker plus a control view.
- **Per-row value rules are field `limits`**: strings `{"key":"min"|"max"|"onlyPositive"|"pattern"|"minLength"|…,
  "value", "error"}`; `pattern` takes a name (`email`, `numeric`, `nationalCode`, …).
- **Who approved and when**: a `signature` field plus a `signs` action on the button (`{type:"signs", fields:[id]}`
  before the `doneProcess`) stamps `{status:"signed", signedby, signedtime}`; seed it the same way. Conditions on a
  signature need **«is signed» / «is not signed»**, because «is (not) empty» never matches. An empty signature in a
  read-only RECORD still shows a «درج امضا» button, so show each signature inside a section «is signed».
- **The JS formula fallback cannot read link fields.** A formula that reads a formula containing `timeFormat` goes to
  the fallback; if it also reads a link field it fails («unsupported token '») and is never computed, with only a log
  line. A budget key «اداره . سال مالی» was empty from day one, so its linking automation could never work. Compute
  dates in SPL instead: Jalali year `tonumber(substr(d,1,4)) - if(substr(d,6,5)>="03-21",621,622)` (Nowruz assumed
  21 March); day number `floor(strptime(substr(replace(d,"/","-"),1,10),"%Y-%m-%d")/86400)`; today
  `floor((now()+12600)/86400)`.
- Rollup aggregations available: SUM, MAX, MIN, AVERAGE, COUNT, LATEST, CONCATENATE, ARRAYJOIN, ARRAYUNIQUE.
- New lookups and formulas on a table with rows take 20-90 s each to create (recompute); a formula over link lookups
  is the slowest. Budget the time, and run long steps with `nohup` and a PID wait.

## Records, writes, backup and garbage collection

- Change records only through resolvers (`drecords`, `updateCell`, `urecords`) with Redis connected
  (`getRedisClient().connect()`), otherwise the notify effect throws after the write already happened and a retry
  duplicates it. `lib.run()` handles this.
- `updateCell` with a record id from **another** base creates that record in the target base (cross-base upsert).
- `urecords` (bulk upsert) skips automations, keeps client ids, but drops computed values and system keys, stamps a new
  `createdtime` and **draws new autonumbers** for ids that are not live — fine for reference/mock data, lossy for a
  restore.
- `drecords` writes tombstones; the hourly GC then physically removes the old events from `index=main` about an hour
  later. After that the only copies are your export, the app backup and `index=history`. Prove the export before deleting.
- The app's `startRestore` overwrites **structure** too (every design change since the backup is reverted), never removes
  newer records, swallows per-entry errors and still reports `finished`. Backup: yes. Restore: re-post raw events
  (demo-data.md).
- `master.runMutation` with a **one-event** array caches that record (`record:<base>-<id>`, 600 s) but does not bump the
  table's `modifiedtime:<table>:records`; with **several events** it bumps it. Re-post restores in multi-event chunks of
  one table; a table with a single row needs an explicit decision (demo-data.md).
- The hourly GC may not run on the test server at all (three `garbages` docs outlived two hourly slots): record which is
  true before relying on either behaviour.
- Attachments live in S3; records hold metadata only, and nothing deletes files. Migrated attachments may still point to
  the OLD base's folder: never delete the old base.
- **A base the customer emptied** has 0 events in `index=main` (not tombstones). Content you still need (reference
  tables, your own site content) comes back from the latest non-deleted version per id in `index=history`
  (`… earliest=0 | dedup id`), re-posted with `restoreRaw` so ids stay and mock rows can keep linking to them.
- `createdAt` on bases/docs can be a restore/import date; the real creation time is the ObjectId timestamp (first 8 hex).
- `integrityHash` (tables, fields, roles…) is computed over access fields only; a raw write that breaks it makes the next
  read set `isBlocked=true` on every listed role — base-wide lockout. Never write those collections raw.

- **Mock row keys must be stable.** A demo script that numbers rows with a global counter re-keys every later row when
  you insert new rows before them; `importRows` then creates duplicates under the new uuids (50 doubled document
  rows doubled the stock once). Give new rows their own key prefix and check the row count against the id map after
  each seed.

## Logs and forensics

- `index=behavior`: who called which API on which object, but **no before/after values**. `index=history`: previous record
  versions. `index=main`: latest record version only. Previous **structure**: only the base backup in S3
  (`backuptasks.backupFileKey`); local Mongo has no oplog.
- The behaviour logger sends in batches of 10: the newest events may not be in Splunk yet.
- Query: `search index="behavior" "<baseId>" earliest=… | spath api | spath path=actorLog._userId output=uid | stats count by api uid`.

## Pages and rendering (details in design-guide.md)

- **Opening a page or template in the editor as the owner rewrites its blocks** (`ViewAppContext.vue:157-188`): a VIEW
  in a record context without `filterType` gets `filterType:"in"` + the first link field to the record's table (often the
  wrong one), which empties the list; a Form gets `autoLinkField`; TitleDividers, toolbars and side headers get their
  defaults. Give every list block an explicit `filterType` (`"none"` when unfiltered) and every form in a template its
  `autoLinkField`, and write the editor's defaults into your scripts so a re-run after someone opened the page is a no-op.
- **Opening a record dialog as the owner** also rewrote that expand template (page settings `maxw`, `align`,
  `background` dropped). After screenshots taken as the owner, re-run the pages step; `DRY=1` shows the drift.
- Page `content.name` prints a title strip; set `""` when a hero or header exists. First-block `ExpandRecord` disables the
  page's `maxw`, cover and title.
- Gallery `cards` justifies text with grey labels; use `featured`/`news`. A cover field with an empty row draws a grey box.
- TitleDivider `showButton` defaults to true with a dead «مشاهده همه».
- A «جدید» button without `newForm` creates an **empty record** immediately; set `newable` on every list.
- On a short page the footer is pushed below the fold (`NotionViewer` min-height), so short pages look unfinished.
- `nextmeta` does not send `palette` to anonymous visitors: the public site shows the default blue (one-line code fix).
- Gallery `featured`, `cards` and `news` render **nothing** for an empty list (no empty state); once an empty
  `featured` block stayed a grey loading skeleton in a screenshot. Fill every list with data, or hide the block with a
  record-conditional SECTION.
- Gallery `featuredImagePos` is physical, not logical: in RTL the stored `"right"` puts the image on the visual LEFT
  (the settings panel labels it «چپ»), which Persian readers prefer. `news` rows have no such option (image at the row
  start = right). One card per gallery in a `featured`/`cards` grid leaves the row mostly empty: for lists of 0–3 items
  (inbox-like "needs action" tabs, invitations) use `news` rows. `cardsHorizontal` is a Swiper carousel with arrows and
  dots (what customers mean by "like this news strip"); `featuredHero` shows only the image until `heroFields` is set.
- Link pickers: `uview` cannot change a view's `type`. To make a picker a gallery, create a Gallery copy (same filters,
  sorts, pageSize) and re-point the field's `linkView` and `linkViewRules[].view`.
- **A link picker inside a form must be a Gallery view.** With a Grid as `linkView`, the form's picker dialog lets the
  user tick rows but never passes the selection back to the field (the Grid does not use the picker's injected
  selection; the Gallery does). Seen in form v2, 2026-10.
- **On-demand external data in a form** (form v2 block «جدول از API», where the platform has it): the server calls the
  external API while the user fills the form, shows the rows as a table and, on submit, creates one child record per
  filled row. URL, headers and keys live server-side (`FormApiSource`, owner-only, masked on read); link values in the
  request are read from records the user may pick, so the picker field needs `linkViewEnable` + a user-scoped
  `linkView`. Prefer it over syncing every external row into a table when the customer's data must not be stored or
  when only the current user's rows may be visible. Store the values the child row must keep (price, remaining
  quantity) in plain snapshot fields.
- A `user` side switched to `layoutType:"sidebar"` shows a house icon for every menu item until each
  `header.menuItems[]` gets `icon` (Lucide name) and `iconColor`; its layout also calls the owner-only `sides` query
  (harmless 403 in the console).

## Page HTML sanitiser (cloud-front 5b1968b5e, 2026-10-15)

- Every stored HTML value (TEXT, ALERT, generated text, long-text cells, titles) reaches the DOM only through
  `v-safe-html` → `sanitizePageHtml` (`src/utils/pageHtml.js`, sanitize-html). Inline styles are filtered to a whitelist:
  color, background-color, text-align, text-decoration, font-size/weight/style/family, direction, width, height,
  max-width, max-height, aspect-ratio, margin, padding, border, border-radius, display, vertical-align. Any value with
  `url(` or `expression(` is dropped, as are the classes fixed/absolute/sticky/fullscreen/inset/z-/top-/bottom-/left-/right-.
- Everything else disappears silently: `background` shorthand (so gradients and photos), position, overflow, min-height,
  line-height, opacity, gap, grid-template-*, flex-wrap, text-shadow, box-shadow. `<a href>`, `<img src>` (http/https/data)
  and the TEXT_TAGS / SVG_TAGS lists survive. The sanitiser existed before (69952fb9e, 2026-10-04) but allowed those
  styles, so screenshots taken before 2026-10-15 are no evidence that an HTML hero still renders — check
  `git log -- src/utils/pageHtml.js` before trusting old captures.
- Consequences for a build: photo hero / banner = SECTION (`backgroundImage` full URL, `padding`, `radius`, `filter: []`,
  a TEXT child with white text) with the tint baked into the JPEG (`scripts/darken-hero.py`), asset-pipeline A5; card
  grids = COLUMNS3/4 (`column1..4 = {label, name, splitter, content:{name, blocks}}`, nested splitter 33/50 or
  25/33/50); flat colours via `background-color`; buttons and chips as `display:inline-block` with margins; a round
  badge centred with padding instead of line-height. A SECTION's children render through NotionViewer inside the padded
  box, each block with its own `px-4 py-2`.
- Two adjacent STATS blocks are two independent grids (`repeat(auto-fill, minmax(180px, 1.9fr))`, or centred equal-width
  flex rows when the page is centre-aligned), so 4 + 6 tiles render as 4 / 5 / 1 rows: put all tiles in one STATS block.

## Uploads, images and backgrounds

- A script uploads with `L.uploadFile` (= `uploadBase64`, the body of the `upload` mutation). It writes to the shared S3
  for real and nothing deletes it: upload each asset once and keep the keys. `base.preferences.maxImageSizeKB` is enforced
  only in the browser, so a script must keep files small itself. Filenames: no spaces, commas or `@#$%()`.
- Slots differ: page/table cover, side logos, `base.logo`, footer images take the **key**; page `background.value` and
  SECTION `backgroundImage` are used verbatim in `url('…')` and need a full URL (`<S3 host>/cloud-uploads/<key>`), which
  is bound to one server. A relative `/cloud-uploads/…` works only behind a same-origin proxy (one old base had 71 of
  them broken on localhost). The local frontend hard-codes the S3 host when served from `localhost`.
- Portable background values: a site path (`/img/page%20bg/background4.webp`), a `data:image/svg+xml,` URI with no single
  quote and `#` as `%23`, or a CSS colour token. Opaque photos break dark mode; transparent SVG follows the theme.
- Record attachments (gallery covers) need the attachment object with `thumbnails` as an object, not the JSON string the
  upload returns. Only `image/*` gets a thumbnail; the gallery always shows the thumbnail.
- The `upload` mutation has no auth or base-membership check (product bug, listed in the feedback file).

## AI atlases and customer descriptions

- An AI-generated atlas gets the counts right but **guesses behaviour from appearance**: a table named «تست» hosted the
  critical contracts cron; a fetch automation it called active was off; three "processes" were one table with a type
  field. A base rebuilt from the atlas inherits those errors. Build the catalogue from the live base.
- Check inputs for duplicates (`md5sum`): two differently named docx files were identical; a PDF was the transcript of
  the voice notes.

## Lessons from the SafarClub build (2026-10, develop 7f263571 / automation-hardening f07ec397)

- **Links are one-directional.** A `records` field has no mirror on the other table. Lookups and rollups join through a
  link in either direction (`recordFieldsToFrom`), but `filterInField` lists in a template need the link on the **listed**
  (child) table, and «create inside the form» fills only the **parent-side** link. Decide the direction per pair before
  writing fields: child→parent for anything listed in a template or rolled up; parent→child only for pickers.
- **Per-field permission writes are slow (10–20 s each, even on an empty table).** Use the UI's bulk `ufields`
  (`editAll`: table × role × "edit"|"view"|other) through `L.call`, then `updateField` only for the restricted fields.
- **`cfield` with `limits` and `createConstraint` log an `error: null` line in `changes.log` although the object was
  saved**: the GraphQL read-back throws. Verify by listing, don't retry.
- **DRY runs of multi-phase scripts**: a step that references objects created earlier in the same dry run (a link, a view, a
  user role) fails with «not found» / `Cast to ObjectId failed for "undefined"`. Register a stub per created name in
  dry mode, or run those steps for real (they are idempotent by name). Never cache a dry-run upload key: `uploadFile`
  returns `DRY/…` and the real run would reuse it.
- **A bash runner whose function ends with `grep -q … && { … }` returns 1 when the grep misses** and `|| exit 1`
  silently stops the chain after the first step. End the function with an `if` and `return 0`.
- **Seeded rows via `urecords` may get their rollups but not their lookups on the first write** (payouts' host mobile
  stayed empty, the `has my mobile` scope then returned 0). A second upsert of the same ids computed them; check every
  user-scope formula with `view-count-as.ts` after seeding.
- **Computed money shows six decimals** (`"4500000.00000"` from rollups, `"4.00000000000"` from date arithmetic);
  `round()` in the formula does not change the stored string. Set `format:"quantity"` (+ `symbol`) on every money
  rollup/formula field; the UI then prints `۴,۵۰۰,۰۰۰٫۰۰ ریال`.
- **Formula field refs are `$<fieldId>$`**; lookups are multi-valued (`mvindex($id$,0)`), `time_to_seconds(` is not
  translated to SPL (use `strptime(substr(d,1,10),"%Y-%m-%d")`), dates are stored Gregorian `YYYY-MM-DD[ HH:mm]`.
- **filter engine (`filter.match`) quirks** (verified with scenario tests): text/lookup/formula fields have no «is any
  of» (the condition is silently true → use an OR `children` group); numeric 0 fails every number comparison (`if (data)`),
  while the string "0" passes — formula outputs are strings, number fields are numbers.
- **Kanban** columns come from the field's `possibleValues`; a view filter hides cards, never columns. Calendar accepts
  only native `date` fields (copy lookup dates into native fields by automation); Gantt accepts lookups.
- **Period automation conditions take literal operands only**; a threshold «N days from a settings table» is impossible.
- **Autonumber has no prefix option.** SMS/notification actions keep `to` and `message` at the action's top level
  (notification `to` is a mobile string); `createRecord` needs `options.record.base/table` and `action.table`.
- The dev server on :3000 can disappear mid-build (another session). For screenshots, run your own backend from the
  build worktree (`.claude/launch.json` + preview_start) at the same commit.

## Lessons from the SafarClub upgrade (2026-10-14, develop a2cc1d346)

- **The base's engine is a server-internal hostname and the shell proxy eats it.** `master.getEngine(baseId)` returned
  `https://cloud-log:8089` (resolved by /etc/hosts to the tunnel) while the default engine is `127.0.0.1:8089`. With
  `HTTPS_PROXY` exported and `NO_PROXY=localhost,127.0.0.1`, every base-scoped `runQuery` (lib `listRecords`,
  `updateRecord`, `exportRecords`) answered **503** and `splunk-query.ts` (engine "") worked, which looks like a Splunk
  outage. `export NO_PROXY=$NO_PROXY,cloud-log` fixes it; keep it in `build/env.sh`.
- **`base.owner` does not exist**: the Base model has `creator` and `owners[]`. `dump-base.cjs` now prints `owner` =
  creator so `project.json` can be rebuilt from a dump when the build folder is gone.
- **A `count` field joins only through a real `records` field.** `rollupJoin` pointing at a text lookup («شهر») or at a
  lookup of records («شهر (لینک)», whose values even look like links) yields 0 on every parent, and changing the join
  does not recompute existing rows (touching the parent row did not either). The fix is a `records` field on the child
  (backfilled from the lookup, kept by an automation for new rows) — the same "copy the lookup into a native field"
  pattern as Calendar dates.
- **Chrome's plain `--screenshot` flag is not a screenshot tool for these pages**: at a phone window width it rendered a
  clipped page (right edge cut) that looked like an overflow bug, and at desktop width it produced an all-white picture of a
  page whose DOM had 1,700 characters and 37 loaded images. The DevTools path (`Page.captureScreenshot`, with
  `Emulation.setDeviceMetricsOverride` for phones) was right every time: `scripts/shot-chrome.sh` now always goes through
  `probe-chrome.cjs SHOT=…`, and prints the page's text length next to each file so an empty capture is caught.
- **Galleries and GALLERYMENU render empty in a screenshot taken before their S3 images loaded**; the same page was
  complete at `WAIT=30000`. Re-shoot before calling a block broken.
- **TitleDivider page buttons work**: `showButton:true, linktype:"page", side, path` renders a real button (previously
  only the dead default button had been seen).
- **Gallery `advancedHeader` shows search and `customSortFields` buttons**; the option chips of a singleSelect that is
  in the view's `fields` appeared on the cards (as chips) rather than in the header on this build.
- **The desktop app's permission classifier** refused: an ad-hoc `node -e` mongoose read of `users`/`bases`, a
  home-wide `find` naming `.accounts.json`, and a one-off step that created a field + automation + 42 record writes.
  It allowed the skill's scripts, demo-row updates, page/view updates and uploads. Hand refused creation steps to the
  user (DRY-tested, documented) instead of retrying in another shape.

## Lessons from the SafarClub demo round (2026-10-16)

- **`base.logo` (a storage key) is shown on the base's login page** and `header.logo` / `header.darkLogo` on every side;
  the sidebar layout and the website header print the side name next to the logo, so a wordmark there duplicates the
  name — use the square mark, keep the wordmark for the footer brand widget (with `title:""`).
- **Form `defaultValues` are record-shaped** (`ViewFormBody.vue` sets `setting.defaultValues = record`): a link default is
  `[{_id, primaryFieldValue}]`, a select default the option text. Setting the «تنظیمات» link default on three forms
  closed a critical gap («متن نسخه‌ی فعال» empty on every real case) with one `updateView` each.
- **A `count` whose `rollupJoin` was changed does not recompute existing parents** (touching the parent did not help);
  creating the real `records` link and writing it on every child row recomputed the counts within ~90 s.
- **The desktop app's browser pane shares the owner's login and it expires**: a pane that showed the team dashboard
  at 18:00 showed the login page at 20:00. Logged-in screenshots need the test accounts in `.accounts.json` (the
  agent must never type the owner's password); otherwise template changes are verified structurally only and the
  report says so.
- **Headless captures taller than the page end** (window 3400 px, body 2526 px) leave an empty band below the footer;
  crop to `document.body.scrollHeight`, and find the footer by its copyright text, not by a `<footer>` tag (the site
  footer is a `div.tw-mt-auto`).
- **`cfield` rejects `canview`/`canedit` and `cexpandtemplate` rejects `defaultSides`** («args not in GraphQL schema»); set them with the update mutations after creation (`lib.ts` does this since 2026-10-16). A rejected create leaves no object but does leave an `error` line in `changes.log` — say so in the report instead of hiding the line.
