# Flow 2: from a requirement document to a new base

Input: what the customer sent — an RFP or spec (Word, PDF), plain text, forms, spreadsheets, mockups, voice-note
transcripts, meeting notes. Output: an approved design package and a new base built from it.

```
R0 setup → R1 inputs to text → R2 requirement catalogue + critic → R3 open decisions
        → design package + review (design-package.md) → APPROVAL → build (build-new-base.md) → verify → hand over
```

## R0. Setup

The project folder from SKILL.md «Setting up a project», with no `source` and no `base` in `project.json`:

```bash
printf '{"owner":"<ownerUserId>","frontend":"http://localhost:9003"}\n' > $W/build/project.json
```

- **Owner**: the account that will own the new base — a team test account, never the customer's. Read its user id
  with a read-only Mongo query. Its plan must allow one more base (`cbase` otherwise fails with «محدودیت تعداد فضای کاری»).
- **Server**: confirm which Mongo, Redis and Splunk the tunnels reach (non-negotiable 1).

## R1. Inputs to text

- Copy everything into `$W/inputs/` and `md5sum` it: differently named duplicates are common, and a PDF is sometimes the
  transcript of the voice notes you were about to transcribe.
- `python3 build/extract-inputs.py docx <file> <outdir>` (text + the images embedded in the document),
  `python3 build/extract-inputs.py pdf <file> <outdir>`. Plain text is used as is. Spreadsheets become CSV.
- Look at every image and mockup with Read. Mockups carry column orders, labels and button texts that the prose leaves
  out; they become acceptance criteria.
- If the text is a meeting transcript, separate requirements from conversation first and keep each speaker's words as
  the `source` quote.

## R2. Requirement catalogue (read-only)

1. **One agent per document section or business domain**, in parallel. One requirement is one testable capability,
   with:
   - `id` (prefix per domain), `domain`, `title`, `description`, `actors`;
   - `acceptance`: a criterion another reviewer could check against a base without asking you;
   - `source`: document, page or section, and a short quote;
   - `priority` and `kind`: `config` (configuration can meet it), `build` (needs platform code), `external` (needs a
     third party or the customer's system), `decision` (the document leaves it open).
2. **Completeness critic.** One agent looks for gaps, overlaps and weak criteria, and for requirements the document
   implies but never states: approvals, notifications, reports, audit trail, who may see what, data import, numbering,
   the portal each actor uses. Implied items get `implied: true` so the customer can confirm them.
3. Merge in code (a `{dropped: kept}` map for duplicates). `workflows/1-understand.js` can run steps 1–2 with the
   documents as the only source.

Output: `data/catalogue.json`. Show the user the count per domain and per `kind`.

## R3. Open decisions

Everything the documents leave open — numbering formats, approval chains, deadlines, who may edit what and when, which
existing data is imported — goes into `data/decisions.md`, numbered, each with a recommended default and the
requirement ids it affects. The user may answer "use your defaults"; the completion report lists every default so the
customer can confirm it before go-live.

## Then

- Write and review the design package, and stop at the approval gate: `design-package.md`.
- After approval, build: `build-new-base.md`. There is no real data, so the mock data in the build is free to rebuild.
- Coverage is reported "after" only; there is no "before".
