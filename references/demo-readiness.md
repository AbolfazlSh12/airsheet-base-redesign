# Demo readiness: from "built and audited" to "I can show this to the customer"

A built base is not presentable until the person who demos it can explain every page in the customer's language, every
visible number is right, the look is consistent on every portal, and the demo accounts open every page without an empty
list. The SafarClub round 2 (2026-10-16) is the reference: the owner asked «I do not yet understand each page, portal,
table, automation, role or template», complained about one dashboard, wanted the base's missing *in-scope* needs closed,
a brand image, and an HTML to present to the customer.

## D1. Deliverables (Persian, plain language)

| File | For whom | Content |
|---|---|---|
| `راهنمای کامل` (user guide) | the person who demos | per portal: an intro, then **every page**: برای چه · چه می‌بینید (blocks in order, every list/form/button) · چطور نشان بدهید (3–5 clicks) · نیازهایی که پاسخ می‌دهد · حرف مشتری; then every template (sections, progress bar, tabs, who may edit what); then tables, automations grouped by the journey, roles, uniqueness rules |
| `ارائه به مشتری` (client presentation) | the customer | ۱ دردها → پاسخ‌ها · ۲ یک پرونده از ابتدا تا انتها با صفحه‌ی هر طرف · ۳ چهار پرتال، چهار مخاطب · ۴ «شما چه خواستید و کجا پیاده شد» (one row per implemented capability: the customer's sentence, what was built, how, where) · ۵ what stays manual or needs a decision · ۶ the three feedback questions |
| round report | the owner | brand, page-by-page design changes (before/after), closed needs with evidence, the reviewer/judge plans with a status per item, what needs the owner (logins, assets), skill changes |

Language rule for these three: no untranslated platform words. Say صفحه، فهرست، فرم، قالب نمایش رکورد، کار خودکار
(اتوماسیون)، نقش، جدول، فیلد، پیوند، شمارنده; keep object names exactly as in the base inside «». Numbers in Persian
digits. One idea per sentence.

How the text is produced: `scripts/workflows/5-explain-base.js` — one writer per portal plus one for the data model,
each reading the exact page/template JSON (`steps/read-all.ts` → `data/all-objects.json`), the dump with names, the
screenshots as the real user and the requirement documents; output is a fixed schema the report generator renders.
A writer who describes a page in one sentence has failed; the traveller dashboard explanation ran to ~600 words and that
was right.

## D2. Before the writers start

1. Fresh dump **and** `read-all.ts` after the last write (the explanation must describe today's base).
2. Screenshots of every page as its real user. Without the portal test accounts there are no traveller/host screenshots
   and no visual proof of template changes: get `.accounts.json` (or the owner's login in the desktop browser pane) on
   day one of the round; otherwise say in the report which pages were verified structurally only.
3. The gap list the last audit left (`closable_now` rows of the skeptic verdicts) and the customer's explicit sentences —
   the planner must mark each item **in scope only if the customer asked for it**; the owner wants feedback on what
   was asked, not on extras.

## D3. The round itself

- Run the three tracks in one workflow (explain · gap plan with a platform reviewer · design review per portal with a
  judge); implement the reviewed plan as numbered steps (DRY → real → DRY), smallest blast radius first (form defaults,
  view layouts, page blocks) and creations last; re-dump; regenerate the guides.
- Brand: if the customer's logo has not arrived, generate a placeholder mark + wordmark (`scripts/make-brand.py`:
  PIL with raqm for shaped Persian text) and place it: square mark as `header.logo` (white variant as `darkLogo`) on
  every side — sidebar and website headers print the side name themselves, so a wordmark there duplicates it; the
  wordmark only in the site footer brand widget (title «»); the mark as `base.logo`, which also appears on the login
  page. One step (`70-brand.ts`) so the real logo is a four-file swap and a re-run.
- Team dashboard pattern that reads well: photo hero in the site's look (`asset-pipeline.md` A5, 200 px), KPI tiles,
  quick-access MENU, then the two "needs action" queues side by side as `featured` cards (person first, then city,
  date, number) — never `news` rows without a cover (they render as grey label/value stacks).
- Visible numbers (city counters, KPI tiles) are compared with an independent count before the demo
  (`verification.md` §4); a «۰» on every card is a join bug.

## D4. Hand-over checklist for the demo

- Every page of every portal opens for the demo accounts with no empty list (`crawl-lists.cjs`, or the owner's eyes).
- The guide's "how to demo" steps were walked once end to end (request → inquiry → quote → payment → case → handover →
  return → settlement) on the demo data; the steps that only work with automations are marked «🤖 دستی تا راه‌اندازی».
- The presentation's table ۴ matches the final skeptic list (`final_implemented`) — regenerate it after the last write.
- The owner has: the three HTML files, the steps folder, the open-items list (what needs the customer), and knows which
  four files to replace when the real logo arrives.
