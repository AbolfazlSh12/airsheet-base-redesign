# Flow 1: from an existing base to a new, redesigned base

Input: the id of a live base the customer is unhappy with (plus any documents, an AI-written description of the base,
meeting notes or complaints). Output: an approved design package and a **new** base built from it, optionally with the
old base's data migrated. The old base is only read; it stays the fallback until cutover.

```
O0 setup → O1 read the old base → O2 check any description of it → O3 requirement catalogue (what the base must do)
   → O4 diagnosis (what is wrong with it) → design package + old→new map (design-package.md) → APPROVAL
   → build the new base (build-new-base.md) → O6 data migration (if approved) → O7 compare and verify → O8 cutover
```

## O0. Setup

SKILL.md «Setting up a project», with `"source":"<oldBaseId>"` in `project.json`. Every read of the old base runs with
`AIRSHEET_BASE=<oldBaseId> DRY=1`, so no mutator can touch it. The owner of the new base is a team test account (read
its user id with a read-only Mongo query).

## O1. Read the old base (read-only)

```bash
cd <workspace>/cloud-back
npx tsx $W/build/splunk-query.ts 'search index=main base="<old>" | dedup id | search NOT status="_deleted_record" | stats count by table' $W/data/counts_old.json
node $W/build/dump-base.cjs <old> $W/data/dump_old.json $W/data/counts_old.json
grep -E 'apiKey=[^*<"\\&]{6,}' $W/data/*        # must print nothing
```

Then establish, with evidence:

- **Structure**: tables with row counts, fields by type, links and their direction, lookups/rollups/formulas, views per
  table and their filters, forms, expand templates, sides with their pages and menus, roles, user roles, record roles,
  automations with trigger, conditions and actions (URLs without query).
- **Usage**: which tables actually hold data, which automations are active and when they last ran, which pages and
  views people open (`index=behavior`: `search index="behavior" "<old>" | spath api | stats count by api`). Unused
  structure is a candidate to drop, not to copy.
- **Actors**: who logs in where (collaborators by role, portal users per side, anonymous visitors).
- **Raw backup**: the full structure (views, automations with actions, sides, pages) to
  `<workspace>/snapshots-private/<old>-<UTC>/` before anything else. It holds keys: never print it.

## O2. Check any description of the base

An AI-written "atlas" or a colleague's document gets the counts right and guesses behaviour from appearance. If one
exists, diff it mechanically against the dump (counts, fields by name and type, views, automations per table, pages and
roles per side) and have two agents check every prose claim (`workflows/1-understand.js`). Record every wrong claim:
a design built on a wrong description inherits its errors.

## O3. Requirement catalogue: what the new base must do

The same catalogue format as flow 2 (`flow-from-requirements.md`, R2), from three sources:

1. **The old base's behaviour**, one domain at a time (domains from the table order or the description): every process,
   portal, report and rule the customer relies on today becomes a requirement with `source: "old base: <object>"`.
2. **The documents and complaints**: what the customer wants that the old base does not do.
3. **The completeness critic**: what both imply but nobody wrote (who may see what, approvals, notifications, audit).

Keep test, obsolete and unused items in `deprecated[]` with the reason, and check later that they are **not**
migrated. Open questions go to `data/decisions.md` with recommended defaults.

## O4. Diagnosis: what is wrong with the old base

`data/diagnosis.md`, each finding with the object, the evidence and the consequence. Look at least for:

- **Data model**: one table per "type" that should be one table with a type field; repeated fields instead of a child
  table; text where a link belongs; links in the wrong direction; missing snapshot fields (values that must not change
  when the source changes); formula chains that break.
- **Access**: portal views without a user filter, views shared by staff and portals, empty `canview` read as "everyone",
  record roles that grant more than intended (`platform-lessons.md`, «Access model»). Test the worst ones as a real
  portal user and as anonymous (`view-count-as.ts`).
- **Automations**: ones that can never fire (`update` with no watched fields, `form` pointing at an old form), ones that
  fire twice, many automations doing one job (consolidate by schedule and table), secrets in plain URLs.
- **Portals and pages**: empty lists, unfinished pages, inconsistent styles, dead buttons, pages nobody opens.
- **Coverage**: run `workflows/2-coverage.js` with the old base as the candidate: how many requirements it covers fully,
  partly, not at all. This is the "before" number.

## O5. Design package

Write `design/DESIGN.md` exactly as `design-package.md` describes, plus its section 14, **old → new**:

- a table per object kind (tables, fields, automations, roles, sides, pages): old name and id → new name, and
  `keep` / `rename` / `merge into` / `split into` / `drop`, with the reason (a diagnosis or requirement id);
- the **data-migration plan** (O6): which tables move, the field mapping, which rows are excluded (test rows, deprecated
  items), what happens to autonumbers and creation dates, and how links and attachments are carried.

Review it (skeptic + platform checker) and stop at the approval gate.

## Build

`build-new-base.md`. Nothing in the old base changes. Mock data is not needed for tables that will receive migrated
data; seed mock rows only where the demo needs them, and mark them so they can be removed.

## O6. Data migration (only if approved)

1. **Export** each source table from the old base, read-only: `AIRSHEET_BASE=<old> DRY=1` + `L.exportRecords(table)`
   (count-asserted), into `snapshots-private/<old>-records-<UTC>/` (dir 700, files 600). Record per-table counts and
   `L.checksum`.
2. **Transform** in a script, never by hand: old field ids → new field ids from the approved map; merged tables get
   their type field; split tables route rows by rule; values change type where the design says so (text → select
   option, text → link). Keep the old record **ids** (they are uuids): links between migrated rows then stay valid
   without remapping. Drop deprecated and test rows.
3. **Import** into the new base with `L.bulkUpsert(table, rows)`, parents before children, in chunks of one table.
   It is silent (no automations, no notifications), keeps the ids, recomputes lookups and formulas, but **stamps a new
   `createdtime` and draws new autonumbers**: if the old creation date or number matters, the design keeps them in
   ordinary fields («تاریخ ثبت»، «شماره‌ی قبلی»).
4. **Attachments** keep pointing to files under the old base's storage folder. They work as long as the old base
   exists: never delete the old base.
5. **Check**: per table, the imported count equals the export minus the excluded rows; every link resolves (no id that
   is missing in its target table); a sample of rows compared field by field; the portal demo accounts see their own
   rows and only those.
6. `DRY=1` first, then apply, then re-run to show nothing is duplicated. Automations stay inactive throughout.

## O7. Compare and verify

- **Coverage**: `workflows/2-coverage.js` with both bases as candidates (`AFTER_BUILD`): the report shows old vs new per
  domain.
- **Access**: every portal as its real user and as anonymous; `portal-invariant.ts` on the new base.
- **Visual**: screenshots of the old and the new base per role, desktop and mobile, side by side in the report.
- `verification.md` for the rest.

## O8. Cutover (with the user)

Freeze the old base (no new records, announced), run the migration once more for rows created since the first run
(the transform is idempotent because ids are kept), activate automations with test providers first and then real ones,
point users at the new portals (URLs, SMS templates, links on the customer's site), and keep the old base read-only
until the customer confirms. Then the handover list in `build-new-base.md`.
