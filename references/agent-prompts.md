# Agent roles and prompt templates

Assessment agents run inside the three workflow scripts (`scripts/workflows/`). Build agents were launched one by one
(Agent tool / workflow `agent()`), all under the same `BRIEF.md`. Every prompt below starts with the shared CONTEXT block.

## Shared CONTEXT block (prepend to every build-phase prompt)

```
Project: Airsheet (no-code platform; repos <cloud-back> (Express/Apollo/Mongoose) and <cloud-front> (Quasar/Vue3)).
We are redesigning base <baseId> («customer / purpose») by configuration only.
Read <work>/BRIEF.md fully first (rules, ownership, decisions, lessons). Then as needed: <work>/build/LIB.md,
<work>/build/DESIGN-GUIDE.md, <work>/design/SYSTEM.md.
Environment: MongoDB/Redis/Splunk on localhost are SSH tunnels to the team's SHARED test server — anything you write is
real. <READ-ONLY: no lib mutators, no record writes, no uploads | WRITE: only through build/lib.ts within your ownership>.
Don't modify any repo file. Screenshot tool: node <work>/build/shot.cjs <role> <outDir> <sideId>/<pageId> ...
Never print secrets or personal data values.
```

## Orchestration that worked (about 40 agents in one working day for the build)

1. **Research trio, before any write** (parallel, read-only except their own files): safe-write library + LIB.md;
   page-builder guide from the frontend code; brand research from the customer's documents.
2. **Functional agents in parallel with disjoint ownership** (access, one per business domain, automation, refdata) +
   a **design lead** that writes `design/SYSTEM.md` and `design/IA.md` without touching the base.
3. **Portal implementers in parallel**, one per portal group (public site / external portal / internal workbenches),
   each owning its sides, pages, templates and the display settings of views it places; each loops
   screenshot → look → fix.
4. **Independent visual QA** (read-only) → one **fix round** by the implementers.
5. **Re-evaluation** with evaluator + skeptic (`2-coverage.js`, `AFTER_BUILD=true`) → a final config round on the
   remaining config-fixable gaps → final review → completion report.
6. After customer feedback: **research round** (read-only: mechanics of the requested feature, whitespace audit, data
   plan) → apply on one page → customer OK → roll out.

Coordination files: `requests/<agent>.md` (asks to another owner; the orchestrator relays them to running agents),
`ui-needs/<agent>.md` (what the design phase must place), `reports/<agent>.md` (what was done, how verified, what
remains). Separate test accounts per parallel screenshotting agent; at most two browsers at a time.

## Templates

### Functional domain agent
```
<CONTEXT, WRITE>
You are agent `<name>`. Your ownership (BRIEF): <tables / objects>. Close the gaps of requirements <ids> in
<work>/data/remediation-plan.json (items[] with fix steps) and coverage-verdicts.json (gaps), following the default
decisions in BRIEF. Work in scripts under build/steps/<name>/, DRY=1 first. Do not edit pages, sides or templates:
write UI needs to ui-needs/<name>.md. Anything outside your ownership → requests/<owner>.md. Verify each change
(getters, view-count-as.ts as the right account, static automation checks) and finish with reports/<name>.md:
per requirement id — changed objects, verification, what remains and why.
```

### Design lead (no writes to the base)
```
<CONTEXT, READ-ONLY>
Write <work>/design/SYSTEM.md (start from the skill's references/design-system-template.md, including its "Corrections
after the customer review") and <work>/design/IA.md: for every side, the menu tree and every page (shell, blocks in
order, which view/template, filters, copy in Persian), plus every expand template. Brand from the customer's own
documents (measure the logo vector). Check every snippet against the frontend code and render the TEXT components in
the running app in light and dark (preview/). Read all ui-needs/*.md so every need has a place.
```

### Portal implementer
```
<CONTEXT, WRITE: sides <ids>, their pages and templates, and display settings of views you place>
Build <portal> exactly per design/SYSTEM.md and design/IA.md. Scripts in build/steps/<name>/, components as functions
in a ui.ts module, TEXT HTML joined to one line, block ids from randomUUID(). Snapshot the side/pages/templates before
the first write. After each page: shot.cjs as the page's audience, desktop + MOBILE=1, look at the image, fix, repeat.
Apply the SYSTEM.md §10 checklist per page. Report deviations from SYSTEM.md with the reason (code citation).
```

### Visual QA reviewer (independent, read-only)
```
<CONTEXT, READ-ONLY>
Screenshot every published page of every side as its audience (desktop 1366 and mobile 390; one dark pass), and open
one record of every template. Look at every image. Grade findings P0 (broken, embarrassing, misleading) / P1 / P2 with
page, role, screenshot path, cause (config or platform, with code citation) and the config fix. Answer per portal:
"would I show it to the customer today?". Write <work>/qa/QA-REPORT.md.
```

### Re-evaluator and skeptic
Use `scripts/workflows/2-coverage.js` with `AFTER_BUILD=true`. Key instructions already in the script: judge from
scratch, treat reports as claims, count a correctly wired but inactive automation as configured with
`blocked_by:"activation"`, one verdict per id.

### Whitespace auditor (read-only)
```
<CONTEXT, READ-ONLY>
Screenshot every published page as its audience at 1366×2400 (and a few at 1366×1080). For each, measure the blank
share of a 1080 screen below the last content row. For each issue classify LAYOUT / EMPTY-DATA / both and give a
concrete fix with platform blocks (help side-column, featured xl gallery with cover, Grid for tabular items,
record-conditional empty state, KPI strip, form in a dialog, step explainer, page background). Worst first.
```

### Demo-data planner (read-only) and seeder
```
<CONTEXT, READ-ONLY>
Plan the demo-data operation for base <id> per the skill's references/demo-data.md: measure records per table; list
EVERY view placed on a page or template of every side and every STATS tile, with the account that sees it and the
minimum rows it needs (view-coverage.json); design ≈<n> mock rows per table that make all of them non-empty for the
right account, realistic Persian content without test words, dates as offsets from demo day; list galleries needing
cover images. Write <work>/round2/DATA-PLAN.md.
```
The seeder then executes the phases with the gates, one gate per message back to the orchestrator; the orchestrator
asks the user before phase 3 (hiding real data).

### Product-feedback collector (read-only)
```
Mine reports/*.md, qa/, reeval/ (gaps blocked_by platform), requests/, BRIEF lessons, DESIGN-GUIDE known bugs and the
completion report. Write documents/<customer>/AIRSHEET-PRODUCT-FEEDBACK.md (Persian): security bugs (class and code
location, never an exploit recipe), functional bugs, UI bugs/limits, improvements, feature requests; each with what
happens, file:line, impact, suggested fix, how it was found. Verify each code location still exists.
```
