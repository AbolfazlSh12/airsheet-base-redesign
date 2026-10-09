# Auditing a built base against its requirement document: critique → plan → implement → verify

Use it in two situations:
- as the **done-gate of every build** (flow 2 after B2, flow 1 against the catalogue);
- when the user asks to check a base against an RFP, to say what is missing, to criticise it, or to "implement what the
  customer needs but was not done".

The audit plays the customer's toughest reviewer. It assumes nothing the design package or a build report says. Its
evidence is the live base and the document. It produces a ranked list of unmet needs, each with a configuration fix,
then (when asked) a precise plan, then the implementation and its proof. Read `rfp-analysis.md` first: the audit walks
its ledger.

## G1. Evidence

1. Fresh dump and lint, read-only:
   ```bash
   node build/dump-base.cjs <baseId> data/dump-<date>.json && node build/lint-base.cjs data/dump-<date>.json
   ```
   The dump shows menu role filters (`who`), form inputs (REQ/HIDDEN/COND), Pivot2/Dashboard layouts, tab role filters,
   field limits, constraints, action recipients. If the dump lacks something, query Mongo read-only before you claim it
   is missing. An earlier dump hid the menu role filters, and the audit wrongly reported "menus not role-based".
2. Counts that expose gaps immediately: views per type (zero `Pivot2`/`Dashboard` while the document asks for charts),
   pages per role, active automations, constraints per table, forms per actor.
3. **Design vs base diff.** List every object the design package promised (pages, blocks such as PROGRESS, constraints,
   views, menu filters, automations) and check each exists. Objects promised but not built were the largest group of
   misses on the reference project.

## G2. Walk the ledger

For each requirement line: current state with evidence (object names), verdict `met | partial | missing`, and the
configuration that would meet it. Judge the whole chain, not just one piece: data → form → the right actor's page →
access → automation → report. The checklist of what audits find most often:

- **Reports**: one per dimension and level the document names, trend, shares, a dashboard page for the management role,
  exports; none grouped by a link field (lint rule).
- **Day-one readiness**: features that only work once automations run (auto-filled links that pickers filter on, dates,
  snapshots, budget links, notifications). Automations with an empty recipient, and `create`-triggered messages that
  read lookups.
- **Pre-submit gates**: stock, quota or budget limits checked **before** the requester submits, with the reason shown.
- **Workflow evidence**: approver and approval time stamped, reject reason required, recipient's confirmation, status
  progress visible to the requester.
- **Access**: separation of duties on approvals, one actor per button, status only through buttons, requester and
  approver in separate record roles, «all scopes» tabs hidden from scoped roles.
- **Levels**: quota, budget, classification and reports at every level listed (A5 matrix).
- **Formulas**: every parameter the document names is used; thresholds absolute vs relative as decided; defined
  fields that nothing uses (a "minimum stock" no status reads).
- **Columns and enums**: every column of every table in the document is a field or mapped; every enum value reachable.
- **Validation**: uniqueness on codes, mobiles and natural keys; value limits on quantities, prices, scores.
- **Forms**: every field the document lists for that form.
- **Profile**: role and access shown, own contact data editable, organisational data read-only.
- **Control lists**: overdue, expiring, expired, over-limit, over-stock, duplicates. A list whose empty state is
  healthy may stay empty; say so.
- **Silent failures already in the base**: lint errors (a formula that never computes, an update automation watching
  nothing).
- **Demo data**: every new view has rows that prove it.

## G3. Truth before writing

Every platform claim is backed, in this session, by code read (file:line, branch or commit) or a run. A memory, an older
report or this skill is a lead, not evidence. Mark what was not tested as «تست‌نشده». When an earlier claim of yours was
wrong, correct it in writing in the next report.

## G4. The critique (Persian, in chat or as a report)

- One paragraph on the customer's pain, in the customer's words.
- The list, ranked: **critical** (does not work in real use, or a core promise of the document is absent), **high**,
  **medium**, **low**. Each item: the document's section or quote → what exists now (evidence) → what is missing → the
  configuration fix in one line.
- Decisions that diverge from the document (A9), questions only the customer can answer, items that need code (listed
  but excluded), and things noticed but not fixed.

## G5. The plan (when the user asks "what exactly would you do")

1. **Decisions** with a recommended default, only those that change what is built.
2. **Spikes** for unknowns. Learn a view's or block's JSON shape by reading existing views of that type on the server
   (read-only, structure only). Learn semantics (constraints, limits, signatures) by reading the resolver code. Do this
   before scripting.
3. **Layers in build order**, with exact names and expressions: fields and formulas, constraints and limits,
   permissions, views, forms, pages and templates, automations (inactive), demo data, verification, estimate.

## G6. Implement (configuration only, after the user says go)

- **Raw structure snapshot first** (`snapshots-private/<base>-before-<round>/`, read-only Mongo export of tables,
  fields, views, sides, pages, templates, automations, actions, roles, user and record roles).
- **Change the declarative build** (the project's `spec.ts` and `steps/*`), not ad-hoc one-off scripts, so the base
  stays rebuildable and every step stays idempotent: `DRY=1` → apply → `DRY=1` shows 0 changes.
- Unanswered decisions: use the recommended defaults and list them in the report.
- **Run from a checkout you own.** Create a git worktree of cloud-back at the commit the build uses, with
  `node_modules` symlinked and `.env` copied. Another session switched a shared checkout's branch mid-build once, and
  every lib import broke.
- **Demo rows keep their keys.** Give new mock rows their own key prefix. Inserting rows before existing ones under a
  global counter re-keys them all, and `importRows` then creates duplicates (50 duplicate document rows doubled the
  stock once).
- **Waiting on a long step**: wait on its PID. `pgrep -f "<script>"` also matches your own wait loop, and `pkill -f`
  kills the shell running it.
- Deleting anything, even rows you created by mistake: raw backup plus the user's explicit yes.

## G7. Verify and close

- An independent recomputation of the new logic from raw rows (stock, routing, quotas, classes, statuses) in the
  project's `check-data`.
- `check-constraints.ts` (every rule rejects a duplicate and accepts a fresh value).
- Static automation scenarios with the engine's `filter.match` (records need `table` for field types).
- `lint-base.cjs` 0 errors, `crawl-lists.cjs` per role, `view-count-as.ts` for each new portal view (user vs
  anonymous), `portal-invariant.ts`.
- Screenshots of the new pages (`shot.cjs`) and of record dialogs (`shot-record.cjs`). After opening a record as the
  owner, re-run the pages step; the editor may have rewritten the template.
- Report: what was done per item, defaults used, evidence, corrections of earlier claims, what is still open (test
  accounts, customer inputs, activation), noticed-but-not-fixed. Append a dated section to `DESIGN.md`, a diary entry,
  product feedback, and new lessons to `platform-lessons.md`.
