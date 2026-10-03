# BRIEF.md template (the contract every build agent works under)

Copy to `<work>/BRIEF.md`, fill the «…», and tell every agent to read it fully before doing anything. Append to
**Decisions** and **Lessons** as the build goes; never rewrite history in it.

```markdown
# Build brief — «customer» base `«baseId»`

Read this whole file before doing anything. It is the contract every build agent works under.

## What we are doing
«One paragraph: the base, the customer, the evaluation result (N requirements: x covered, y partial, z missing), and the
scope of this round, e.g. "close the gaps by changing the base's configuration only — no cloud-back/cloud-front code".
Then what the next phase is (e.g. page redesign).»

## Environment — read carefully
- MongoDB, Redis and Splunk on localhost are «SSH tunnels to the team's shared TEST server». Other people use it. Every
  write is real and visible to them. It is not production.
- Dev servers: backend :3000, frontend :9003. Do not restart them, do not change any file in either repo, do not commit.
- Work directory: `«<work>»` (persistent — never /tmp).
  - `build/lib.ts` + `LIB.md` — the ONLY way to write to the base.
  - `build/DESIGN-GUIDE.md` — page-builder capabilities and known rendering bugs.
  - `design/SYSTEM.md` — the design system (after the design lead writes it).
  - `build/shot.cjs` — screenshots: `node build/shot.cjs <role> <outDir> <sideId>/<pageId> ...` (roles: «…»).
  - `data/` — dumps (names instead of ids, secrets redacted — never write values copied from them), catalogue,
    coverage verdicts, remediation plan.

## Hard rules
1. Write ONLY through `build/lib.ts`, inside `L.run(...)`, from scripts under `build/steps/<your-agent-name>/`. Run from
   the cloud-back checkout with `npx tsx <script>`. Run every script with `DRY=1` first, read the diff, then for real.
2. Never set `ALLOW_LIVE=1`. All automations stay inactive (no real SMS/email/API calls). Fix their wiring so they would
   work when activated; do not activate.
3. Do not create, update or delete records except where your ownership says so. Never delete migrated data. Never change
   a field's type. Never delete a field that holds data — hide it instead.
4. Stay inside your ownership. If a fix needs something another agent owns, append a request to
   `requests/<target-agent>.md` (what, where, why, requirement id). Do not do it yourself.
5. «Functional phase only:» do not edit pages, sides or expand templates. Anything the UI must show goes into
   `ui-needs/<your-agent-name>.md`: page/side, view or field, filter, actor, why (requirement id).
6. Test accounts: «role → mobile → what it is». Do not change their passwords or status fields except to test and then
   restore. Passwords live only in `build/.accounts.json` (mode 600).
7. Don't print or copy secrets or personal data values.
8. At the end write `reports/<your-agent-name>.md`: for every requirement id you touched, what you changed (object
   names), how you verified it, what remains and why. Be honest about anything you couldn't finish.

## Ownership (who may change what)
| Agent | Owns |
|---|---|
| `access` | Table permissions on ALL tables; canview/canedit of ALL existing fields; userroles and recordroles; table constraints. |
| `«domain-1»` | Everything except permissions on the fields and views of: «tables». New fields it creates: it sets their permissions. |
| `«domain-2»` | … |
| `automation` | All automations and actions (wiring, watch fields, form references, cron→period, recipients, payload/response mappings). Keep every automation inactive. |
| `refdata` | Records only: seed empty reference tables that forms depend on (from the old base, organisational/catalogue data only, no personal data). |
Status-field `colors` belong to the domain agent of that table.

## Default decisions (the customer's open questions — use these; each is recorded for later review)
1. «Question» → «default chosen» («why; requirement ids»).
…
«Every default must be confirmed by the customer before go-live; the completion report lists them.»

## Lessons added during the build (read these)
- «dated, one line each: what went wrong, how it was caught, what to do instead»
```

## Why each rule exists (first project)

- DRY first + `changes.log` with the full previous value: every change was reviewable and revertable.
- Ownership table + `requests/` + `ui-needs/`: six functional agents ran in parallel with zero write conflicts; the
  orchestrator relayed requests to running agents.
- "Pages later": the design phase then saw every UI need at once and built consistent portals instead of six styles.
- Default decisions: 24 open customer questions would otherwise have blocked the build for weeks; each default was
  recorded, numbered, and later confirmed or changed by the customer (decisions 25-28 were added during the build).
