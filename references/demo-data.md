# Demo data: back up the real records, load mock data, restore

Customers want to see the redesigned base full — no empty list, KPI or calendar anywhere — without seeing their real
(or anyone's) data in the demo. The first project's full plan, with every measurement, is
`<workspace>/srm-build/round2/DATA-PLAN.md` (+ `view-coverage.json`). This is the reusable core.

## Decide first

| Option | Use when | Cost |
|---|---|---|
| **A. Swap in place** (this file) | The demo must run on the real base/URL | Freeze window; delete + restore of every real row |
| **B. Demo copy** — `cloneBase(from, to, withData:false)` (`src/tools/cloner.ts`) + mock seed | Repeated demos, or several customers of one template | New base id/URLs, re-attach accounts, re-clone after design changes; id remapping unverified |

Ask the user. Default to A only when they asked for it explicitly.

## Facts that shape the procedure

- Automations must be inactive, and the base must have no webhooks/plugins and no collaborator field with notify:
  then neither delete nor upsert can reach SMS/email/APIs. Check at T0.
- The only faithful restore is **re-posting the exported raw events** (`master.runMutation(base, [{index:"main",
  event}])`): ids, `createdtime/createdby/modifiedtime`, autonumbers, formula/lookup/rollup values, links and attachment
  metadata come back byte-for-byte except `gid`. `urecords` would stamp new `createdtime` and draw new autonumbers.
  The app's `startRestore` also reverts structure and leaves the mock rows (platform-lessons.md).
- `_time` of a re-posted event is the receipt time, so the restored event is the newest for its id and wins `dedup id`.
- The hourly GC physically removes events superseded by a tombstone about an hour after `drecords`. From then on the
  only copies are your export, the app backup and `index=history`.
- `runQuery` caps at 100,000 results: assert per-table count against `stats dc(id)`.
- Files are never deleted; uploaded mock images stay in S3 (keep their keys in the manifest).

## Procedure with gates (nothing real is touched before G2 passes)

0. **Preconditions.** No active automation, hooks, plugins. Tell the team the base's records are frozen from T0 to the
   restore. Stay 30 min away from the nightly 02:00 Tehran recompute. During the window: no option renames/removals,
   no field deletions or type changes (a rename rewrites only mock rows). Colour, cover, background and layout work is
   fine; if a formula/lookup/rollup is edited, force-recompute it after the restore.
1. **Backup (T0).** (a) App backup with files (`startBackup`, wait for `finished`, note `recordsCount`). (b) Raw export
   per table to `<workspace>/snapshots-private/<base>-records-<UTC>/` (dir 700, files 600 — they hold personal
   data; never copy them into `<work>` or `documents`, never print values): `<table>.ndjson` (live `_raw`),
   `<table>.deleted.ndjson` (tombstones, never re-posted), `manifest.json` (T0, counts, checksums). (c) Structure
   snapshot. (d) Baseline: row count of every placed view per account, and screenshots of every page.
   **G1:** per table live count = server `dc(id)`; server checksum = local checksum, with and without `gid`:
   ```
   search index=main base=<B> table=<T> | dedup id | search NOT status="_deleted_record"
   | eval h=tonumber(substr(md5(_raw),1,7),16), r=replace(_raw, "\"gid\":\"[^\"]+\"", ""), g=tonumber(substr(md5(r),1,7),16)
   | stats count sum(h) as s sum(g) as sg
   ```
   (with `gid` proves the export is byte-identical; without `gid` proves a restore reproduced every event).
2. **Rehearsal.** Seed 3 linked throw-away rows `MOCK-rt-*` (parent, child, grandchild with an autonumber and lookups),
   export them, delete them, wait for a GC run, re-post, compare checksum-without-gid, autonumber, `createdtime`,
   lookups, and visibility in the staff queue. **G2:** all equal, or stop.
3. **Hide real data** with `deleteRecords` in chunks ≤ 500, **children first** (deleting parents first makes every child
   recompute lookups). Keep reference tables the mock rows link to, and your own permanent site content.
   **G3:** live rows = the KEEP set; no `error` lines in `changes.log`.
4. **Seed mock** with `urecords` (uuid ids derived from readable names `MOCK-<set>-<n>`, map kept in
   `mock-idmap.json`; readable ids break related lists, see platform-lessons «has any of»), **parents first**, waiting `SETTLE_MS` per layer and
   reading computed primary values back before writing children's link values `[{_id, primaryFieldValue}]`. Upload the
   images once (`L.uploadFile`) and reuse keys. **G4:** the coverage check (verification.md §5) meets every minimum; the
   screenshot sweep shows no empty block; each demo account logs in; clear their sessions before the demo.
5. **Demo day.** Dates are offsets from demo day D; seed ≤ 3 days before. If the demo slips, re-date the mock rows.
6. **Restore.** Delete every mock row (`tombstoneRaw`, not `drecords`) (children first; ids from the manifest). Conflict report: any non-mock row
   written after T0 (`search index=main base=<B> earliest=<T0> NOT id="MOCK-*" …`) means someone wrote real data —
   decide per row. Wait until the base is quiet for 2 min. Re-post the export table by table, parents first, chunks of
   ≤ 500 rows **of one table** (cache invalidation is per table), sorted by `modifiedtime`, refusing any id that is live
   with a newer `modifiedtime`. **G6:** per table count and checksum-without-gid equal the manifest; baseline view counts
   equal T0 (allow `now()`-driven views to drift); same screenshots. Repeat the counts after the next GC run.
   Idempotent: an interrupted restore is re-run.
7. **Afterwards.** Record the run (times, counts, checksums) in `<work>/reports/demo-data.md`. Expect: autonumber gaps
   (cosmetic), `index=history` roughly tripled for the base, each real record's history showing a delete and a restore.

Helpers in `scripts/lib.ts` (folded back after the SRM seed of 2026-10-01): `exportRecords(table)` (read-only,
count-asserted), `checksum` / `serverChecksum`, `seedRows(table, rows)` (refuses ids that are neither `MOCK-` nor listed in
`mock-idmap.json`, and links to non-mock rows outside `project.json` `keepLinkTables`; appends to `mock-manifest.json`),
`tombstoneRaw(table, ids)` (raw tombstones without notify; real ids only with `allowReal`), `restoreRaw(table, raws)`
(the guards above — **not yet proven end to end**: run the rehearsal and G6 before trusting it with real data).

## First run (2026-09-25): what happened and what to change

Step scripts: `<workspace>/srm-build/build/steps/demo-data/` (`p1_backup.ts` app backup + poll, `p1_export.ts`
raw export + manifest, `g1_verify.ts`, `p1_struct.ts`/`r_struct.ts` structure snapshot, `r_baseline.ts` + `walk.py`
per-account view counts, `r_gc_state.ts`; they take `SNAP=<export dir>`). Report: `…/srm-build/round2/BACKUP-REPORT.md`.

- Backup + export of 30 tables / 22,463 live rows took ~2.5 min; G1 passed on 30/30 tables, twice (at export, and
  re-read from disk later). `JSON.stringify(JSON.parse(raw)) === raw` held for every row, so a re-post loses only `gid`.
- The app backup does not contain attachments that migrated rows still reference in the OLD base's folder: never delete
  the old base.
- `runMutation` caches a **one-event** re-post as that record but bumps the table's record timestamp only for
  **multi-event** arrays. Rehearse with **two** rows per table (not one), and decide up front for tables that have
  exactly one live row: allow the one-event path, or post `[ev, ev]` (adds a history entry).
- The hourly GC did not collect `garbages` docs for two slots on the test server. Record whether it runs before relying
  on "the old events are gone" or "they are still there"; `dedup id` keeps the rehearsal valid either way.
- Baseline screenshots of real data show personal data: store them only under `snapshots-private/`.
- Scripts written in a session scratchpad vanish on reboot: write step scripts under `<work>/build/steps/` from the
  first line.

## Second run (2026-10-01): the customer emptied the base first

- The user deleted every record (0 events in `index=main`, catalogue and our own site content included), so backup,
  rehearsal and hiding were moot. Reference tables and own content came back from the latest non-deleted version per id
  in `index=history` with `restoreRaw` (ids kept, so mock rows still link to them); then re-date the mock files to the
  real demo day (`D=…`), validate, seed parents first (`round3/s3_seed.ts`: resolves autonumber link titles, seeds
  self-linked tables in two layers, waits for notify between files).
- **Readable seed ids broke every record-context list** (`has any of [id]` compares `_id` only for uuid-shaped ids).
  Seed with deterministic uuids derived from the readable ids and keep the map in `mock-idmap.json`
  (`round3/s7_reseed.ts`); the lib accepts those uuids as mock.
- Filter counts said 0 empty lists; the browser crawl (`scripts/crawl-lists.cjs`) found five. Gate G4 is the crawl.
- Pages that need "help" or "news" content: seed extra content rows too (FAQ ≥ 8, guides ≥ 4, news ≥ 6 for a carousel).

## Mock-data principles

- Realistic, fictional content in the customer's language and domain; **no test tokens** («تست», «آزمایشی») because
  staff queues may filter them out; synthetic identifier ranges (right shape, impossible values); never a checksum-valid
  national code that could belong to a real person — leave personal-id fields empty.
- Two portal demo accounts: one rich (every list and tile non-zero), one modest. Their mobiles must not be substrings of
  other mock mobiles (userProperty matching is substring-based).
- Every status in every workflow, including open/public items (the real data may have none open — the public
  "opportunities" gallery was empty on real data), overdue items for SLA views, and events in the current month.
- Images on every row of a table shown in a gallery with a cover.
- Showcase records: a handful whose templates have every tab filled; the demo script opens those.
- Tabs that are legitimately empty for some records (e.g. evaluation for trades without one) get a condition on a count
  rollup instead of fake rows.
