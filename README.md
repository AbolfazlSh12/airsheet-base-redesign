# airsheet-base-redesign

A Claude Code skill for building, auditing and redesigning [Airsheet](https://airsheet.ir) bases by configuration:
requirement catalogues, coverage reports, portal redesign, demo data, automation consolidation and, when a customer need
cannot be met by configuration, platform code changes.

`SKILL.md` is the entry point; `references/` holds the playbooks and `scripts/` the tooling (`lib.ts` is the only write
path to a base).

## Install

```bash
git clone git@github.com:AbolfazlSh12/airsheet-base-redesign.git ~/.claude/skills/airsheet-base-redesign
```

Paths in the docs use placeholders: `<workspace>` is the folder that holds the `cloud-back` / `cloud-front` checkouts,
`<s3-host>` the S3 host of your environment, `<ci-node-image>` the Node image your CI runs.
