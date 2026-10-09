# The design package and the approval gate (both flows)

The design package is the contract between you and the customer. It is written before anything is created, reviewed by
two independent agents, shown to the user, and approved. Tables, field types and portal structure are expensive to
change once records exist, so the time goes here.

Inputs: the requirement catalogue (`data/catalogue.json`), the decision list (`data/decisions.md`), and in flow 1 the
diagnosis of the old base (`data/diagnosis.md`).

## `design/DESIGN.md` — sections, in this order

1. **Summary.** What the base is for, who uses it, the scope (configuration only, or with platform code), the source
   (old base id and/or documents), the size (tables, portals, automations), and what is deliberately out of scope.
2. **Actors and access matrix.** One row per actor: staff role, portal user or anonymous visitor; how they log in; what
   they may see, create, edit and delete per table; the portal (side) they use. Write the row-level rule that limits a
   portal user to their own rows (a `has my mobile` filter, a record role, a user role with `accreditView`). Never share
   one view between staff and a portal: plan a portal copy (`platform-lessons.md`, «Access model»).
3. **Data model.**
   - Tables: name, purpose, primary field (what a row is called inside a link), expected row count, requirement ids.
   - Fields per table: name, type, options with colours, required, default, validation (field limits, table
     constraints), and for link, lookup, rollup and formula fields the exact target or expression. Status fields are
     single-selects with one coloured option per state.
   - A relation diagram (Mermaid `erDiagram`) of the links.
   - Snapshot vs reference: when a child row must keep the value it had at creation (a price, a remaining quantity),
     store a copy, not only a lookup.
4. **Processes and automations.** One row per process: trigger type (create / update with watched fields / form / match
   / cron / period), conditions, actions in order, the guard that keeps it from firing twice, and the external system it
   calls. Read «Engine facts» in `platform-lessons.md` first: `update` never fires on create, action conditions see the
   snapshot at trigger time, `cron` gets an empty record. All are created **inactive**; list the activation checklist.
5. **Roles and portals (sides).** For every side: type (collaborator / user / visitor), who gets in (roles, user role,
   accredit view or form), layout (header or sidebar), menu items, and the pages behind them.
6. **Pages and modules.** Group the base into modules (a business area such as «درخواست‌ها», «قراردادها», «گزارش‌ها»).
   For each page: audience, purpose, the blocks it holds (hero, KPIs, lists with their views and filters, forms,
   actions), and the expand template a row opens in. Follow the shells in `design-guide.md`; no list may be empty for a
   demo account.
7. **Forms.** Every form: version (v2 for anything with pages, conditional blocks or an API table), fields, required
   rules, link pickers (which view; portal pickers are Gallery views with a user filter), what opens after submit.
8. **Notifications.** Who is told what, when, through which channel (in-app, SMS, email), and how duplicates are
   prevented.
9. **Reports and dashboards.** KPIs (with their filters per audience: portal KPIs count only the user's rows), charts,
   exports.
10. **Integrations.** Every external system: direction, trigger (automation REST action, or an API table in a form for
    on-demand reads), authentication, the request and response shape, and what is still unknown. Never a real endpoint
    during the build: name the mock.
11. **Look.** Palette, logo, typography decisions, and which page shells are used (`design-system-template.md`).
12. **Decisions and defaults.** Every open question with the recommended default, numbered, so the customer can confirm
    or change each one.
13. **Traceability.** Requirement id (and its ledger lines, `rfp-analysis.md`) → the objects that cover it (table, field,
    view, form, automation, page). Every requirement that is not `external` must appear; every table column and enum
    value of the document appears through its ledger line. Add the levels × features matrix and the **divergence
    register** (each departure from the document's text, quoted, with its reason). Mark operational dependencies:
    requirements that only work once an automation is active. `build` items (need platform code) and `external` items (need a
    third party) are listed separately with what they need.
14. **Flow 1 only: old → new.** What is kept, merged, split, renamed or dropped (tables, fields, automations, roles,
    sides, pages), with the reason; and the data-migration plan (`flow-from-old-base.md`, step 6).
15. **Build plan and effort.** The build order (`build-new-base.md`), how many agents, an estimate per part, and the risks.

Keep ids out of the package (they do not exist yet). Use names, and in flow 1 cite old objects by name and id.

## Review before showing it

Run two agents in parallel, both read-only:

- **Skeptic**: reads the document itself, not only the catalogue, and hunts requirements with no object behind them,
  table columns with no field, levels built for one level only, reject paths without a reason, approvals without a
  stamped approver, gates the document puts "before final submission", portal views without a user filter, links in
  the wrong direction, missing statuses and transitions, automations that can fire twice, KPIs that count other users'
  rows.
- **Platform checker**: reads `platform-lessons.md` and `design-guide.md` and hunts constructs the platform silently
  mishandles (filters the query builder drops, `is not` on optional fields, Grid pickers in forms, readable ids on link
  targets, dialogs with lists on user sides).

Fix what they find, note what you rejected and why.

## Presenting it

- A Persian HTML version for the customer (`build-report.py` with a design JSON, or a hand-written page), with the
  relation diagram, the access matrix and the page list. Publish or share only when the user asks.
- In chat: a short summary, the counts (tables, fields, automations, portals, pages), the decision list, the `build`
  and `external` items, the effort, and the questions only the user can answer.

## The approval gate

**Stop and wait.** Build nothing until the user approves, in writing, the package and these points:

- scope: configuration only, or platform code for the `build` items too;
- owner account of the new base (a team test account, never a customer's account) and test accounts per role;
- the default for every open decision (they may answer "use your defaults");
- flow 1: whether and which data is migrated, and whether the old base must stay untouched until cutover.

Record the approval with its date in `memory.md`. Later changes to the approved design go back through the package
(a dated change section), not straight into the base.

Every object the package names (page, block, view, constraint, automation, menu filter) becomes a checklist line for
the build. `gap-audit.md` G1 diffs the package against the live base; promised-but-not-built objects were the largest
group of misses on a real project.
