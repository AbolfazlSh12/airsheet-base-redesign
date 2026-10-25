---
name: airsheet-base-redesign
description: Designs and builds Airsheet bases by configuration (tables, fields, automations, roles, portals/sides, pages, expand templates, forms) in three flows; the first two end in a new base after the user approves a design. (1) From an existing base — read an old or unsatisfying base, diagnose it, propose a complete new design (data model, automations, roles and portals, pages and modules) and, once approved, build it in a NEW base, optionally migrating its data. (2) From requirements — take a Word, PDF, text or spreadsheet requirement (RFP, spec, forms, meeting notes), turn it into a requirement catalogue and a design, and, once approved, build it — after reading the document as the customer's critic (pain map, sentence-by-sentence ledger, every table column, workflow step and organisational level traced). (3) Audit a built base against its requirement document — list every customer need the base does not meet, ranked, with the configuration fix, then plan and implement the fixes and prove them. Use whenever someone asks to rebuild, redesign, re-architect, clean up or "do properly" an Airsheet base, to design or build a base from an RFP or requirement document, to criticise a base against an RFP or say what the customer needs that was not implemented, to estimate or review such a design, or to verify a built base as its real users — even if the word "redesign" is not used.
---

# Airsheet base design and build

One shape: **understand (as the customer's critic) → design package → user approval → build → verify as the users →
audit against the document → hand over**. Nothing is written to a base before the design is approved, and the old
base, if there is one, is never modified.

| Flow | Input | Read |
|---|---|---|
| **1. From an existing base** | a live base id (+ any documents, descriptions, meeting notes) | `references/flow-from-old-base.md` |
| **2. From requirements** | Word / PDF / text / spreadsheet / images | `references/flow-from-requirements.md`, starting with `references/rfp-analysis.md` |
| **3. Audit a built base against its document** | a base id + the RFP or spec it was built from | `references/rfp-analysis.md`, then `references/gap-audit.md` |
| Shared: the requirement report, every time a requirement arrives | — | `references/requirement-report.md` |
| Shared: the design package and the approval gate | — | `references/design-package.md` |
| Shared: building and verifying the new base | — | `references/build-new-base.md`, `references/verification.md` |

Ask which flow applies when it is not obvious. If the user has both (an old base plus a new requirement document), run
flow 1 and feed the document into its requirement catalogue. Flow 3 is also the last step of flow 2: no build from a
document is done before it has been audited against that document.

**Why the critic's reading matters.** On a real RFP project the first build had a catalogue, a reviewed design and a
verified base, and a hostile re-read of the RFP still found 28 unmet needs, 4 of them critical. Examples: reports and
dashboards were missing, a message the document asked for "before final submission" twice was absent, a feature asked
"at every level" existed at one level, and the base only worked once automations were activated. None of these were
platform limits. They came from reading habits, which `rfp-analysis.md` replaces with a traced ledger.

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
   Flow 3 extends the base *this project built* (after a raw structure snapshot); it never touches a customer's
   production base or a base someone else owns without the user's explicit instruction.
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
   Catalogue-like galleries, category tiles and heroes show the customer's **real photos** (`references/asset-pipeline.md`);
   a generated placeholder is a day-one dependency the report must name, not a finished page.
10. **Platform code only on request.** Needs that configuration cannot meet are listed in the design as `build` items.
    If the user asks for the code: one branch per item, tests with a negative control, CI-identical run
    (`references/code-changes.md`). Know which checkout the dev server runs before debugging it.
11. **Read every requirement document as the customer's critic** (`rfp-analysis.md`): pain map, sentence ledger with
    every table column and enum value, workflow steps (approval and rejection), roles, levels × features, day-one
    dependencies, divergence register. Nothing is designed from impressions of the document.
12. **Done means audited against the document, not against the design** (`gap-audit.md`): the design is diffed against
    the live base and every ledger line is walked; configuration gaps are closed before the completion report.
13. **Reports state only what is true.** Every platform claim is backed by code read or a test run in this session;
    an empty section says «موردی وجود ندارد» instead of an invented item; the length follows the size of the problem
    (`references/requirement-report.md` «Truthfulness rules»).
14. **Route every read and write through the skill's scripts.** The desktop app's permission classifier refuses ad-hoc
    `node -e` Mongo reads, home-wide searches that name credential files, and one-off steps that create fields or
    automations on a live base; `dump-base.cjs`, `splunk-query.ts` and `lib.ts` steps pass. When a creation step is
    refused, leave the DRY-tested step in `build/steps/` and hand it to the user instead of retrying in another form.
15. **A design change removes what it replaces, in the same round.** Superseded tables, fields, views, templates,
    record roles and pages are not "kept but unused": a colleague maintaining the base cannot tell them from the live
    design, and portal pages kept showing an old model's numbers. Order: platform backup → `unused-inventory.ts` →
    repoint every page/view still showing the old objects → stop external writers (jobs) using them → user's OK →
    one idempotent cleanup step that deletes by name → remove them from the build steps → `DELETED_SINCE=…` shows
    no reference left (`build-new-base.md` «Removing a superseded design»).
16. **One mobile number per role, for test and preview accounts too.** The server keeps only the last record role
    that matches a user (`platform-lessons.md`, record roles): one mobile on «unit», «expert» and «evaluator» rows
    edits as the evaluator everywhere and the self-assessment looks broken. Give each role its own account; tell the
    customer's users the same in the hand-over guide.
17. **UI edits are input, not noise.** Before applying any page, view or template step, read its `DRY=1` diff: a
    change you did not write is an editor autosave or someone's deliberate edit in the UI (a colleague renaming a tab,
    adding a record title). Write it into the step first, then apply; never apply over it. Edits that would help every
    base (e.g. "every record template shows its title") go into this skill.

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

