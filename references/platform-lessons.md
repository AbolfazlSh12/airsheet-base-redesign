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
