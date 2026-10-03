# Playbook: audit, complete and redesign a customer's Airsheet base

Worked example: the telecom operator's supplier portal ("SRM") (2026-09-24/25). Assessment: `<workspace>/documents/SRM/`
(`memory.md` is the diary, `SRM-comparison.html` the report). Build: `<workspace>/srm-build/` (BRIEF, reports,
qa, reeval, round2, shots, build/steps with every script that ran). Read those when a step here is too terse.

## Folders

```
<workspace>/documents/<CUSTOMER>/        customer inputs + deliverables (memory.md, report html, deliverables/)
  data/                                           dumps, catalogue, verdicts, plan, workflow raw outputs
<workspace>/<customer>-build/            the build ("<work>")
  BRIEF.md  build/{lib.ts,project.json,.accounts.json,shot.cjs,...,steps/<agent>/,changes.log}
  design/{SYSTEM.md,IA.md,assets/}  reports/ requests/ ui-needs/ qa/ reeval/ shots/{before,after,qa}/
<workspace>/snapshots-private/           raw snapshots and record exports (mode 700; hold keys and personal data)
```

Never `/tmp` for anything that must survive (it is RAM). Copy the skill's `scripts/*` into `<work>/build/` at the start.

## Phase A — Understand and assess (read-only, ~2 h, ~25 agents)

0. **Inputs to text.** `python3 extract-inputs.py atlas|docx|pdf <src> <outdir>`. A saved Claude artifact keeps its
   content in `<name>_files/_t.html`, with structured data in `<script id="atlas-data">` (gold for machine diffs). Look
   at docx mockups (`docx_media/`) with Read. `md5sum` the inputs (duplicates happen). Check whether a PDF is the
   transcript of the voice notes before transcribing audio.
1. **Dump each base** (from cloud-back):
   ```
   npx tsx <work>/build/splunk-query.ts 'search index=main base="<id>" | dedup id | search NOT status="_deleted_record" | stats count by table' data/counts_<id>.json
   node <work>/build/dump-base.cjs <id> data/dump_<id>.json data/counts_<id>.json
   grep -E 'apiKey=[^*<"\\&]{6,}' data/*      # must print nothing
   ```
2. **Verify the existing description (atlas)** in two layers: a mechanical diff of atlas-data vs the dump (counts, fields
   by name and type, views, automations per table, pages and roles per side), each difference dated with
   `createdAt/updatedAt` and its actor from `index=behavior`; then two parallel agents check every prose claim
   (`workflows/1-understand.js`).
