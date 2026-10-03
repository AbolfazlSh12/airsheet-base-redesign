# Greenfield: a new base from an RFP and customer documents

Use this when there is no base yet, only the customer's RFP, spec, forms, spreadsheets, mockups or voice notes. Phases
A and B of the playbook still apply, but phase A does not read a live base. It turns the documents into a requirement
catalogue and a data model, and the user approves both before anything is created.

Everything in `platform-lessons.md` and `design-guide.md` applies from the first table. The SRM lessons (portal
filters, `is not`, supplier copies of views, automations kept inactive) cost a day each to discover. In a new base they
cost nothing to avoid.

## G0. Setup (no base id yet)

```bash
W=<workspace>/<customer>-build; mkdir -p $W/build <workspace>/documents/<CUSTOMER>/{data,inputs}
cp ~/.claude/skills/airsheet-base-redesign/scripts/*.* $W/build/
printf '{"owner":"<ownerUserId>","frontend":"http://localhost:9003"}\n' > $W/build/project.json   # no "base" yet
```

- **Owner.** The user whose account will own the base: a team test account, never a customer's account. Read the
  user id with a read-only Mongo query. The account's plan must allow one more base; `cbase` otherwise fails with
  «محدودیت تعداد فضای کاری».
- **Server.** Confirm which Mongo, Redis and Splunk the tunnels reach, as for any project (non-negotiable 1).
- **Inputs.** Copy everything the customer sent into `documents/<CUSTOMER>/inputs/`, run `md5sum` on it, and convert
  it to text with `extract-inputs.py docx|pdf`. Spreadsheets become CSV. Look at every image and mockup with Read.

## G1. Requirement catalogue (read-only)

This is phase A step 3, with the documents as the source instead of a base:

1. **One agent per document section or business domain.** One requirement is one testable capability. Each needs an
   acceptance criterion that a reviewer could check against a base, and a `source` (document, page or section, quote).
   Id prefixes are per domain.
2. **Completeness critic.** It looks for gaps, overlaps, weak criteria and requirements the RFP implies but never
   states: approvals, notifications, reports, audit trail, who may see what, data import, and the portal each actor
   uses. Implied items are marked `implied: true` so the customer can confirm them.
3. **Open questions.** Anything the documents leave open (numbering format, approval chain, SLA, which data is
   migrated) goes on a decision list, each with a recommended default. The user picks the defaults, as in SRM.
4. **Out of scope.** Mark requirements that need platform code, an external system or integration as `external` or
   `build` now. The catalogue keeps them, and the final report shows them as not covered by configuration.

Output: `data/catalogue.json`, `data/decisions.md`. Show the user the counts per domain and the decision list.

## G2. Data model (design document, then approval)

Write `design/DATA-MODEL.md` before creating anything. It lists:

- **Tables**: name, purpose, primary field (what a row is called in a link), expected row count, the requirements it
  serves.
- **Fields per table**: name, type, options with colours, required, and for link, lookup, rollup and formula fields
  the exact target. Status fields are single-selects with a coloured option per state.
- **Actors → roles and sides.** Each actor gets its access model: staff roles (collaborator side, `roles`), portal
  users (user side, `userRole` with `accreditView`/`userProperty`), anonymous visitors (visitor side). For each portal,
  also give the view filter that limits a user to their own rows. Never share one view between staff and a portal;
  make a portal copy (platform-lessons.md, Access model).
- **Processes → automations.** Give each process a trigger and actions. They are created inactive (G3 step 8).
- **Views, forms and pages per actor.** Take these from the requirement catalogue: each requirement names the view
  or page that satisfies it.
- **Traceability**: a table mapping every requirement id to the objects that cover it. Every non-external
  requirement must appear.

Review it with two agents in parallel: a **skeptic** hunting unmet requirements, unscoped portal views and missing
links, and a **platform checker** with `platform-lessons.md` hunting constructs the platform silently mishandles. Fix,
then **stop and get the user's approval**. Tables and field types are expensive to change once records exist.

## G3. Build (lib.ts, bootstrap then normal mode)

Create the base once, with the bootstrap flag:

