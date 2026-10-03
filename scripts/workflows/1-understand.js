export const meta = {
  name: 'base-understand',
  description: 'Audit the customer description (atlas) against the live baseline base, build a requirement catalogue, profile other candidate bases',
  phases: [
    { title: 'Audit & Catalogue', detail: 'atlas audit x2, one catalogue agent per domain, one profile per extra candidate' },
    { title: 'Critic', detail: 'completeness critic over the merged catalogue' },
  ],
}

// ---------------- CONFIG: fill per customer (see references/playbook.md, steps 0-3) ----------------
const S = '<workspace>/documents/<CUSTOMER>/data' // persistent; NEVER under /tmp (RAM, wiped on reboot)
const APP = '<workspace>/cloud-back'
const CUSTOMER = '<customer name, industry, what the system is for>'
const BASELINE = { id: '<old base id>', name: '<old base name>', note: '<who built it, why it is being redesigned>' }
const EXTERNAL = '<external systems the base talks to, e.g. an ERP/BPM over REST, SMS provider>'
// Extra bases someone claims cover the same requirements; each gets a profile (leave [] if none).
const PROFILES = [/* { key: 'ALT', id: '<base id>', claim: '<what its author claims>' } */]
// Input files already extracted by extract-inputs.py / dump-base.cjs, one line each, with what they are.
const INPUTS = `
- ${S}/dump_${BASELINE.id}.json : LIVE structural dump of the OLD base (tables[].fields/views/constraints/records, sides[].menu/pages, pages[].blocks, expandTemplates, automations[].actions (secrets redacted), roles, userroles, recordroles, collaboratorSummary, stats).
- ${S}/atlas-data.json and ${S}/atlas.txt : the AI-generated description of the old base (snapshot <date>), if any.
- ${S}/atlas_diff.md : mechanical diff atlas vs live, with each difference dated from createdAt/updatedAt and index=behavior.
- <new-requirement documents: docx.txt + docx_media/*.png (view the mockups with Read), voice transcripts, pdf.txt>`
// Domains: take them from the atlas domain map or from the old base's tableOrder. prefix = requirement id prefix.
// Put new (not-yet-built) requirements in their own prefix inside the domain that owns them (newPrefix).
const DOMAINS = [
  { prefix: 'DOM1', name: '<Persian domain name>', scope: '<tables, portals, processes, automations in this domain>' },
  // { prefix: 'XCT', name: 'زیرساخت، یکپارچه‌سازی و دسترسی', scope: 'roles, all portals and who sees them, every integration automation (direction, trigger, payload), notifications, scheduled syncs, reports, login/OTP, data volumes', newPrefix: 'NEW', newScope: '<the new requirement, from the documents>' },
]
const AUDIT_FOCUS = [
  { key: 'atlas-model', focus: '<first half of the atlas sections: purpose, architecture, domain map, relation graph, tables and field patterns, views>' },
  { key: 'atlas-access-auto', focus: '<second half: roles, portals and pages, automations and integrations, structure health; also what it says about userroles/recordroles, OTP/signup>' },
]
// ------------------------------------------------------------------------------------------------------