Before the first lib run: the base's search engine may be addressed by a server-internal name (`https://cloud-log:8089`,
resolved through /etc/hosts) that the shell's `HTTPS_PROXY` intercepts (every base-scoped query answers 503 while the
default engine works). Put `export NO_PROXY=$NO_PROXY,cloud-log` and `AIRSHEET_BACKEND` in `$W/build/env.sh` and
`source` it before every `npx tsx` run. Keep `$W` inside the customer's folder and hand `build/` (minus `.accounts.json`
and `.auth/`) over with the completion package: a build whose `steps/`, `changes.log` and `keys.json` are lost cannot be
extended or proven idempotent later (the SafarClub upgrade had to rebuild `project.json` from a dump and re-derive every id).

Keep a diary in `$W/memory.md` from the first hour: ids, decisions, what happened, open items.

Run the TS scripts from a cloud-back checkout you own. Shared checkouts change branch under you, and once that broke
every import mid-build:

```bash
git -C <workspace>/cloud-back worktree add --detach $W/cloud-back-wt <commit>   # the commit the build uses
ln -s <workspace>/cloud-back/node_modules $W/cloud-back-wt/node_modules && cp <workspace>/cloud-back/.env $W/cloud-back-wt/
```

## Scripts

All read `project.json` next to them; run TS ones from the cloud-back checkout with `npx tsx`. `AIRSHEET_BASE=<id>`
overrides the base for one run, which is how flow 1 reads the old base.

