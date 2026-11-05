# Structure rules (walk them at design, and again before hand-over)

Every rule here is a review point on a base that had already passed coverage, the portal invariant, the page lint and
the screenshots (PM evaluation base, a colleague's 27 voice notes, 2026-11-04). The base did what the document asked and
its structure was still wrong. Coverage checks cannot see these; only this list and `scripts/structure-lint.ts` do.

Walk them in the design package (the model checker, `design-package.md`) and before hand-over. A rule you break on
purpose gets a line in the package's decision list with the reason.

## A. The organisation model

- **A1. A singleton is not a table.** The one person or unit at the top of the hierarchy (one vice-president, one CEO)
  is not a table and nothing links to it: every centre is implicitly under it. A column showing the single parent's
  name says nothing, remove it. A per-period summary of the whole organisation is a row per period (a period row, not a
  row of that person).
- **A2. A person who only needs access gets only access.** A user row and a role; no profile fields, link fields or
  rollups nobody reads.
- **A3. Every period or transaction row carries the hierarchy names from the first design** (a lookup through the
  lowest organisational link: unit name, centre name). Reports group and filter on them. Adding them later means a
  schema change and a cascade over thousands of rows while people are entering data.
- **A4. Who defines what is written down.** A matrix in the design package, repeated in the usage guide: one row per
  table with who creates it, who edits it, on which page, and what must exist first. It must answer the questions people
  really ask: how a new expert connects to their activities, the order program → month → activity, what happens at a new
  year. A row with no page behind it is a design hole. The list on that page has a working create form (D3).
- **A5. A table with one row per context gets no list.** Its data goes into the KPI cards. A one-row table repeating
  the cards above it is noise.

## B. Reports

- **B1. A report starts at the viewer's direct children.** The apex and cross-cutting roles see centres; a centre
  manager sees units; never the leaf rows first. Drill-down goes through cards: a card per child → its record template
  with tabs (children, charts, all rows, critical, Gantt). Context filters do this without writing links on thousands of
  rows (`design-guide.md` §4.11: `filterType:"join"`).
- **B2. The title says what the rows are.** A page called «نمای کلی دوره» holding units is a bug. Order sections from
  the highest level down.
- **B3. No flat dumps.** Every list longer than a screen is grouped by the hierarchy or filtered: group on the next
  level, sort by the next one, and give big staff lists a filter bar (`summaryFields` + `freeSearch:true`).
- **B4. In-period lists and averages exclude what has not started** (expected progress 0). The KPI and the list under it
  use one filter: a number you cannot reproduce from its list is wrong.
- **B5. KPI labels stand alone.** «فعالیت در حال انجام», not «در حال انجام» or «کل». **Tabs under KPI cards mirror the
  cards**: same items, same order, same filters.
- **B6. Every computed number has a one-line logic in the usage guide.** A computed field that is provisional or still
  empty is said to be so, on the page or in the guide, with what fills it.

## C. Lists and templates

- **C1. The group field is a column.** It must be in `view.fields`, or its values never reach the client and every row
  lands under an empty group (reported as «نام مرکز خالی است»). Only one group level exists.
- **C2. Group only what fits in 1000 rows.** Lists load 1000 rows and group client-side (`platform-lessons.md`): a
  grouped list over 1000 shows counts summing to exactly 1000, silently wrong. Filter it down, or leave it ungrouped.
- **C3. Every placed Grid has preset widths and wrapped headers**: `layout[0][fieldId]=px`, `theme:{wrapHeaders:true}`
  (`visual-kit.ts` `gridLook`). Cell wrap does not exist, so give text columns room. Check it on a phone.
- **C4. No machine columns.** No type or row-kind columns with one value, count fields on a definition list (on a report
  they are the point), import codes, scope formulas, mobile text copies. People read every column.
- **C5. Few-row objects are cards.** Periods, years and other tables of a few rows are a Gallery with a working expand
  template, not a Grid.
- **C6. Templates hold only what the reader acts on.** No read-only copies of linked records opened inside a record, no
  tabs that repeat the page behind them, no empty tabs.

## D. Entry, admin, look

- **D1. Choose the home from the actors.** Anonymous visitors really exist → a public `visitor` site. Everyone has an
  account → the default side is a `user` side behind login, with a welcome per role. One address for all roles is
  configuration, not core code (`design-guide.md` §10.9).
- **D2. Related objects live together.** One «ساختار سازمانی» page for units, centres and people. A new page goes next
  to its kin in the menu, never appended at the end because it is new.
- **D3. Whoever defines a table can create it from its list.** Design-guide rule 12: `newable:"access"` with its form
  in the «جدید» dialog. `newable:"denied"` on the defining role's list is what produced «فرم ساخت وجود ندارد».
- **D4. One cover per base.** A page's `cover` band matches the page colours and is the same on every side. Rule 26's
  per-side background pattern stays; a different gradient cover on each side looks random.

## E. How the work is done

- **E1. "Needs core code" is a claim to verify.** Before saying the platform cannot do something, look for the editor
  option (including builders like «صفحه ساز پروفایل») and try it on a scratch object. A brief's "needs Page.conditions,
  40–60 hours" was three existing features.
- **E2. No schema work while people enter data.** Agree a window, and check `index=behavior` for recent edits before a
  heavy step. Cascades interfere, and a stall during your work cannot be diagnosed afterwards (old record versions are
  purged).
- **E3. Keep the process alive until its cascade ends** (`platform-lessons.md` «Recompute cascades»). A script that
  exits early loses work and looks like a platform stall.
- **E4. Say the user-visible consequence, not the mechanism**, when you explain a number or a fix to a colleague, and
  mark what you measured apart from what you infer.
