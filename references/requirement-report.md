# The requirement report (every time a requirement arrives)

Whenever the user sends a requirement, produce this report **before** the design package. A requirement can be a
document, meeting notes or a transcript, a customer message, a change request, or a change of scope ("not connected to
their site — their whole business on Airsheet"). The same applies in flow 1 when new documents arrive. The user takes
this report to the customer and to the product team, so it has to be true and usable as it stands.

## Format

- Write it in Persian, RTL. Deliver it as an HTML page by default. In Claude Code, publish it as a private Artifact
  (follow `artifact-design`) and keep the source in `$W/reports/requirement-report-<yyyy-mm-dd>-<slug>.html`. Produce
  Word (.docx) instead when the user asks for Word.
- Every section is always present, in the order below, so readers learn where to look.
- When the scope changes, write a new report and mark what changed against the previous one. Do not edit the old
  report silently.

## Sections (fixed order)

0. **Verdict and scope.** One short paragraph: what is asked, whether it can be built on Airsheet, how much of it is
   configuration, the rough size, and what this report changes compared with the previous one.
1. **Questions for the customer (ابهام‌ها).** Include only questions that meet both conditions:
   - the answer changes what is built or how big it is;
   - the inputs do not answer them.

   For each question give: why it matters (what changes with each answer), the default used if nobody answers, and
   the source quote.
2. **Decisions for the user (تصمیم‌های نرم‌افزاری).** These are choices the Airsheet side makes and the customer does
   not: modelling, which workaround, scope cuts, whether to write platform code, the order of phases. For each give
   the options, the recommendation with its reason, and the consequence of each option. A question the user can
   settle alone belongs here, not under customer questions.
3. **Blockers.** Include only what prevents **starting** the build:
   - missing access or accounts;
   - a plan limit;
   - a customer input without which the data model cannot be drawn;
   - a platform bug that breaks a core flow and has no workaround.

   Anything that can start with a default is not a blocker. Something needed only for go-live is listed under 7 with
   "before go-live".
4. **Platform bugs that affect this base.** Include only bugs verified in this session: in the code (file:line, with
   the branch or commit read) or reproduced. For each give the concrete effect on this base and the workaround until
   it is fixed. This is not a general bug list: leave out bugs this base never touches.
5. **Targeted improvements (اصلاح‌های هدفمند).** These are small changes to features that already exist, from a few
   hours to about two days, that make this base easier or more attractive to use. For each give what changes, why it
   matters for this customer, the effort, and who else benefits.
6. **New features.** These are capabilities the platform lacks that this requirement needs or clearly benefits from.
   For each give the effort, whether the base can launch without it (and with which workaround), and which other
   customers asked for it.
7. **Other.** Real risks, external dependencies (gateways, SMS, KYC, legal), data migration, security, go-live
   prerequisites. Leave nothing here that only fills space.

Appendix: a requirement coverage table. For each requirement give its verdict (config / config with workaround /
platform code / external / out of scope) and how it is met. For a small input, a few rows in section 0 replace the
table.

## Truthfulness rules (the most important part)

- **Every claim about the platform needs evidence from this session:**
  - code read now (file:line, saying origin/develop or the running checkout and the commit);
  - a test run now;
  - the live base.

  A memory, an earlier report or `platform-lessons.md` is a lead, not evidence: re-check it first. Mark what was not
  tested as «تست‌نشده».
- **An empty section is a correct answer.** Write «موردی وجود ندارد» in one line. Never invent a question, blocker or
  bug to fill a section. A simple requirement gives a short report.
- **Size follows the problem.** A one-field change gets a few lines. A whole business gets per-section detail with
  examples. Do not pad a small report, and do not squeeze a large one into slogans.
- **Facts and taste are labelled apart.** A recommendation says it is one and gives its reason. "Looks nicer" is
  allowed only where the customer asked for looks.
- **Severity is not inflated.** A blocker must stop the start. A bug must be verified. An improvement must have a user
  who feels it.
- **Each item appears once,** in the section where the reader can act on it.
- **Wrong earlier claims are corrected in writing** in the new report, saying what was wrong.
