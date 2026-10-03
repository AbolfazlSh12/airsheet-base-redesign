---
name: airsheet-base-redesign
description: End-to-end playbook and tooling for building a new Airsheet base from a customer's RFP and documents, or auditing, completing, redesigning or comparing an existing one, by configuration (tables, fields, views, portals/sides, pages, expand templates, roles, automations) rather than platform code. Use whenever someone asks to audit or assess a customer's Airsheet base, check whether a base (or an AI-written "atlas" of it) covers the customer's requirements, compare two or more bases, build a requirement catalogue from a live base, complete or refactor a base, redesign its portals and pages to look professional, verify a portal as a real portal user, prepare demo/mock data with backup and restore, make sure no portal list is empty, reduce or consolidate a base's automations, turn a customer meeting transcript into a gap list, make a platform code change a customer need requires, build a base from scratch out of an RFP, spec, forms or spreadsheets a customer sent, or repeat "what we did for SRM / the first customer" for another customer — even if the word "redesign" is not used.
---

# Airsheet base redesign

Turns a customer's unsatisfying Airsheet base into a verified, good-looking one, by configuration. First done for the
telecom operator's supplier portal ("SRM") (Sept 2026): 111 requirements, 14 → 71 fully covered, five portals redesigned, ~65 agents
over two days. Everything here is distilled from that project; its raw material stays at
`<workspace>/documents/SRM/` and `<workspace>/srm-build/`.

## Non-negotiables

1. **Check where the databases are.** Local Mongo/Redis/Splunk were SSH tunnels to the team's shared test server:
   every write is real and visible to colleagues. Never point anything at production. Never trigger real SMS, email or
   external APIs: automations stay inactive during the whole build.
2. **Write only through `scripts/lib.ts`** (the UI's own resolvers, schema + DTO validation, base-scoping, Bull-worker
   guard, `DRY=1`, `changes.log` with previous values). No raw Mongo writes: integrity hashes lock every role out.
3. **Read-only until the user agrees the scope** (config-only or code, brand, test accounts, default decisions, record
   deletions). Ask before deleting or hiding any record; the safety layer refuses unapproved deletions anyway.
4. **Persistent work dir, never `/tmp`** (RAM; a reboot wiped a day of research once). Raw snapshots and record exports
   hold API keys and personal data: `<workspace>/snapshots-private/` (700), never printed.
5. **The live base is the source of truth**, not an AI atlas or a build agent's report. Every verdict is re-checked by
   a skeptic; every portal filter is tested as a real user and as anonymous; every page is screenshotted as its audience.
6. Don't change cloud-back/cloud-front unless the user explicitly asks; then one branch per item from a fresh
   `origin/develop`, the repo's own CLAUDE.md, a CI-identical test run and a UI check on a throwaway stack
   (`references/code-changes.md`). Otherwise platform bugs go to the product-feedback file for the team.
7. **Never print secrets, even in read-only summaries.** Automation action URLs carry `?apiKey=…`, payloads and headers
   carry tokens: print URLs without the query and never whole `options`; full copies live in `snapshots-private/`.
8. **Know which code is running before you blame or debug the platform.** Find the dev server's checkout and branch
   (`/proc/<pid>/cwd`, `git reflog`); it may differ from the checkout your scripts use. Never edit a checkout another
   session is committing to: hand over the diagnosis and the patch.
9. **"Done" means seen as the user.** No list on a portal page is empty for the demo accounts (`scripts/crawl-lists.cjs`
   per role, not filter counts); every claim about automations is checked with the platform's own `filter.match` on
   scenario records; correct a wrong earlier claim in writing as soon as you find it.
10. **Every structural or record write is `DRY=1` first, then applied, then re-run to show it is idempotent**; delete an
    automation, view or field only after a raw backup in `snapshots-private/` and with the user's request for that change.

## Workflow

