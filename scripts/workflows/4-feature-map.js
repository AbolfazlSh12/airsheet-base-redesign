export const meta = {
  name: 'base-feature-map',
  description: 'Explain a built base: per domain, every implemented capability mapped to the requirement sentence it answers, every open requirement with today\'s evidence, and a re-check of gaps the last report claimed closed — evaluator + skeptic per domain',
  phases: [
    { title: 'Coverage', detail: 'one evaluator per domain group against the documents and a FRESH dump' },
    { title: 'Skeptic', detail: 'one skeptic per domain group refutes every verdict; its lists are final' },
  ],
}

// ---------------- CONFIG: fill per customer ----------------
const W = '<workspace>/<customer>-build'                 // persistent; the dump below must be taken AFTER the last write
const DUMP = `${W}/data/dump-<date>.json`                // node build/dump-base.cjs <baseId> <out>
const DOCS = [                                           // plain-text requirement documents (extract-inputs.py), with their id prefix
  { prefix: 'S', label: 'spec', path: `${W}/inputs/spec.txt` },
  { prefix: 'M', label: 'meeting', path: `${W}/inputs/meeting.txt` },
  { prefix: 'A', label: 'answers', path: `${W}/inputs/answers.txt` },
]
const PREVIOUS = `${W}/reports/gap-audit.md`             // the last audit (its appendix lists one row per requirement id), or ''
const CLOSURE_CLAIMS = `${W}/reports/completion.html`    // the report that claims post-audit closures, or ''
const BASE = { id: '<baseId>', name: '<base name>', sides: '<side names and ids>' }
const CUSTOMER = '<customer, industry, what the system is for>'
const GROUPS = [
  { key: 'DOM1', name: '<Persian domain name>', prefixes: ['DOM1'], scope: '<tables, portals, processes, automations of this domain>' },
]
// --------------------------------------------------------------

const COMMON = `
CONTEXT. Airsheet is a no-code platform: base -> tables -> fields -> views; sides are portals (visitor = public site, user = OTP portal, collaborator = staff) made of pages of blocks; expand templates render one record; automations with actions; roles / userroles / recordroles.
Customer: ${CUSTOMER}. Base «${BASE.name}» ${BASE.id}. Sides: ${BASE.sides}.
FILES: requirement documents ${DOCS.map(d => `${d.label} (prefix ${d.prefix}): "${d.path}"`).join('; ')}. Live structural dump of TODAY: ${DUMP} (360 KB JSON: query with python, never cat whole). Previous audit: ${PREVIOUS || '—'}. Closure claims: ${CLOSURE_CLAIMS || '—'}.
RULES: strictly read-only; no writes to Mongo/Splunk/S3/base; scratch under ${W}/tmp_agents/<label>/; never print secrets, mobiles or national ids; Persian for human text; entity names exactly as in the base; cite dump paths/names, report lines or screenshot files; «موردی وجود ندارد» instead of inventing.`

const ITEM = { type: 'object', properties: {
  feature: { type: 'string' }, objects: { type: 'string' }, requirement_ids: { type: 'array', items: { type: 'string' } },
  source: { type: 'string' }, how: { type: 'string' }, verified: { type: 'string', enum: ['dump', 'screenshot', 'report-only'] } },
  required: ['feature', 'objects', 'requirement_ids', 'source', 'how', 'verified'] }
const UNMET = { type: 'object', properties: {
  requirement_id: { type: 'string' }, title: { type: 'string' },
  verdict: { type: 'string', enum: ['partial', 'missing', 'broken', 'untested', 'decision', 'code', 'external'] },
  severity: { type: 'string', enum: ['critical', 'important', 'minor'] }, evidence: { type: 'string' }, fix: { type: 'string' }, closable_now: { type: 'boolean' } },
  required: ['requirement_id', 'title', 'verdict', 'severity', 'evidence', 'fix', 'closable_now'] }
const COVERAGE = { type: 'object', properties: {
  group: { type: 'string' }, summary: { type: 'string' },
  implemented: { type: 'array', items: ITEM }, unmet: { type: 'array', items: UNMET },
  post_audit_closures_checked: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, landed: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['claim', 'landed', 'evidence'] } } },
  required: ['group', 'summary', 'implemented', 'unmet', 'post_audit_closures_checked'] }
const SKEPTIC = { type: 'object', properties: {
  group: { type: 'string' }, changes: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, why: { type: 'string' } }, required: ['item', 'from', 'to', 'why'] } },
  final_implemented: { type: 'array', items: ITEM }, final_unmet: { type: 'array', items: UNMET }, final_summary: { type: 'string' } },
  required: ['group', 'changes', 'final_implemented', 'final_unmet', 'final_summary'] }

const evalPrompt = (g) => `${COMMON}
YOU ARE THE EVALUATOR for «${g.name}» (prefixes ${g.prefixes.join(', ')}). Scope: ${g.scope}.
1. Extract every requirement of this domain from the documents (use the previous audit's id list when it exists; add what it missed as <PREFIX>-N1, N2 …).
2. For every implemented capability: the exact objects in TODAY's dump, the requirement ids and the document sentence; verified = dump | screenshot | report-only.
3. For every requirement not fully met today: an unmet row with today's evidence; mark closable_now only for pure configuration without customer input.
4. For every closure the last report claims, say whether it really landed in today's dump (post_audit_closures_checked).
Be exhaustive: a thin list is a failure.`
const skepticPrompt = (g, ev) => `${COMMON}
YOU ARE THE SKEPTIC for «${g.name}». Refute every "implemented" item by checking the whole chain in the dump (data → form/view → page on the right side → access → automation → report); downgrade when you cannot verify. Refute every "unmet" by searching for an equivalent. Fix wrong ids and quotes. Re-check the closures yourself. Return the corrected full lists, the change list and a Persian summary.
EVALUATOR OUTPUT:
${JSON.stringify(ev).slice(0, 60000)}`

phase('Coverage')
const out = await pipeline(GROUPS,
  (g) => agent(evalPrompt(g), { label: `eval:${g.key}`, phase: 'Coverage', schema: COVERAGE }),
  (ev, g) => ev ? agent(skepticPrompt(g, ev), { label: `skeptic:${g.key}`, phase: 'Skeptic', schema: SKEPTIC }).then(s => ({ group: g, evaluator: ev, skeptic: s })) : null)
const done = out.filter(Boolean)
log(`feature map: ${done.length}/${GROUPS.length} groups; implemented ${done.reduce((n, d) => n + (d.skeptic?.final_implemented?.length ?? 0), 0)}, open ${done.reduce((n, d) => n + (d.skeptic?.final_unmet?.length ?? 0), 0)}`)
return done
// Write the result to ${W}/data/feature-map.json and render it with the report template (one table per group:
// capability · objects · requirement ids · sentence · how · verified; then the open rows ranked by severity).