const COMMON = `
CONTEXT: Airsheet is a no-code platform (bases -> tables -> fields -> views; "sides" are portals (visitor = public site, user = logged-in portal users, collaborator = staff with roles) with pages made of blocks; expand templates render a record; automations with actions; roles for collaborators; "userroles" authorise portal users (accreditView/accreditForm/userProperty); "recordroles" restrict which records/fields a portal user may edit).
Customer: ${CUSTOMER}. OLD base ${BASELINE.id} = "${BASELINE.name}". ${BASELINE.note}. External systems: ${EXTERNAL}.

FILES (large JSON — load with python3/jq and query; do not cat whole files):${INPUTS}

RULES: strictly read-only. Do not write to MongoDB, Splunk, or any repo file. Scratch files only under ${S}/tmp_agents/. Do not read record contents (names, phones, national ids) — structure and counts only. Never output secrets/API keys. For details missing from the dump you may run read-only find() queries: node -e with require('${APP}/node_modules/mongoose') against mongodb://127.0.0.1:27017/air (collections bases, tables, fields, views, sides, pages, expandtemplates, automations, actions, roles, userroles, recordroles).
Write all human-readable text in Persian; keep entity names exactly as they appear in the base.`

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Persian, 3-6 sentences: how accurate/complete this part of the atlas is' },
    claims_checked: { type: 'integer' },
    issues: { type: 'array', items: { type: 'object', properties: {
      section: { type: 'string' }, claim: { type: 'string' },
      status: { type: 'string', enum: ['incorrect', 'imprecise', 'outdated', 'unverifiable'] },
      evidence: { type: 'string' }, correction: { type: 'string' },
      severity: { type: 'string', enum: ['high', 'medium', 'low'] } },
      required: ['section', 'claim', 'status', 'evidence', 'correction', 'severity'] } },
    omissions: { type: 'array', items: { type: 'object', properties: {
      area: { type: 'string' }, what_is_missing: { type: 'string' }, evidence: { type: 'string' },
      importance: { type: 'string', enum: ['high', 'medium', 'low'] } },
      required: ['area', 'what_is_missing', 'evidence', 'importance'] } },
  },
  required: ['summary', 'claims_checked', 'issues', 'omissions'],
}

const REQ = { type: 'object', properties: {
  id: { type: 'string', description: 'stable id with the given prefix, e.g. DOM1-01' },
  domain: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
  actors: { type: 'array', items: { type: 'string' } },
  acceptance: { type: 'string', description: 'what concretely must exist in a base for this to count as covered (data + form + portal page for the right actor + access + automation/integration if relevant)' },
  evidence_old: { type: 'string', description: 'where the OLD base implements it: table/view/page/side/automation names; or document reference for new requirements' },
  source: { type: 'string', enum: ['old-base', 'atlas', 'voice', 'docx', 'old-base+atlas'] },
  priority: { type: 'string', enum: ['core', 'secondary', 'deprecated-test'] } },
  required: ['id', 'domain', 'title', 'description', 'actors', 'acceptance', 'evidence_old', 'source', 'priority'] }

const CATALOG_SCHEMA = { type: 'object', properties: {
  requirements: { type: 'array', items: REQ },
  notes: { type: 'string' } }, required: ['requirements', 'notes'] }

const PROFILE_SCHEMA = { type: 'object', properties: {
  purpose: { type: 'string' }, users_and_roles: { type: 'string' },
  processes: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'description', 'evidence'] } },
  portal_user_features: { type: 'string', description: 'everything an external portal user can do in this base, with evidence (portal pages, forms, userroles)' },
  overlap: { type: 'string', description: 'which domains of the baseline it touches at all, and how deeply' },
  unique_features: { type: 'string' }, maturity: { type: 'string', description: 'completeness, empty tables, inactive automations, test artifacts, data volumes' } },
  required: ['purpose', 'users_and_roles', 'processes', 'portal_user_features', 'overlap', 'unique_features', 'maturity'] }

phase('Audit & Catalogue')

const audits = AUDIT_FOCUS.map(a => () => agent(`${COMMON}

TASK: Verify the AI-generated atlas of the OLD base, focusing on: ${a.focus}
1. Check every factual claim in these atlas sections (numbers, names, relationships, descriptions of what a table/portal/automation does) against the live dump and atlas-data. Classify wrong ones as incorrect / imprecise / outdated (true at the snapshot but changed since — use atlas_diff.md) / unverifiable.
2. List material OMISSIONS: behaviours the base really implements that the atlas does not describe or describes too vaguely for someone to rebuild it (button actions, constraints, recordrole/userrole logic, formulas that drive status, which portal page shows which view to whom, integration payloads/endpoints, SMS triggers). Rate importance for a rebuild.
Be concrete and cite names. Don't pad: if a section is accurate, say so in the summary.`, { label: `audit:${a.key}`, phase: 'Audit & Catalogue', schema: AUDIT_SCHEMA }))