| Phase | What | Read |
|---|---|---|
| G. Greenfield (no base yet) | documents → requirement catalogue + critic → data model + skeptic → **user approval** → `createBase` → build in dependency order → mock data → coverage + portal + visual checks → report | `references/greenfield.md` (replaces A; then B from visual QA on) |
| A. Assess (read-only) | inputs → dumps → atlas audit → requirement catalogue + critic → coverage (evaluator + skeptic) → remediation plan → HTML report | `references/playbook.md` §A, `scripts/workflows/` |
| B. Complete + redesign | BRIEF with ownership and default decisions → research trio → functional agents + design lead → portal implementers → visual QA → fix → re-evaluate → final round → completion report | `references/brief-template.md`, `references/agent-prompts.md`, `references/lib.md` |
| C. Customer review | research the requested mechanics, whitespace audit, apply on one page, roll out | `references/design-system-template.md` (corrections section) |
| D. Demo data | backup → rehearsal → hide real → seed mock → demo → restore, with gates | `references/demo-data.md` |
| C2. Customer meeting / transcript | every request → exists / config gap / code gap / customer decision, from the live base; read-only report, then build what the user picks | `references/playbook.md` «Meeting notes» |
| F. Automation consolidation | backup → group by schedule and table → helper fields + backfill → merge with exclusive conditions → scenario check with `filter.match` | `references/playbook.md` «Automation consolidation», `platform-lessons.md` «Engine facts» |
| P. Platform code (on request) | branch per item, tests + negative control, CI-identical docker run, throwaway stack for UI | `references/code-changes.md` |
| E. Handover | test data removal, key rotation, decisions sign-off, product feedback, memory update | `references/playbook.md` §E |

Always load `references/platform-lessons.md` before planning: it lists the traps that silently produced wrong results
(query builder dropping conditions, `is not` dropping empty rows, automations that never fire, portal visibility,
GC after delete, lossy restores…). Load `references/design-guide.md` before any page, template or view-display work, and
`references/verification.md` before claiming anything works.

## Setting up a new project

```bash
W=<workspace>/<customer>-build; mkdir -p $W/build <workspace>/documents/<CUSTOMER>/data
cp ~/.claude/skills/airsheet-base-redesign/scripts/*.* $W/build/        # lib, shot, dump, checks, report builder
printf '{"base":"<baseId>","owner":"<ownerUserId>","frontend":"http://localhost:9003","keepLinkTables":[]}\n' > $W/build/project.json   # greenfield: omit "base" (greenfield.md G0)
# test-account passwords: $W/build/.accounts.json {"admin":["09…","…"],…}  chmod 600; never in any other file
cd <workspace>/cloud-back && DRY=1 npx tsx $W/build/smoke-read.ts   # read-only; also shows active automations
# shot.cjs on this workstation (2026-09): playwright lives in the npx cache, not in a project
export PLAYWRIGHT_MODULE=~/.npm/_npx/<hash>/node_modules/playwright
export CHROMIUM_PATH=~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
```

Scripts (all read `project.json` next to them; run TS ones from the cloud-back checkout with `npx tsx`):

| Script | Does |
|---|---|
| `lib.ts`, `smoke-read.ts` | the only write path; getters, mutators, `deleteAutomation`, `uploadFile`, record helpers, demo-data helpers (`seedRows`, `tombstoneRaw`, `restoreRaw`, …) (`references/lib.md`); read-only smoke test |
| `dump-base.cjs`, `splunk-query.ts` | read-only structural dump with names instead of ids, secrets redacted; record counts |
| `extract-inputs.py` | text out of saved atlas HTML, docx (+ mockup images), pdf |
| `shot.cjs` | screenshots per role, desktop/`MOBILE=1`/`THEME=dark`, one saved login per role |
| `view-count-as.ts` | rows a view returns for given mobiles and anonymous, as searchAPI evaluates them |
| `crawl-lists.cjs` | opens pages as a role (saved login from `shot.cjs`), clicks every tab, reports every list whose answer was empty (exit 1) |
| `portal-invariant.ts` | every view reachable from a user side is user-scoped or listed for review; templates include the side |
| `workflows/1-understand.js`, `2-coverage.js`, `3-remediation.js` | Workflow-tool scripts for phase A; fill the CONFIG block |
| `build-report.py` + `report-template.html` | the comparison report from a `report.json` |

## Deliverables the user expects (Persian for anything the customer or the product team reads)

- Assessment: comparison report (HTML), requirement catalogue, atlas audit, remediation plan.
- Build: completion report (security findings first, before/after coverage, pre-launch list), `BRIEF.md` decisions.
- Always: `documents/<CUSTOMER>/memory.md` (diary: ids, decisions, what happened, open items) and a categorised
  product-feedback file of platform bugs and feature ideas.
- New general lessons go into `references/platform-lessons.md` of this skill, so the next customer benefits.
