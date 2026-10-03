export const meta = {
  name: 'base-coverage',
  description: 'Evaluate requirement coverage of candidate bases, adversarially verify each verdict, compare design quality',
  phases: [
    { title: 'Evaluate', detail: 'per-domain coverage verdicts with evidence' },
    { title: 'Verify', detail: 'skeptic re-checks every verdict' },
    { title: 'Design', detail: 'old vs new design-quality comparison' },
  ],
}

// ---------------- CONFIG: fill per customer ----------------
const S = '<workspace>/documents/<CUSTOMER>/data' // persistent, never /tmp
const APP = '<workspace>/cloud-back'
const CUSTOMER = '<customer, domain, external systems (e.g. REST calls to the customer ERP/BPM), SMS/email>'
const BASELINE = { id: '<old base id>', name: '<old base name>' }
// note = anything an evaluator must know: who built it, automations intentionally inactive, recent edits by others…
const CANDIDATES = [
  { key: 'NEW', id: '<new base id>', note: '<built by …; all automations intentionally inactive because …>' },
  // { key: 'ALT', id: '<id>', note: '<its author claims …>', fair: true },
]
// One evaluator per chunk; keep each chunk to ~25-35 requirements. dep:true also checks catalogue.deprecated[].
const CHUNKS = [
  { cand: 'NEW', prefixes: ['DOM1'], dep: false },
  { cand: 'NEW', prefixes: ['DOM2', 'XCT', 'NEW', 'GAP'], dep: true },
]
// AFTER_BUILD: re-evaluation after a build round. Adds blocked_by, treats build reports as claims to verify,
// and counts a correctly wired but intentionally inactive automation as configured (operational_ready=false).
const AFTER_BUILD = false
const EXTRA_FILES = `- <work>/BRIEF.md (default decisions: a requirement met per a documented default counts as met; say so)
- <work>/reports/*.md (what each build agent says it did — claims, verify them)`
// -------------------------------------------------------------

const cand = k => CANDIDATES.find(c => c.key === k)
const COMMON = `
CONTEXT: Airsheet is a no-code platform (bases -> tables -> fields -> views; "sides" are portals (type visitor = public site, user = logged-in portal users, collaborator = internal staff with roles) with pages made of blocks; expand templates render one record; automations with actions (int-api-request = REST call; sms; email); roles for collaborators; "userroles" authorise portal users (accreditView/accreditForm/userProperty); "recordroles" restrict which records/fields a portal user may edit).
Customer: ${CUSTOMER}. OLD base ${BASELINE.id} "${BASELINE.name}" is being redesigned.
Candidates:
${CANDIDATES.map(c => ` - ${c.key} base ${c.id}: ${c.note}`).join('\n')}

FILES (large JSON — load with python3 and query; do not cat):
- ${S}/dump_<baseId>.json for the OLD base and each candidate: tables[].fields/views/constraints/records, sides[].menu/pages, pages[].blocks (view/expand refs, text), expandTemplates, automations[].actions (secrets redacted), roles, userroles, recordroles, collaboratorSummary, stats.
- ${S}/catalogue.json : requirements[] (id, title, description, actors, acceptance, evidence_old, priority); deprecated[] = things that must NOT be migrated.
${AFTER_BUILD ? EXTRA_FILES : ''}
RULES: strictly read-only. No writes to MongoDB/Splunk/repos; scratch files only under ${S}/tmp_agents/. Do not read record contents (names, phones, national ids) — structure and counts only. Never output secrets. For details missing from the dump you may run read-only find() queries: node -e with require('${APP}/node_modules/mongoose') on mongodb://127.0.0.1:27017/air.
Write all human-readable text in Persian; keep entity names exactly as in the base.`

const BLOCKED = { type: 'string', enum: ['', 'activation', 'platform', 'customer', 'external'], description: '"" or what blocks it: activation (only needs switching on + test providers), platform (needs cloud-back/cloud-front code), customer (data/decision), external (third-party service)' }
const VERDICT = { type: 'object', properties: {
  id: { type: 'string' },
  verdict: { type: 'string', enum: ['covered', 'partial', 'missing', 'not-applicable'] },
  evidence: { type: 'string', description: 'exact names in the candidate base: table/field/view/side/page/expand template/automation/userrole/recordrole' },
  gaps: { type: 'string', description: 'what is missing or wrong vs the acceptance criteria; empty if fully covered' },
  operational_ready: { type: 'boolean', description: 'true only if it would work today without further configuration (automation active, page placed in the right side, access granted)' },
  better_than_old: { type: 'string', description: 'one short note if the candidate does this clearly better or worse than the old base; else empty' },
  blocked_by: BLOCKED,
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] } },
  required: ['id', 'verdict', 'evidence', 'gaps', 'operational_ready', 'better_than_old', 'blocked_by', 'confidence'] }

const EVAL_SCHEMA = { type: 'object', properties: {
  verdicts: { type: 'array', items: VERDICT },
  deprecated_check: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, carried_over: { type: 'boolean' }, note: { type: 'string' } }, required: ['id', 'carried_over', 'note'] } },
  domain_summary: { type: 'string' } },
  required: ['verdicts', 'deprecated_check', 'domain_summary'] }