const catalogs = DOMAINS.map(d => () => agent(`${COMMON}

TASK: Build the requirement catalogue for domain "${d.name}" (id prefix ${d.prefix}${d.newPrefix ? ` and ${d.newPrefix}` : ''}).
Scope: ${d.scope}${d.newPrefix ? `\nNEW requirements (prefix ${d.newPrefix}): ${d.newScope}` : ''}
The OLD base itself is the source of truth for what the system does today; the atlas only helps you understand it. Derive requirements from actual behaviour: which actor does what, through which form/view, on which portal page, what automation or integration fires, what status flow exists. One requirement = one testable capability (not one per table). Aim for complete coverage of the domain — typically 15-35 requirements. Mark test/abandoned structures (tables/pages named تست, empty tables, duplicate pages) as priority "deprecated-test" rather than skipping them silently, but group them. The acceptance field must be precise enough that another reviewer could check a different base against it.`, { label: `catalogue:${d.prefix}`, phase: 'Audit & Catalogue', schema: CATALOG_SCHEMA }))

const profiles = PROFILES.map(p => () => agent(`${COMMON}
ADDITIONAL FILE: ${S}/dump_${p.id}.json — live dump of base ${p.id} ("${p.key}"). Its author claims: ${p.claim}

TASK: Profile this base on its own terms, without judging the claim yet: what business process it serves, who uses it (roles, collaborator counts by role), every process/workflow it implements (with table/view/page evidence), exactly what external portal users can do in it (sides of type user, pages, forms, userroles — note empty sides), which baseline domains it touches at all and how deeply, what it has that the baseline does not, and maturity (empty tables, inactive automations, test artifacts, record volumes per table).`, { label: `profile:${p.key}`, phase: 'Audit & Catalogue', schema: PROFILE_SCHEMA }))

const results = await parallel([...audits, ...catalogs, ...profiles])
const auditResults = results.slice(0, audits.length)
const catalogueParts = results.slice(audits.length, audits.length + DOMAINS.length)
const profileResults = Object.fromEntries(PROFILES.map((p, i) => [p.key, results[audits.length + DOMAINS.length + i]]))

const merged = catalogueParts.filter(Boolean).flatMap(p => p.requirements)
log(`catalogue: ${merged.length} requirements from ${catalogueParts.filter(Boolean).length}/${DOMAINS.length} domains`)

phase('Critic')
const CRITIC_SCHEMA = { type: 'object', properties: {
  missing_requirements: { type: 'array', items: REQ },
  duplicates_or_overlaps: { type: 'array', items: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, suggestion: { type: 'string' } }, required: ['ids', 'suggestion'] } },
  weak_acceptance: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, problem: { type: 'string' }, better_acceptance: { type: 'string' } }, required: ['id', 'problem', 'better_acceptance'] } },
  notes: { type: 'string' } }, required: ['missing_requirements', 'duplicates_or_overlaps', 'weak_acceptance', 'notes'] }

const critic = await agent(`${COMMON}

A requirement catalogue for rebuilding the OLD base was produced by ${DOMAINS.length} domain agents. Here it is (JSON):
${JSON.stringify(merged)}

TASK: Act as a completeness critic. Sweep the OLD base dump systematically — every table, every side and its pages, every automation, every userrole/recordrole, every button field — and the new-requirement documents. Report (1) capabilities that exist but are not captured by any requirement (ids with prefix GAP-), (2) duplicates/overlaps between ids, (3) requirements whose acceptance criteria are too weak to test. Don't re-list what is already covered.`, { label: 'critic:catalogue', phase: 'Critic', schema: CRITIC_SCHEMA })

// Merge in code, not with an agent: apply critic.duplicates as a {droppedId: keptId} map, replace weak acceptance texts,
// append critic.missing_requirements, move deprecated-test items to catalogue.deprecated[]. Save as ${S}/catalogue.json.
return { audits: auditResults, catalogueParts, critic, profiles: profileResults }
