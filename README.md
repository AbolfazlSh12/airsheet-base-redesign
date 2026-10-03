# airsheet-base-redesign

A Claude Code skill that designs and builds [Airsheet](https://airsheet.ir) bases by configuration, in two flows that
both end in a new base after the user approves a design:

1. **From an existing base** — read an old or unsatisfying base, diagnose it, propose a complete new design (data model,
   automations, roles and portals, pages and modules) and, once approved, build it in a new base, optionally migrating
   its data. The old base is only read.
2. **From requirements** — take a Word, PDF, text or spreadsheet requirement, turn it into a requirement catalogue and a
   design, and, once approved, build it.

`SKILL.md` is the entry point. `references/` holds the flows (`flow-from-old-base.md`, `flow-from-requirements.md`),
the shared design package (`design-package.md`), the build (`build-new-base.md`), verification, and the platform
lessons; `scripts/` holds the tooling (`lib.ts` is the only write path to a base).

## Install

```bash
git clone git@github.com:AbolfazlSh12/airsheet-base-redesign.git ~/.claude/skills/airsheet-base-redesign
```

Paths in the docs use placeholders: `<workspace>` is the folder that holds the `cloud-back` / `cloud-front` checkouts,
`<s3-host>` the S3 host of your environment, `<ci-node-image>` the Node image your CI runs.
