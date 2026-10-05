---
name: airsheet-base-redesign
description: Designs and builds Airsheet bases by configuration (tables, fields, automations, roles, portals/sides, pages, expand templates, forms) in two flows that both end in a new base after the user approves a design. (1) From an existing base — read an old or unsatisfying base, diagnose it, propose a complete new design (data model, automations, roles and portals, pages and modules) and, once approved, build it in a NEW base, optionally migrating its data. (2) From requirements — take a Word, PDF, text or spreadsheet requirement (RFP, spec, forms, meeting notes), turn it into a requirement catalogue and a design, and, once approved, build it. Use whenever someone asks to rebuild, redesign, re-architect, clean up or "do properly" an Airsheet base, to design a base from an RFP or requirement document, to estimate or review such a design, or to verify a built base as its real users — even if the word "redesign" is not used.
---

# Airsheet base design and build

Two flows, one shape: **understand → design package → user approval → build a new base → verify as the users → hand
over**. Nothing is written to a base before the design is approved, and the old base, if there is one, is never
modified.

| Flow | Input | Read |
|---|---|---|
| **1. From an existing base** | a live base id (+ any documents, descriptions, meeting notes) | `references/flow-from-old-base.md` |
| **2. From requirements** | Word / PDF / text / spreadsheet / images | `references/flow-from-requirements.md` |
| Shared: the requirement report, every time a requirement arrives | — | `references/requirement-report.md` |
| Shared: the design package and the approval gate | — | `references/design-package.md` |
| Shared: building and verifying the new base | — | `references/build-new-base.md`, `references/verification.md` |

Ask which flow applies when it is not obvious. If the user has both (an old base plus a new requirement document), run
flow 1 and feed the document into its requirement catalogue.

Always load `references/platform-lessons.md` before designing: it lists the platform behaviours that silently produce
wrong results (query builder dropping conditions, `is not` dropping empty rows, automations that never fire, portal
visibility, lossy restores…). A design that ignores them gets rebuilt. Load `references/design-guide.md` before any page,
template or view-display decision.

## Non-negotiables

1. **Know where the databases are.** Local Mongo/Redis/Splunk are often SSH tunnels to a shared test server: every write
   is real and visible to colleagues. Never point anything at production. Never trigger real SMS, email or external
   APIs: automations stay inactive during the whole build; external calls go to a mock.
2. **Read-only until the design is approved.** The approval covers the design package, the scope (configuration only or
   platform code too), brand, test accounts, the default answers to open questions, and any data migration.
3. **Build in a new base; never modify the old one.** The old base stays the reference and the fallback until cutover.
4. **Write only through `scripts/lib.ts`** (the UI's own resolvers, schema + DTO validation, base scoping, Bull-worker
   guard, `DRY=1`, `changes.log` with previous values). No raw Mongo writes: integrity hashes lock every role out.
5. **Every write is `DRY=1` first, then applied, then re-run to show it is idempotent.** Deleting anything needs a raw
   backup in `<workspace>/snapshots-private/` and the user's explicit request.
6. **Persistent work dir, never `/tmp`.** Raw snapshots and record exports hold API keys and personal data:
   `<workspace>/snapshots-private/` (mode 700), never printed.
7. **Never print secrets, even in read-only summaries.** Automation URLs carry `?apiKey=…`, payloads and headers carry
   tokens: print URLs without the query and never whole `options`.
8. **The live base is the source of truth**, not an AI-written description of it or a build agent's report. Every
   verdict is re-checked by a skeptic.
9. **"Done" means seen as the user.** Every portal is checked as its real user and as anonymous, every page is
   screenshotted as its audience, no list on a portal page is empty for the demo accounts (`scripts/crawl-lists.cjs`).
10. **Platform code only on request.** Needs that configuration cannot meet are listed in the design as `build` items.
    If the user asks for the code: one branch per item, tests with a negative control, CI-identical run
    (`references/code-changes.md`). Know which checkout the dev server runs before debugging it.
