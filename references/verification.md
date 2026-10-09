# Verification patterns

Nothing an agent says it did counts until one of these checks shows it. Reports are claims.

## 1. Evaluator + skeptic (requirement coverage)

- One **evaluator** per domain chunk returns exactly one verdict per requirement: `covered | partial | missing |
  not-applicable`, with evidence (exact object names), gaps, `operational_ready`, `better_than_old`, confidence.
- A **separate skeptic** re-checks every verdict and its verdict is final. Instruct it to try to REFUTE each "covered"
  by finding the missing link in the chain, and to search for equivalents before accepting "missing". On the first
  project it changed 12 of 222 verdicts, 11 of them stricter.
- Judge the **whole chain**: data → form → page in the right side for the right role → access (role, userrole,
  recordrole) → automation (right target, watch field, form reference, active?) → reporting. "The table exists" is not
  coverage.
- Keep `operational_ready` separate from the verdict: correct but switched-off is not "works today". After a build add
  `blocked_by: activation | platform | customer | external | ""` — it turns 40 "partial" into a to-do list by owner.
- Merge in code (`final = skeptic ?? evaluator`), print counts, and list ids with no verdict. Scripts:
  `scripts/workflows/2-coverage.js` (`AFTER_BUILD=true` for the re-evaluation).

## 2. Run the portal as the user it is for

- `scripts/view-count-as.ts` counts a view's rows the way `searchAPI` does (`filterExpression` + Splunk) for given
  mobiles and for `anon`. A scoped view that returns the whole table for one of them means a condition was dropped.
- STATS: count each item's filter the same way for two portal users and with no user; a portal user's tile must differ per
  user and must not equal the global count.
- `scripts/portal-invariant.ts <sideId>`: every view reachable from a user side (published pages, side templates, form
  link pickers, after-submit templates) carries the user-scope condition or is listed for review; every opened template
  includes the side; every STATS item has a field and a leading user-scope condition. Exit criterion: 0 failures.
- Run hostile checks read-only as anonymous against the real endpoints only to confirm a class of leak exists; never
  print the values you get back.
- **Pages that change with the user's state** (e.g. a dashboard before and after approval): there may be no test
  account in that state. Flip a test account's own row to the state with `updateRecord`, screenshot, flip it back, and
  check both lines in `changes.log` (allowed for test accounts only; say so in the report).

## 3. Static automation verification (nothing runs)

Load the automation document and evaluate its conditions with the engine's own code on constructed records:
`require('<cloud-back>/src/modules/database/filter').match(record, conditions, {})` and the model's
`automationDoc.test({...record, changes:[{field, before}]})` for update triggers. Assert: all inactive; every `update`
automation watches a field; every `form` automation points at an existing Form view; the positive case matches and
each negative case (not ready, already sent, resend) does not.

For a **merged** automation (several jobs in one, see playbook «Automation consolidation»), write one scenario per
real-world event and the actions you expect, then print which actions' conditions pass — the call `Action.run` makes:

```ts
const { match } = require(`${APP}/src/modules/database/filter`);
for (const [name, rec, expect] of scenarios)
  console.log(name, "expect:", expect, "fired:",
    (await Promise.all(auto.actions.map(async (a: any, k: number) => (await match({ ...base, ...rec }, a.conditions ?? [], {})) ? k + 1 : 0))).filter(Boolean));
```

A lifecycle automation typically needs a dozen scenarios per request table (first send, not ready, answered, each
status, cancel, resend, correction resend, inquiry). This proves the
conditions, not the trigger timing: still do one manual run per process with test providers before activation.

## 4. Screenshots per role

- `node build/shot.cjs <role> shots/<phase>/<portal> <sideId>/<pageId> ...` for every published page, as the audience it
  is for, desktop (1366) and `MOBILE=1` (390); `THEME=dark` once per portal. Open templates too (a record dialog per
  table). Look at every image; cite the file in the report.
- `WAIT=12000` minimum; 20000-25000 for data-heavy portals. At most two browsers at once. Grids below 900 px load lazily:
  judge list contents from the tall viewport, not `fullPage`.
- Empty-space check: find the last content row of each shot and compute the blank share of a 1366×1080 screen; ≥ 30 %
  means the page looks unfinished (one project had 11 pages ≥ 44 %).
- An independent **visual QA reviewer** (read-only) grades every page P0/P1/P2 and answers "would I show this to the
  customer today?" per portal. One project: 41 findings (1 P0 — a dashboard whose KPIs were all 0).

## 5. Data coverage (before a demo)

Build `view-coverage.json`: every view placement and STATS tile per side/page/template, the account that sees it, and
the minimum rows it needs. After seeding, count each as that account (as in §2) and assert `≥ minRows`; kanban columns
≥ 2 each; calendar events in the current month. Record-template related lists depend on the opened record: pick
showcase records and fill every tab of those.

Then confirm in the browser, per role: `scripts/crawl-lists.cjs <role> <sideId> <pageId…>` opens each page with the
role's saved login, clicks every tab and reports every list whose `searchAPI` answer was empty (exit 1). It sees what
the filter count cannot: template/record-context filters and lists inside tabs. Once every filter count was fine while
five dashboard tabs were empty for both portal users — readable mock ids broke the record-context filter.

## 5b. Static lint and rule proof

- `node build/lint-base.cjs <dump.json>` flags what the platform silently mishandles: reports grouped by link fields,
  line charts, formulas that read a timeFormat formula plus a link (never computed), signature conditions with
  «is empty», messages without recipients, create-triggered messages that read lookups, update automations watching
  nothing, code-like fields without uniqueness. Exit criterion: 0 errors.
- `npx tsx build/check-constraints.ts` runs the server's own `constraint.check` for every rule: a duplicate must be
  rejected, a fresh value accepted.
- For an automation scenario check with `filter.match`, give every constructed record its `table` (and `base`): the
  evaluator loads field types from `record.table`, and without it no condition ever matches.

## 6. Change safety

- `DRY=1` diff read by the agent before every real run; `changes.log` holds `{kind,id,diff:{from,to}}` so any line can
  be reverted. Snapshot the structure (read-only Mongo dump) before a phase starts.
- Re-dump the base after a phase and diff it against the previous dump (names instead of ids makes the diff readable).
- A teammate's concurrent edits show up as unexplained diffs: find the actor in `index=behavior` before reverting.