3. **Requirement catalogue.** One agent per domain (domains from the atlas domain map or the old base's `tableOrder`),
   id prefixes per domain, one requirement = one testable capability with acceptance criteria another reviewer can
   apply to a different base. Then one **completeness critic** (gaps as GAP-, overlaps, weak criteria). Merge in code
   (a `{dropped: kept}` map), keep test/obsolete items in `deprecated[]` and check they are NOT migrated.
4. **Coverage** per candidate base: evaluator + skeptic per domain chunk (`workflows/2-coverage.js`), plus the 13-dimension
   design comparison and the new base's defect list.
5. **Remediation plan**: classify each gap by fix type — config (hours) / build (days) / decision (customer) /
   external (third party) — with size, concrete steps naming objects, and launch-blocking; then P0/P1/P2 workstreams,
   customer decisions with recommended defaults, go-live checklist (`workflows/3-remediation.js`).
6. **Report**: `python3 build-report.py report.json` (self-contained RTL HTML, light/dark, requirement explorer). Look at
   it once in a browser. Publish/share only if the user asks.

First project: 111 requirements; new base 14 covered / 92 partial / 5 missing; 101 gaps = 65 config, 23 build, 7 decision,
6 external; the atlas had 40 wrong or imprecise claims out of 116 and 20 omissions; a colleague's "covers everything"
base covered 0.

## Phase B — Complete and redesign (configuration only; ~40 agents in a working day)

Agree with the user first: config-only or code too; brand; test accounts (create them, with approval); defaults for the
customer's open questions. Then:

1. Write `BRIEF.md` (`brief-template.md`). Copy `lib.ts`, `shot.cjs`, checks into `<work>/build/`; fill
   `project.json` and `.accounts.json` (600). Smoke-test the lib read-only (`DRY=1`).
2. Research trio → functional agents (parallel, disjoint ownership) + design lead → portal implementers → visual QA →
   fix round → re-evaluation (evaluator + skeptic, `AFTER_BUILD`) → final config round → final QA
   (`agent-prompts.md`).
3. Apply the palette first so every screenshot shows final colours. Every page follows a shell from the design system;
   every VIEW sets heading, `displayListName:false`, `viewToolbar`, `newable`, explicit template.
4. Automations: rewire, keep inactive, verify statically; write an activation checklist (test providers, one manual run
   per process, sync before SMS).
5. Completion report for the user (Persian): security findings first, before/after coverage table, what was built,
   pre-launch list (platform fixes, server settings, automation activation, cutover, test accounts/data removal, key
   rotation, customer confirmation of every default decision), file index.

First project result: 71 covered / 40 partial / 0 missing (core 56/87); of the 40 partial, 26 need platform code, 5 the
customer, 3 the external system, 1 activation, 5 still config.

## Phase C — Customer review round

Expect taste feedback after the first demo. The first customer said: calm theme good; too much empty space on some
pages; wants a soft page background; every gallery with a cover; select options must have colours; wants demo data.
Run a read-only research round (mechanics of each request with code citations, whitespace audit with measurements, data
plan), apply to **one page**, show it, then roll out. Record each item as a correction in the design system.

Second round (SRM, 2026-10-01) asked for: the supplier portal as a sidebar; link-field pickers as galleries; the news
gallery "like this screenshot" (a `cardsHorizontal` carousel); no table views on the public site; variety instead of the
same `featured` cards everywhere; image on the left; a background per portal; and no empty list on any page. Each is in
`design-system-template.md` (corrections) and `platform-lessons.md`. Confirm "no empty list" with
`scripts/crawl-lists.cjs` per role, not with filter counts alone (template and record-context filters are invisible to
those; readable mock ids emptied every related list once).

### Meeting notes or a transcript from the customer

1. Read all of it; separate gossip from requirements. List each request with the speaker's own words.
2. For every request, check the **live base** (not your memory of it) and classify: already there (cite the object) /
   configuration gap / platform code gap (cite the code path) / needs a customer decision or data / external system.
   Compare with the requirement catalogue's verdicts: a "partial" there is often the customer's main pain point.
3. Report in Persian, read-only, with the exact objects and code lines; correct yourself in writing when a later check
   disproves an earlier claim. Wait for the user to choose what to build; code items go one branch each
   (`code-changes.md`).

## Automation consolidation (after the build, when the user wants fewer automations)

1. Full backup of automations + actions to `snapshots-private/` (keys inside), and a redacted summary per action
   (type, table, conditions by field name, URL without query, mapping targets, message head).
2. Group by schedule and by table (`platform-lessons.md` «Engine facts»). Merge only where conditions make actions
   mutually exclusive by state; keep a separate automation when the trigger semantics differ (match on create, period
   per record) or when a merge would change what reaches the outside world. Prefer turning an existing automation into
   the merged one (keeps its id and run history) and deleting the sources after copying their actions (`deleteAutomation`).
3. Helper fields where needed (the «notified» + formula pattern), backfill them, `DRY=1`, apply, everything inactive.
4. Verify with the platform's own `filter.match` on scenario records per merged automation (`verification.md` §3) and
   list every behaviour difference for the user (schedule changes, one-time vs repeated sends, extra read-only calls).
5. Before activation after a data migration: run the backfill again.

## Phase D — Demo data

`demo-data.md`: backup → rehearsal → hide real → seed mock → demo → restore, each with a gate. Ask before hiding real data.

## Phase E — Handover and reuse

- Remove or disable test accounts and test rows; rotate any key found in plain text; confirm the default decisions.
- Product feedback file (bugs, security, improvements, features) for the Airsheet team, categorised.
- Update the customer's `memory.md` (what happened, ids, decisions, open items) and add any new general lesson to this
  skill's `platform-lessons.md`.