11. **Reports state only what is true.** Every platform claim is backed by code read or a test run in this session;
    an empty section says «موردی وجود ندارد» instead of an invented item; the length follows the size of the problem
    (`references/requirement-report.md` «Truthfulness rules»).

## Setting up a project

```bash
W=<workspace>/<project>-build; mkdir -p $W/{build,design,data,inputs,reports,shots} <workspace>/snapshots-private
chmod 700 <workspace>/snapshots-private
cp ~/.claude/skills/airsheet-base-redesign/scripts/*.* $W/build/
# flow 1: "source" is the old base (read-only); "base" is added when the new base exists
printf '{"source":"<oldBaseId>","owner":"<ownerUserId>","frontend":"http://localhost:9003"}\n' > $W/build/project.json
# test-account passwords only here: $W/build/.accounts.json {"role":["09…","…"]}  chmod 600
cd <workspace>/cloud-back && AIRSHEET_BASE=<oldBaseId> DRY=1 npx tsx $W/build/smoke-read.ts   # read-only check
export PLAYWRIGHT_MODULE=<path to the playwright package>   # for shot.cjs / crawl-lists.cjs
export CHROMIUM_PATH=<path to chrome-headless-shell>
```

Keep a diary in `$W/memory.md` from the first hour: ids, decisions, what happened, open items.

## Scripts

All read `project.json` next to them; run TS ones from the cloud-back checkout with `npx tsx`. `AIRSHEET_BASE=<id>`
overrides the base for one run, which is how flow 1 reads the old base.

| Script | Does |
|---|---|
| `lib.ts`, `smoke-read.ts` | the only write path: getters, mutators, `createBase`, record and migration helpers (`references/lib.md`); read-only smoke test |
| `dump-base.cjs`, `splunk-query.ts` | read-only structural dump with names instead of ids, secrets redacted; record counts |
| `extract-inputs.py` | text out of docx (+ embedded mockups), pdf and saved HTML descriptions |
| `shot.cjs` | screenshots per role, desktop / `MOBILE=1` / `THEME=dark`, one saved login per role |
| `view-count-as.ts` | rows a view returns for given mobiles and for anonymous, as the server evaluates them |
| `crawl-lists.cjs` | opens pages as a role, clicks every tab, reports every empty list (exit 1) |
| `portal-invariant.ts` | every view reachable from a portal side is user-scoped or listed for review |
| `workflows/1-understand.js`, `2-coverage.js`, `3-remediation.js` | Workflow-tool scripts: catalogue, coverage, gap plan |
| `build-report.py` + `report-template.html` | a self-contained RTL HTML report (design or comparison) from a JSON |

## Supporting playbooks

| Need | Read |
|---|---|
| Customer review after a demo (taste feedback, whitespace, "make it like this screenshot") | `references/playbook.md` «Customer review» |
| Meeting notes or a transcript → gap list | `references/playbook.md` «Meeting notes» |
| Fewer automations (consolidation) | `references/playbook.md` «Automation consolidation» |
| Demo data with backup and restore | `references/demo-data.md` |
| Many agents in parallel (ownership, BRIEF.md) | `references/brief-template.md`, `references/agent-prompts.md` |
| A design system for the portals | `references/design-system-template.md` (filled example in `references/examples/`) |
| Platform code a need requires | `references/code-changes.md` |

## Deliverables

Persian for anything the customer or the product team reads.

- **Requirement report** (HTML, or Word on request) each time a requirement or a scope change arrives: questions for
  the customer, decisions for the user, blockers, verified bugs, targeted improvements, new features, other —
  `references/requirement-report.md`.
- **Design package** (`design/DESIGN.md` + an HTML version for the customer) — `references/design-package.md`.
- **Completion report**: security findings first, requirement coverage (flow 1: old base vs new base), what was built
  with ids, decisions and their defaults, the go-live list.
- **Product feedback**: platform bugs and feature ideas met on the way, categorised, for the Airsheet team.
- New general platform lessons go into `references/platform-lessons.md`, so the next project benefits.
