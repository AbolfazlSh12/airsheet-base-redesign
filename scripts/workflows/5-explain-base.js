export const meta = {
  name: 'base-explain',
  description: 'Write the plain-Persian explanation of a built base for the person who will demo it: one writer per portal (every page: purpose, what you see, how to demo, requirements, the customer sentence; every template) plus one writer for tables, automations and roles',
  phases: [{ title: 'Explain', detail: 'one writer per portal + one for the data model' }],
}

// ---------------- CONFIG: fill per customer ----------------
const W = '<workspace>/<customer>-build'
const ALL = `${W}/data/all-objects.json`          // steps/read-all.ts: sides, pages (full block JSON), expands, views, tables+fields
const DUMP = `${W}/data/dump-<date>.json`          // dump-base.cjs: names instead of ids, automations with actions, roles
const DOCS = `"${W}/inputs/spec.txt" (S), "${W}/inputs/meeting.txt" (M), "${W}/inputs/answers.txt" (A)`
const IMPLEMENTED = `${W}/data/feature-map/skeptic__*.json`   // 4-feature-map.js output (final_implemented), or ''
const SHOTS = `${W}/shots/<round>`                 // screenshots per page as the real user, file names ending with the page id
const CUSTOMER = '<customer, what the business does, who the three or four actors are>'
const SIDES = [
  // { key: 'site', scope: '<side name> (visitor side <id>): N pages and templates …; forms …', shots: `${SHOTS}/site/*.jpg` },
  // { key: 'portal', scope: '<user side …>', shots: `${SHOTS}/portal/*.jpg` },
  // { key: 'team', scope: '<collaborator side …>', shots: `${SHOTS}/team/*.jpg` },
]
const MODEL_SCOPE = 'all tables (purpose + the fields a demo audience must understand, status options and their meaning), all automations (when each fires, what it does, grouped by the business journey), roles, record roles (what each may edit), uniqueness rules, the settings table — pages = [], templates = []'
// --------------------------------------------------------------

const COMMON = `
CONTEXT. Airsheet is a no-code platform: base -> tables -> fields -> views; sides are portals (visitor = public site, user = OTP portal, collaborator = staff) made of pages of blocks; expand templates render one record; automations with actions; roles / userroles / recordroles.
Customer: ${CUSTOMER}.
FILES (query JSON with python; never cat a whole file): ${ALL} (today's exact JSON of everything), ${DUMP} (names instead of ids; automations, roles), requirement documents ${DOCS}, implemented-feature lists ${IMPLEMENTED || '—'}. Look at screenshots with the Read tool.
RULES: strictly read-only; scratch only under ${W}/tmp_agents/<label>/; never print secrets, mobiles, national ids. Write ALL human text in simple, natural Persian for a non-technical reader: no untranslated platform words (say «صفحه», «فهرست», «فرم», «قالب نمایش رکورد», «کار خودکار (اتوماسیون)», «نقش», «جدول», «فیلد», «پیوند», «شمارنده»); keep object names exactly as in the base inside «». Say «موردی وجود ندارد» rather than invent.`

const SCHEMA = { type: 'object', properties: {
  scope: { type: 'string' }, intro: { type: 'string' },
  pages: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' }, id: { type: 'string' }, purpose: { type: 'string' }, what_you_see: { type: 'string' }, how_to_demo: { type: 'string' },
    requirements: { type: 'array', items: { type: 'string' } }, customer_words: { type: 'string' } },
    required: ['name', 'id', 'purpose', 'what_you_see', 'how_to_demo', 'requirements', 'customer_words'] } },
  templates: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' }, id: { type: 'string' }, table: { type: 'string' }, purpose: { type: 'string' }, what_you_see: { type: 'string' }, who_edits_what: { type: 'string' } },
    required: ['name', 'id', 'table', 'purpose', 'what_you_see', 'who_edits_what'] } },
  other: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, kind: { type: 'string' }, explanation: { type: 'string' } }, required: ['name', 'kind', 'explanation'] } },
}, required: ['scope', 'intro', 'pages', 'templates', 'other'] }

const prompt = (scope, shots) => `${COMMON}

YOU WRITE THE EXPLANATION for: ${scope}. Screenshots: ${shots || '—'}.
For every page: read its exact block JSON, look at its screenshot, and explain in plain Persian what the person sees and does, in the order of the blocks, including every list's title, every form's purpose, every button; say which requirement ids it serves and quote the customer's sentence. For templates: what the record page shows (sections, progress bar, tabs, buttons) and who may edit what (record roles). Be complete and precise (object names exact, ids included); a page described in one sentence is a failure. Write for the person who must demo this to the customer tomorrow.`

phase('Explain')
const jobs = [...SIDES.map(s => () => agent(prompt(s.scope, s.shots), { label: `explain:${s.key}`, phase: 'Explain', schema: SCHEMA })),
  () => agent(prompt(MODEL_SCOPE, ''), { label: 'explain:model', phase: 'Explain', schema: SCHEMA })]
const out = (await parallel(jobs)).filter(Boolean)
log(`explain: ${out.length}/${jobs.length} writers done; pages ${out.reduce((n, o) => n + o.pages.length, 0)}, templates ${out.reduce((n, o) => n + o.templates.length, 0)}`)
return out
// Render with the report template: one section per portal (intro, pages with screenshot + the five paragraphs,
// templates table, other), then the model section grouped by kind (جدول / اتوماسیون / نقش / قید). See demo-readiness.md D1.
