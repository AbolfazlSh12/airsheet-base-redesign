# Building and verifying the new base (both flows, after approval)

Start only after the approval gate in `design-package.md`. Everything in `platform-lessons.md` and `design-guide.md`
applies from the first table: in a new base, avoiding a known trap costs nothing.

## B0. Create the base

Two ways; ask the user which:

- **The user creates it** in the UI with the owner account and gives you the id → put it in `project.json` as `"base"`.
- **The lib creates it** (`AIRSHEET_BOOTSTRAP=1 ALLOW_LIVE=1`):

  ```ts
  // build/steps/00-base.ts
  import * as L from "<work>/build/lib";
  L.run(async () => { await L.createBase("<name>", "<one-line purpose>"); });
  ```

  `cbase` does more than the name says, which is why it needs `ALLOW_LIVE=1` and the user's consent: like the UI's
  «فضای کاری جدید» it posts the owner's mobile to the server's `sales.uba.inputUrl`, and if `sales.uba.newUsersTable`
  is configured it adds a lead row to that table (whose automations may fire). `createBase` refuses while
  `project.json` already names a base, and writes the new id there.

`cbase` also creates the owner collaborator, a collaborator side «تیم» with one page, and an engine assignment. Use
that side as the staff portal rather than a second one.

## B1. Build in dependency order

One or more scripts per step in `build/steps/NN-*.ts`, each run with `DRY=1` first, then applied, then re-run to show it
is idempotent. Creating a table, field, view, role or side is idempotent by name; pages, templates, automations and
actions are not, so re-run those only after reading `changes.log`.

1. **Tables**: `createTable(name)`. `ctable` adds a Grid view and a text primary field «نام»: rename it, and retype it
   while the table is empty (`updateField(id, {name, type}, {allowTypeChangeOnEmptyTable: true})`) instead of adding a
   second title field.
2. **Plain fields**: `createField(table, spec)`, select options with colours.
3. **Links, then lookups and rollups, then formulas**: each needs the one before it to exist.
4. **Roles and permissions**: `createRole`, then table and field permissions (`canview`, `canadd`, `canedit`, …) with
   `updateTable` and `updateField`. New fields inherit the table defaults, so set permissions after the fields exist.
5. **Validation**: field limits and table constraints (`upsertConstraint`).
6. **Views and forms**: `createView(table, {type, name, …})`, including every portal copy with its user filter, and the
   Gallery views used as link pickers in portal forms.
7. **User roles and record roles**: `createUserRole`, `createRecordRole`.
8. **Look**: palette, logo and fonts on the base and sides first, so every screenshot shows the final colours
   (`design-system-template.md`).
9. **Sides, pages and expand templates**: `createSide`, `createPage`, `createExpand`, following the page shells.
   Every VIEW block sets its heading, `displayListName: false`, `viewToolbar`, `newable` and an explicit template.
10. **Automations**: `createAutomation` + `createAction`, all **inactive**. External calls point at a mock. Write the
    activation checklist (test providers first, one manual run per process, read the run log).
11. **Data**: flow 1 migrates now (`flow-from-old-base.md`, O6). Otherwise, or in addition, mock data through the lib
    (`bulkUpsert` for reference data, `createRecord` where the write path matters) so every table, gallery and portal
    list shows something. Link targets get uuid ids; mock rows are marked so they can be removed (`demo-data.md`).

To redo a table while building: `deleteTable(id)` refuses a table with records or one linked from another table, so
delete the mock rows and the links first. Never delete anything that holds migrated or customer data.

For a large base, split the work across agents with disjoint ownership under one `BRIEF.md`
(`brief-template.md`, `agent-prompts.md`).

## B2. Verify

`verification.md` in full. At least:

- **Coverage**: evaluator + skeptic against `data/catalogue.json` (`workflows/2-coverage.js`, `AFTER_BUILD`); in flow 1
  with the old base as a second candidate.
- **Access**: every portal as its real user and as anonymous (`view-count-as.ts`, `portal-invariant.ts`).
- **Behaviour**: every automation checked statically with the platform's own `filter.match` on scenario records;
  every form submitted once per portal.
- **Look**: screenshots per role, desktop, `MOBILE=1` and `THEME=dark` (`shot.cjs`); record dialogs per template
  (`shot-record.cjs`); no empty list (`crawl-lists.cjs`).
- **Static checks**: `dump-base.cjs` + `lint-base.cjs` with 0 errors; `check-constraints.ts` with every rule working.
- **Against the document**: the gap audit (`gap-audit.md`) is the done-gate. Close what configuration can close
  before B3.

## B3. Report and hand over

The completion report (Persian):

- security findings first;
- coverage per domain (flow 1: old vs new), with `build` and `external` items listed separately;
- what was built, with names and ids; the design changes made during the build;
- the decision list with the defaults used, for the customer to confirm;
- the go-live list: remove mock rows and test accounts, activate automations with test providers first, cutover
  (flow 1, O8), hand ownership to the customer's account, rotate any key that was ever in plain text.

Then: the product-feedback file for the Airsheet team, the final `memory.md` entry, and any new general lesson into this
skill's `platform-lessons.md`.
