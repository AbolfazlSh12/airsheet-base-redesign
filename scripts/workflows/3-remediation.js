export const meta = {
  name: 'base-remediation',
  description: 'Classify a candidate base gaps by fix type and synthesise a prioritised remediation plan',
  phases: [
    { title: 'Classify', detail: 'agents classify partial/missing verdicts by fix type' },
    { title: 'Plan', detail: 'deduplicated prioritised workstreams, customer decisions, go-live checklist' },
  ],
}

// ---------------- CONFIG ----------------
const S = '<workspace>/documents/<CUSTOMER>/data' // persistent, never /tmp
const CAND = { key: 'NEW', id: '<new base id>' }
const CUSTOMER = '<customer, domain>'
const EXTERNAL = '<external systems, e.g. the customer ERP/BPM>'
const HALVES = [['DOM1', 'DOM2'], ['DOM3', 'XCT', 'NEW', 'GAP']] // split the id prefixes into 2-3 classifier agents
// ----------------------------------------

const CTX = `Airsheet no-code platform. Customer: ${CUSTOMER}. Candidate base ${CAND.key} ${CAND.id} was evaluated against a requirement catalogue (${S}/catalogue.json). Final verdicts (after skeptic verification) are in ${S}/final_verdicts.json under key "${CAND.key}" (per id: verdict, evidence, gaps, verify_reason, operational_ready). The base dump is ${S}/dump_${CAND.id}.json; the design review is in ${S}/wf2.json under "design" (new_base_defects). Read-only: do not modify any database or repo; no record contents; no secrets. Write Persian text; keep entity names exact.`

const CLASS_SCHEMA = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: {
  id: { type: 'string' },
  fix_class: { type: 'string', enum: ['config', 'build', 'decision', 'external'], description: `config = wiring/settings fix inside existing structures (fix a form reference, add a watch field, place a view on a page, grant a permission, fix a filter) — hours; build = a missing sub-capability that needs new fields/tables/forms/pages/automations — days; decision = needs a customer/business decision first; external = depends on ${EXTERNAL} or on data from the customer` },
  effort: { type: 'string', enum: ['S', 'M', 'L'] },
  fixes: { type: 'array', items: { type: 'string' }, description: 'concrete steps, each naming the exact object to change' },
  blocking_launch: { type: 'boolean', description: 'true if the system cannot go live for real users without this' } },
  required: ['id', 'fix_class', 'effort', 'fixes', 'blocking_launch'] } } }, required: ['items'] }

const PLAN_SCHEMA = { type: 'object', properties: {
  workstreams: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, why: { type: 'string' }, requirement_ids: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } }, fix_class: { type: 'string' }, effort: { type: 'string' },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2'] } },
    required: ['title', 'why', 'requirement_ids', 'steps', 'fix_class', 'effort', 'priority'] } },
  decisions_for_customer: { type: 'array', items: { type: 'string' } },
  go_live_checklist: { type: 'array', items: { type: 'string' } },
  summary: { type: 'string' } }, required: ['workstreams', 'decisions_for_customer', 'go_live_checklist', 'summary'] }

phase('Classify')
const classified = await parallel(HALVES.map(h => () => agent(`${CTX}

TASK: For every requirement in final_verdicts.json["${CAND.key}"] whose id starts with ${h.map(p => `"${p}-"`).join(' or ')} and whose verdict is "partial" or "missing", classify what it takes to close the gap (fix_class, effort, concrete fix steps naming exact objects, blocking_launch). Verify the gap against the dump where the stated gap looks doubtful. Also include items whose verdict is "covered" but operational_ready=false, with the fix to make them operational. One item per id.`, { label: `classify:${h.join('+')}`, phase: 'Classify', schema: CLASS_SCHEMA })))
const items = classified.filter(Boolean).flatMap(c => c.items)
log(`classified ${items.length} items`)

phase('Plan')
const plan = await agent(`${CTX}
Classified gaps (JSON): ${JSON.stringify(items)}

TASK: Merge these into a deduplicated remediation plan for ${CAND.key}: group into workstreams (e.g. "wire all notification automations to the current forms and watch fields", "portal onboarding flow: registration -> review -> activation", "integration activation & testing", "reference data seeding", "security: field permissions for portal users", one per new requirement), each with requirement ids, concrete ordered steps, effort and priority (P0 = blocks go-live). Add the new_base_defects from the design review where not already covered. List the decisions only the customer can make (each with a recommended default), and a go-live checklist.`, { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA })
return { items, plan }
