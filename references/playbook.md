# Supporting playbooks

Used inside the two main flows (`flow-from-old-base.md`, `flow-from-requirements.md`) when the situation calls for them.

## Folders

```
<workspace>/<project>-build/           the project ("<work>")
  memory.md  BRIEF.md (multi-agent builds)
  build/{lib.ts,project.json,.accounts.json,shot.cjs,…,steps/<step-or-agent>/,changes.log}
  inputs/ data/ design/{DESIGN.md,SYSTEM.md,assets/} reports/ requests/ ui-needs/ qa/ shots/{old,new,qa}/
<workspace>/snapshots-private/         raw snapshots and record exports (mode 700; they hold keys and personal data)
```

Never `/tmp` for anything that must survive (it is RAM). Copy the skill's `scripts/*` into `<work>/build/` at the start.

## Reports for the customer

`python3 build/build-report.py report.json` builds a self-contained RTL HTML page (light/dark, requirement explorer,
candidates side by side). Use it for the design package (one candidate: the design) and for the flow-1 comparison
(old base vs new base). Look at it once in a browser; publish or share only when the user asks.

## Customer review

Expect taste feedback after the first demo: too much empty space, a plain background, galleries without covers, select
options without colours, "like this screenshot", "no table on the public site", "a sidebar instead of a header".

1. Read-only research round: the mechanics of each request with code citations, a whitespace audit with measurements,
   a data plan if the demo needs more rows.
2. Apply on **one page**, show it, then roll out.
3. Record each item as a correction at the top of the design system (`design-system-template.md`), so later pages
   follow it.
4. Confirm "no empty list" with `scripts/crawl-lists.cjs` per role, not with filter counts: template and
   record-context filters are invisible to counts.

## Meeting notes or a transcript

1. Read all of it; separate conversation from requirements. List each request in the speaker's own words.
2. For each request, check the **live base** (not your memory of it) and classify: already there (cite the object) /
   configuration gap / platform-code gap (cite the code path) / needs a customer decision or data / external system.
   Compare with the catalogue: a "partial" there is often the customer's main pain point.
3. Report in Persian as a requirement report (`requirement-report.md`), read-only, with exact objects and code lines; correct yourself in writing when a later check
   disproves an earlier claim. The user chooses what to build; code items go one branch each (`code-changes.md`).

## Automation consolidation

When an old base has many automations doing one job, the design merges them; when a built base needs fewer, the same
steps apply.

1. Full backup of automations and actions to `snapshots-private/` (keys inside), and a redacted summary per action
   (type, table, conditions by field name, URL without query, mapping targets, message head).
2. Group by schedule and by table (`platform-lessons.md`, «Engine facts»). Merge only where conditions make actions
   mutually exclusive by state; keep a separate automation when the trigger semantics differ (match on create, period
   per record) or when a merge would change what reaches the outside world. Prefer turning an existing automation into
   the merged one (keeps its id and run history) and deleting the sources after copying their actions.
3. Helper fields where needed (the «notified» + formula pattern), backfill them, `DRY=1`, apply, everything inactive.
4. Verify with the platform's own `filter.match` on scenario records per merged automation (`verification.md` §3) and
   list every behaviour difference for the user (schedule changes, one-time vs repeated sends, extra read-only calls).
5. After a data migration, run the backfill again before activation.

## Many agents in parallel

For a large build, split it by ownership under one `BRIEF.md` (`brief-template.md`): an access agent, one agent per
business domain, an automation agent, a reference-data agent and a design lead in parallel; then portal implementers;
then an independent visual QA; then a fix round and a re-evaluation (`agent-prompts.md`). Coordination files:
`requests/<agent>.md`, `ui-needs/<agent>.md`, `reports/<agent>.md`. Separate test accounts per screenshotting agent; at
most two browsers at a time.

## Handover

- Remove or disable test accounts and mock rows; rotate any key that was ever in plain text; get every default decision
  confirmed.
- Product feedback for the Airsheet team (bugs, security, improvements, features), categorised.
- Final `memory.md` entry (what happened, ids, decisions, open items); new general lessons into this skill's
  `platform-lessons.md`.