| Script | Does |
|---|---|
| `lib.ts`, `smoke-read.ts` | the only write path: getters, mutators, `createBase`, record and migration helpers (`references/lib.md`); read-only smoke test |
| `dump-base.cjs`, `splunk-query.ts` | read-only structural dump with names instead of ids, secrets redacted (`base.owner` = creator id, so a lost `project.json` can be rebuilt); record counts |
| `extract-inputs.py` | text out of docx (+ embedded mockups), pdf and saved HTML descriptions |
| `shot.cjs` | screenshots per role, desktop / `MOBILE=1` / `THEME=dark`, one saved login per role |
| `shot-chrome.sh`, `probe-chrome.cjs` | no-Playwright fallback with the system Chrome: anonymous-page screenshots (desktop, and `MOBILE=1` through DevTools emulation) and a layout probe (`scrollWidth` vs viewport, widest elements, any JS expression, `SHOT=` screenshot) |
| `view-count-as.ts` | rows a view returns for given mobiles and for anonymous, as the server evaluates them |
| `crawl-lists.cjs` | opens pages as a role, clicks every tab, reports every empty list (exit 1) |
| `portal-invariant.ts` | every view reachable from a portal side is user-scoped or listed for review |
| `lint-base.cjs` | static lint of a dump for constructs the platform silently mishandles (link-grouped reports, never-computed formulas, signature conditions, empty recipients…); exit 1 on errors |
| `unused-inventory.ts` | read-only: unused tables / fields / views / templates / pages / empty record roles (side templates count as used; default «همه» columns and table layouts do not); `WHY="<table>\|<field>"` who uses one field; `DELETED_SINCE=<ts>` references left after a cleanup |
| `check-constraints.ts` | proves every table constraint rejects a duplicate and accepts a fresh value (server's own check, read-only) |
| `shot-record.cjs` | screenshot of a record dialog (expand template) as a role, by clicking a card on a page |
| `workflows/1-understand.js`, `2-coverage.js`, `3-remediation.js`, `4-feature-map.js`, `5-explain-base.js` | Workflow-tool scripts: catalogue, coverage, gap plan, feature ↔ requirement map with skeptics, plain-Persian explanation of every page/template/table/automation |
| `build-report.py` + `report-template.html` | a self-contained RTL HTML report (design or comparison) from a JSON |
| `base-graph.py` | the planned base as an interactive graph (roles → portals → pages → tables, table links) + access matrix, from `design/base-graph.json`; flags unreachable tables, pages on no side, pages that list a table their audience cannot view |
| `visual-kit.ts` | page building blocks in the look customers accepted: `pageDoc` (per-side background: wash + pattern, `PATTERN_STRENGTH`), `hero`, `info`, `heading`, `card`, `cols2`, `tabs`, `view`, `navCards`, `sideHeader`, `assertKept` (a rebuilt page keeps every view/embed/link) — design-guide rules 26, 31–34 |
| `new-forms.ts`, `page-lint.ts`, `quiet-layouts.ts` | post-process run last: every list with «جدید» opens its table's form; read-only lint of pages and side headers (exit 1); writes the editor's mount defaults so opening a page or template as the owner does not autosave |
| `make-brand.py`, `attach-images.ts`, `init-project.cjs`, `preflight.sh` | placeholder brand set (mark + wordmark, shaped Persian text); photos onto records by name; rebuild `project.json` from a dump; hour-zero environment check |

## Supporting playbooks

| Need | Read |
|---|---|
| Customer review after a demo (taste feedback, whitespace, "make it like this screenshot") | `references/playbook.md` «Customer review» |
| Meeting notes or a transcript → gap list | `references/playbook.md` «Meeting notes» |
| Fewer automations (consolidation) | `references/playbook.md` «Automation consolidation» |
| Demo data with backup and restore | `references/demo-data.md` |
| Many agents in parallel (ownership, BRIEF.md) | `references/brief-template.md`, `references/agent-prompts.md` |
| A design system for the portals | `references/design-system-template.md` (filled example in `references/examples/`) |
| Photos: asking for them on day one, mapping a folder to records, upload once, photo hero / banner recipe (SECTION + baked tint, `darken-hero.py`), mobile overflow probe | `references/asset-pipeline.md` |
| Preparing a built base for a customer demo: plain-Persian user guide and client presentation, brand placeholder, dashboard pattern, hand-over checklist | `references/demo-readiness.md` |
| Platform code a need requires | `references/code-changes.md` |

## Deliverables

Persian for anything the customer or the product team reads.

- **Critique / gap list** (flow 3, and at the end of flow 2): ranked unmet needs with evidence and the configuration
  fix, divergences from the document, customer questions, code-only items — `references/gap-audit.md` G4.
- **Requirement report** (HTML, or Word on request) each time a requirement or a scope change arrives: questions for
  the customer, decisions for the user, blockers, verified bugs, targeted improvements, new features, other —
  `references/requirement-report.md`.
- **Design package** (`design/DESIGN.md` + an HTML version for the customer, which always carries the architecture
  graph from `scripts/base-graph.py`) — `references/design-package.md`.
- **Completion report**: security findings first, requirement coverage (flow 1: old base vs new base), what was built
  with ids, decisions and their defaults, the go-live list.
- **Feature → requirement map** («این قابلیت کدام جمله‌ی سند را برآورده می‌کند»): one row per built capability with its
  objects (names + ids), the requirement ids and the document sentence, verified against a dump taken *after* the last
  write. It is what a customer asks first («این چه کار می‌کند؟») and it is the input of the next audit.
- **Product feedback**: platform bugs and feature ideas met on the way, categorised, for the Airsheet team.
- **Hand-over guide for the people who will run the base** (Persian, non-technical, 1–2 pages): what each role does,
  one mobile per role, multi-step actions spelled out («ثبت دوره» ≠ «باز کردن دوره», where each button is), what
  makes a record editable, what not to change in the editor.
- New general platform lessons go into `references/platform-lessons.md`, so the next project benefits.