const VERIFY_SCHEMA = { type: 'object', properties: {
  checks: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, original: { type: 'string' },
    final: { type: 'string', enum: ['covered', 'partial', 'missing', 'not-applicable'] },
    agree: { type: 'boolean' }, reason: { type: 'string' },
    operational_ready: { type: 'boolean' }, blocked_by: BLOCKED },
    required: ['id', 'original', 'final', 'agree', 'reason', 'operational_ready', 'blocked_by'] } },
  summary: { type: 'string' } }, required: ['checks', 'summary'] }

const label = c => `${c.cand}:${c.prefixes.join('+')}`

const evaluate = c => agent(`${COMMON}

TASK: Evaluate candidate base ${c.cand} (${cand(c.cand).id}, dump file ${S}/dump_${cand(c.cand).id}.json) against every requirement in ${S}/catalogue.json whose id starts with ${c.prefixes.map(p => `"${p}-"`).join(' or ')} (requirements[] only). Load the catalogue with python and iterate — do not skip any id in scope; return exactly one verdict per id.
For each requirement check the whole chain the acceptance criteria describe — a table existing is NOT enough: data model (tables/fields/links), the entry form (Form view), a page in the right side for the right actor, access (role permissions on table/fields, userrole/recordrole for portal users), status flow/formulas, automation/integration (exists? right target table? right watch field / form reference? active?), and reporting. Use the OLD base only to understand what the requirement means in practice.
verdict: covered = acceptance fully met by the configuration; partial = some real implementation but material gaps; missing = nothing meaningful; not-applicable = cannot apply to this kind of base (use sparingly, explain).
operational_ready: separate from verdict — would it work today?${AFTER_BUILD ? ' An automation correctly wired but inactive by project policy counts as configured: verdict can be covered, operational_ready=false, blocked_by="activation".' : ''}
${c.dep ? 'ALSO: for each item in catalogue.deprecated[], report whether the candidate carried it over (carried_over=true is bad).' : 'Return deprecated_check as an empty array.'}
${cand(c.cand).fair ? 'Be fair: look for equivalent capabilities even if named differently, but do not credit a table that no portal user or staff member can actually use.' : ''}
Cite exact names as evidence.`, { label: `eval:${label(c)}`, phase: 'Evaluate', schema: EVAL_SCHEMA })

const verify = (res, c) => {
  if (!res) return null
  return agent(`${COMMON}

A first reviewer evaluated candidate base ${c.cand} (${cand(c.cand).id}, dump ${S}/dump_${cand(c.cand).id}.json) against catalogue requirements ${c.prefixes.join(', ')} and produced these verdicts:
${JSON.stringify(res.verdicts)}

TASK: You are a skeptical second reviewer. For EVERY verdict above, independently re-check it against the candidate base and the requirement's acceptance criteria in ${S}/catalogue.json. First reviewers are usually too generous: try hard to REFUTE each "covered" (find the missing link in the chain: no page places the form, the side is for the wrong actor, the role lacks canadd, the automation targets the wrong table, watches no field, references a deleted form or is inactive, a link field points to the wrong table, a lookup references a deleted field, a portal filter uses an operator the query builder drops for that field type…) and each "partial" (is it really missing? or really covered?). Also challenge "missing" verdicts by searching for equivalents under other names. Return one check per id with the final verdict and a concise reason citing names.`, { label: `verify:${label(c)}`, phase: 'Verify', schema: VERIFY_SCHEMA })
}

const DESIGN_SCHEMA = { type: 'object', properties: {
  dimensions: { type: 'array', items: { type: 'object', properties: {
    dimension: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' },
    winner: { type: 'string', enum: ['old', 'new', 'tie', 'unclear'] }, evidence: { type: 'string' } },
    required: ['dimension', 'old', 'new', 'winner', 'evidence'] } },
  new_base_defects: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, where: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['what', 'where', 'severity'] } },
  summary: { type: 'string' } }, required: ['dimensions', 'new_base_defects', 'summary'] }

const primary = CANDIDATES[0]
const designPromise = agent(`${COMMON}

TASK: The redesign goal was "better modelling, better infrastructure, better design, simpler UI". Compare the OLD base and candidate ${primary.key} (${primary.id}) on design quality (not requirement coverage): data model normalisation and naming (one unified table vs duplicated tables, link integrity, orphan/broken fields, formulas), portal structure and navigation (number of sides/pages, clarity of menus per audience, clicks for core portal-user tasks), consistency of views/forms, access-control design (roles, userrole/recordrole, field permissions), integration design (one automation per concern, error visibility such as a sync-monitoring page), notification design, maintainability (test artefacts, dead objects), and data migration (records carried over). Also list concrete DEFECTS in ${primary.key} (broken references, lookups to wrong tables, pages in no side, unreachable forms, automations referencing missing fields…) — verify each by reading the dump or a read-only query.`, { label: 'design:old-vs-new', phase: 'Design', schema: DESIGN_SCHEMA })

const coverage = await pipeline(CHUNKS, c => evaluate(c), (res, c) => verify(res, c).then(v => ({ chunk: label(c), cand: c.cand, evaluation: res, verification: v })))
const design = await designPromise
// Final verdict per id = the skeptic's (fall back to the evaluator's when a verify agent failed). Merge in code into
// ${S}/final_verdicts.json as {CAND: {id: {verdict, evidence, gaps, verify_reason, operational_ready, blocked_by, ...}}}.
return { coverage, design }