```ts
// build/steps/00-base.ts  →  AIRSHEET_BOOTSTRAP=1 ALLOW_LIVE=1 npx tsx <work>/build/steps/00-base.ts
import * as L from "<work>/build/lib";
L.run(async () => { await L.createBase("<name>", "<one-line requirement summary>"); });
```

**`cbase` does more than create a base, so ask the user first.** Like the UI's «فضای کاری جدید», it
`uba.track`s the owner (an HTTP POST of their mobile to the server's `sales.uba.inputUrl`). If
`sales.uba.newUsersTable` is configured, it also adds a lead row (mobile, name, base name, requirement text) to the
sales team's table, and that table's automations may fire. That is why `createBase` needs `ALLOW_LIVE=1`. The
alternative is that the user creates the base in the UI with the owner account and puts its id into `project.json`;
then skip this step.

`createBase` refuses to run while `project.json` already names a base. It writes the new id into `project.json`.
Every later script runs without the flag. `cbase` also creates the owner collaborator, a collaborator side «تیم» with
one page, and an engine assignment. Use that side as the staff portal rather than creating a second one.

Then build in this order. Each step is one or more scripts in `build/steps/NN-*.ts`, run first with `DRY=1`. Creating a
table, field, view, role or side is idempotent by name: an existing one is returned, not duplicated. Pages, templates
and automations are not, so re-run those steps only after checking what the failed run created (`changes.log`).

1. **Tables**: `createTable(name)`. `ctable` also creates a Grid view and a text primary field «نام». Rename it, and
   retype it if needed while the table is empty (`updateField(id, {name, type}, {allowTypeChangeOnEmptyTable:true})`),
   rather than adding a second title field.
2. **Plain fields**: `createField(table, spec)`, with the select options and colours (`colors: {}` gives the default
   palette; design-guide.md).
3. **Links, then lookups and rollups, then formulas.** Each depends on the one before it existing.
4. **Roles**: `createRole(name, description)`. Set table and field permissions (`canview`, `canadd`, `canedit`, …)
   with `updateTable` and `updateField`. New fields inherit the table defaults, so set permissions after the fields
   exist.
5. **Views and forms**: `createView(table, {type, name, …})`, including the portal copies with their user filter.
6. **User roles and record roles**: `createUserRole`, `createRecordRole`.
7. **Sides, pages and expand templates**: `createSide({name, type, roles | userRole, accreditView, layoutType})`
   (`cside` adds one empty page), `createPage`, `createExpand`. Apply the palette and the design system first, as in
   phase B.
8. **Automations**: `createAutomation` and `createAction`, inactive. Write the activation checklist.
9. **Mock data**: seed through the lib (`bulkUpsert` for reference data, `createRecord` where the write path matters),
   so that every table, view, gallery and portal list shows something (`demo-data.md`, the seeding and coverage parts).
   There is no real data to back up yet. Mark mock rows (for example a `MOCK-` prefix on the primary field) so they can be
   removed before go-live.

To redo a table from scratch while building, `deleteTable(id)` refuses any table that has records or is linked
from another table. Delete the mock rows and the links first. Never delete in a base that already holds customer data.

## G4. Verify and report

The same as phase B from the visual QA onwards:

- **Coverage**: evaluator + skeptic against `catalogue.json` (`workflows/2-coverage.js` with the new base as the only
  candidate, `AFTER_BUILD`).
- **Portals**: check each one as its real user and as anonymous (`view-count-as.ts`, `portal-invariant.ts`).
- **Visual QA**: screenshots per role, desktop and mobile (`shot.cjs`).

The completion report (Persian) has these sections:

- security findings;
- coverage per domain, with the external and build items listed separately;
- the decision list with the defaults used;
- the go-live list: remove mock rows and test accounts, activate automations with test providers first, and hand
  ownership to the customer's account.

## What differs from a redesign

| Redesign (phases A–B) | Greenfield |
|---|---|
| Catalogue from the old base and its atlas | Catalogue from documents; implied requirements marked |
| Coverage "before" is measured | "Before" is zero; report coverage after only |
| Real data: backup before any risky write | No real data until go-live; mock data is free to rebuild |
| Structure fixed by existing records | Structure is cheap until the first real record: get the data model right in G2 |
