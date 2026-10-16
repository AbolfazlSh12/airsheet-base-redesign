# Reading a requirement document as the customer's critic (flow 2, R2)

**Why this file exists.** On a real RFP project (an internal-warehouse system), the first build had a full catalogue,
a reviewed design and a verified base, yet a hostile re-read of the same RFP found 28 needs the base did not meet,
4 of them critical. The causes were not platform limits; they were reading habits:

- the catalogue was written from impressions of the document, so sentences, table columns and enum values fell through;
- empty sections («reports», «user pages») were treated as "nothing asked" instead of "decide and build";
- a feature asked "per person, department, general department, deputy and building" was built for one level;
- workflow steps were modelled as statuses only, without who approved, when, why it was rejected, or a receipt;
- the design promised pages, blocks and constraints that the build never created, and nobody diffed the two;
- nothing asked whether each feature works **on day one**: with automations off, the request flow broke at step one.

So the document is read three ways (pain, structure, sentence by sentence) before any catalogue exists, and every line
of it is traced to a decision. Output goes into `data/`, and the catalogue in `flow-from-requirements.md` R2 is built
from the ledger, not from memory.

## A1. Two full readings before cataloguing

1. **Pain pass.** Read the introduction, goals and any "current situation" text. Write `data/pains.md`: one row per
   pain in the customer's words → what success looks like → which sections of the document serve it → how the demo will
   prove it. Example: «پراکندگی و عدم رهگیری سوابق» → every action leaves who/when → audit fields, signatures, history
   → demo: open a delivered request and show who approved and when. Every design decision later points to a pain; a
   feature that serves no pain is a scope question, and a pain with no feature is a gap.
2. **Structure pass.** List the sections, tables (with their columns), forms, workflows (approve and reject paths),
   roles with their bullets, portal items, profile items, reports. This list is the skeleton of the ledger.

## A2. The sentence ledger (`data/ledger.json`)

Every sentence, bullet, table row and **table column** gets one line:
`{ref: "§4-1-2 جدول درخواست / Approver", quote, kind: requirement|context|duplicate, req_ids: [], emphasis: n}`.
No line stays without a decision. Coverage of the document = requirement lines with `req_ids` ÷ requirement lines;
show it to the user. Rules that caught real misses:

- **Repetition is priority.** A need stated in two or more sections («پیام عدم موجودی … در زمان ثبت و قبل از ثبت
  نهایی» appeared twice) gets `emphasis ≥ 2`. The customer tests these first.
- **A table column is a requirement.** Every column of every table in the document becomes a field, or a documented
  mapping (lookup, formula, button stamp, view column). «Approver / Approval Date» means a stamped signer and date,
  not just a status. «Consumption Period: month / season / year» means all three exist.
- **Every enum value must be reachable.** Status lists, period lists, request types, risk levels: each value has a path
  that produces it.
- **Formulas and thresholds are literal.** Implement given formulas as written (budget bands 70 / 90 / 100 %).
  Parameters the document names («جمعیت، سمت، مساحت») must all be inputs of the formula; an unused named parameter is a
  gap.
- **Inputs nobody defines.** A formula or rule that needs a value no table of the document holds (lead time, seasonal
  and trend factors in a forecast; an organisational level missing from the user table) still needs a field. List these
  explicitly; a builder drops them because no column asks for them.
- **Quote, don't paraphrase.** The `quote` is the evidence when the customer disputes a verdict.

## A3. Workflows, step by step

For each workflow write both the approval path and the rejection path as numbered steps, and map each step to: actor,
status value, the button that moves it, the field it writes, the stamp it leaves (signature + date), the reason it
captures, the notification it sends, and who sees the record next. Commonly missed:

- the **reason** on every rejection, required before the reject button appears;
- **who approved and when** (signature field stamped by the button's `signs` action, plus a date);
- a **receipt confirmation** by the recipient when the document says «تأیید تحویل»;
- a **gate before final submission** when the document says «قبل از ثبت نهایی» (hide the submit button, show why);
- the requester's view of progress (a `PROGRESS` block over the status field).

## A4. Roles and access

Each role bullet becomes: a menu item (with its role filter), table and field permissions, and the buttons it may
press. Check explicitly:

- **separation of duties**: whoever counts or requests does not approve their own difference or request;
- **one actor per button** and status changed only through buttons (status field editable by an oversight role only);
- **portal requester ≠ approver** at the permission level: separate record roles, not one role plus hidden UI;
- «users see only their own scope»: row filters on views **and** role filters on tabs that list everything.

## A5. Levels × features matrix

When the document lists organisational levels (person, department, general department, deputy, building, company),
draw a matrix of every feature that mentions levels (quota, budget, consumption report, cost report, classification,
dashboard) against every level. Each cell is built or carries a recorded decision. Building the first column only is
the most common partial.

## A6. Empty and thin sections are work

A heading with no body («گزارشات و مصورسازی»، «بخش‌های کاربر») is a decision with a concrete default that is **built**.
When a document asks for «جدول، نمودار، داشبورد» and lists cost dimensions, the expected minimum is: one report per
dimension and level, a trend over time, a share-by-category chart, a KPI dashboard page for the senior/management role
the document names, and control lists (overdue, expiring, over-limit, exceptions). Write the list in the decisions with
the audience of each item.

## A7. Day-one readiness

For every requirement ask: does it work on the first day with the automations as they will be at go-live? List the
features that depend on automations (auto-assigned links that pickers filter on, snapshot dates, budget links,
notifications) as **operational dependencies**. They are blockers until activation, and the completion report says so.
Customer-supplied values (recipient lists, thresholds, coefficients) go into a one-row settings table that formulas and
automations read through lookups, never into hard-coded constants or empty `to` fields.

- **Photos and the logo are day-one inputs** (`asset-pipeline.md` A0): one photo per product, category and city, the
  logo as a vector. Without them the demo shows generated icons, and the customer judges the whole base by that.

## A8. Implementability: check the platform before saying "code"

Before calling a need `build` (platform code), check this list. It was verified on develop in 2026-10. Re-check the
shapes on the server, read-only, before scripting them.

| Need | Configuration that meets it |
|---|---|
| Tables, charts and dashboards | `Pivot2` views (rows, columns, measures `sum/count/avg/min/max/median`), `Dashboard` views (bar, donut, pie, gauge, funnel, radar…), `STATS` blocks. Group by **text** fields only, see `platform-lessons.md` |
| Timeline or occupancy | `Calendar` and `Gantt` views |
| Status progress | `PROGRESS` block over a single-select |
| Who and when approved | `signature` field + button action `signs` (stamps user and time) |
| Value rules | field `limits`: `min`, `max`, `onlyPositive`, `pattern` (email, numeric…), `minLength`… |
| Uniqueness | table constraints (compare against other rows; field operands) |
| Per-role menus and tabs | menu item `userFilter` and TABS `userFilterTab` with `[role]` |
| Requester vs approver | separate record roles on plain-string formula fields |
| Reminders and expiry | `period` automations with a guard field |
| Messages | notification, SMS and email actions; a SAP action exists |

Things that needed code on that project: printing barcode/QR labels, camera scanning, a multi-row "cart" form (unless
the form-v2 API table is available), atomic reservation, "last login" in the profile.

Each requirement gets a verdict: `config`, `config-workaround` (say which), `code`, `external` or `decision`.

## A9. Contradictions and the divergence register

**Contradictions inside the document** come first. Typical cases: two role lists that disagree, a status with four
values in one place and two in another, «managers only» in one section but a form in every user's portal elsewhere,
four bands in a formula but three in its enum. Each one becomes a numbered decision with both quotes and a default.
Otherwise the builder resolves it silently and the customer reads that as a miss.

Every place where the design departs from the document's text, whether a scope cut, a default that contradicts a
sentence, or a level not built, is listed with the quoted sentence and the reason. It goes into the requirement report
and the design package as its own section, so the customer confirms it knowingly. Silent divergence is the critique you
will receive later.

## What the user sees after R2

The pain map, the ledger coverage (e.g. 412 lines, 296 requirements, 100 % traced), counts per verdict, the
levels × features matrix, the divergence register, and the top-emphasis items. Then the catalogue, decisions and
requirement report continue as in `flow-from-requirements.md`.
