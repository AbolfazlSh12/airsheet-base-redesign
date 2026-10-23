// Static lint of a base dump (output of dump-base.cjs) for constructs the platform silently mishandles.
// Usage: node lint-base.cjs <dump.json>      Read-only, no database access. Exit 1 when an «error» is found.
// Every rule here produced a wrong or empty result on a real project (platform-lessons.md has the evidence).
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
const add = (level, where, msg) => out.push({ level, where, msg });
const LINKISH = (f) => f && (f.type === 'records' || (f.type === 'lookup' && f.lookupType === 'records'));
const names = (s) => [...String(s || '').matchAll(/‹([^›]+)›/g)].map((m) => m[1]);

for (const t of d.tables) {
  const F = Object.fromEntries(t.fields.map((f) => [f.name, f]));
  // 1. reports grouped by a link-type field: stats.ts runs `stats … by <field id>`, link values are arrays → one «-» row
  for (const v of t.views) {
    const r = v.report;
    if (v.type === 'Pivot2' && Array.isArray(r)) for (const x of r) for (const g of [...(x.rows || []), ...(x.cols || [])])
      if (LINKISH(F[g])) add('error', `${t.name} / ${v.name}`, `Pivot2 groups by link field «${g}»: every row lands in «-». Group by a text formula \`@{${g}} . ""\`.`);
    if (v.type === 'Dashboard' && Array.isArray(r)) for (const c of r) {
      const by = (c.match(/ by (.+?) (count|Sum|Average|Max|Min|Distinct)/) || [])[1];
      if (LINKISH(F[by])) add('error', `${t.name} / ${v.name}`, `chart groups by link field «${by}»: empty. Use a text formula copy.`);
      if (c.startsWith('line ')) add('warn', `${t.name} / ${v.name}`, `line chart rendered nothing on develop 2026-10 (bar with the same data worked): «${c}»`);
    }
  }
  // 2. formulas that read a timeFormat formula run in the JS fallback, which cannot read link fields → never computed
  const tf = new Set(t.fields.filter((f) => f.type === 'formula' && /timeFormat/i.test(f.formula || '')).map((f) => f.name));
  for (const f of t.fields.filter((x) => x.type === 'formula')) {
    const refs = [...String(f.formula || '').matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
    if (refs.some((x) => tf.has(x)) && refs.some((x) => LINKISH(F[x])))
      add('error', `${t.name}.${f.name}`, 'reads a timeFormat formula and a link field: the JS fallback cannot read links, the value is never computed (only a log line). Compute the date part in SPL (substr/strptime).');
  }
  // 3. no uniqueness at all on a table with code-like fields
  const codeLike = t.fields.filter((f) => f.type === 'mobile' ||
    (['text', 'number'].includes(f.type) && (/^(کد|code)( .{1,15})?$/i.test(f.name) || /^(بارکد|barcode|کد ملی|شماره پرسنلی)$/i.test(f.name))));
  if (codeLike.length && !(t.constraints || []).length)
    add('warn', t.name, `no constraint, but code-like fields: ${codeLike.map((f) => f.name).join('، ')} — duplicates are accepted.`);
  // 4. Form inputs that a table permission will drop on update are fine on create; flag forms with no required input
  for (const v of t.views.filter((x) => x.type === 'Form' && Array.isArray(x.form)))
    for (const pg of v.form) if (!(pg.inputs || []).some((i) => / REQ/.test(i))) add('info', `${t.name} / ${v.name}`, 'form with no required input');
}

// 5. signature fields tested with is empty / is not empty (the evaluator only knows «is signed» / «is not signed»)
const sigs = new Set(d.tables.flatMap((t) => t.fields.filter((f) => f.type === 'signature').map((f) => f.name)));
const scanFilters = (where, blocks) => {
  for (const b of blocks || []) if (b.filter && /is (not )?empty/.test(b.filter))
    for (const n of names(b.filter)) if (sigs.has(n) && new RegExp(`‹${n}›","operator":"is (not )?empty`).test(b.filter))
      add('error', where, `condition «${n} is (not) empty» on a signature field never works: use «is signed» / «is not signed».`);
};
for (const p of d.pages) scanFilters(`page ${p.side} / ${p.name}`, p.blocks);
for (const e of d.expandTemplates) scanFilters(`template ${e.table} / ${e.name}`, e.blocks);

// 6. automations
for (const a of d.automations) {
  if (a.type === 'update' && !(a.watchFields || []).filter(Boolean).length) add('error', a.name, 'update automation watching no field never fires');
  for (const x of a.actions || []) {
    if (['notification', 'sms', 'email'].includes(x.type) && !String(x.to || '').trim()) add('error', `${a.name} / ${x.description}`, `${x.type} with no recipient: fails «no recipient» once active`);
    if (a.type === 'create' && ['notification', 'sms', 'email'].includes(x.type) && /\{[^}]+\}/.test(x.to || ''))
      add('warn', `${a.name} / ${x.description}`, 'create trigger reads recipient fields at create time, before lookups/formulas are computed: use a match trigger on «recipient is not empty».');
  }
  if (a.active) add('info', a.name, 'active');
}

// 7. panel menus: items without a role filter are shown to every role
for (const s of d.sides.filter((x) => x.type === 'collaborator')) for (const m of s.menu || [])
  if (!m.who && !(s.roles || []).length) add('info', `side ${s.name} / ${m.title}`, 'menu item visible to every staff role');

// 8. record roles: search.ts grants a role only when the record's value is a string or number containing the user's
//    mobile; a lookup / link / multi-select value is an array and never matches → the role silently never applies
const STRINGY = ['text', 'longText', 'mobile', 'email', 'number', 'formula', 'autonumber'];
for (const r of d.recordroles || []) {
  const t = d.tables.find((x) => x.name === r.table); const f = t && t.fields.find((x) => x.name === r.field);
  if (!f) add('warn', `record role ${r.name}`, `field «${r.field}» of «${r.table}» not found in the dump`);
  else if (!STRINGY.includes(f.type)) add('error', `record role ${r.name}`, `keyed on «${r.table}.${r.field}» (${f.type}): an array value never matches, the role never applies. Key it on a text formula \`mvindex(@{${r.field}}, 0) . ""\` (or a stage scope formula).`);
}

const order = { error: 0, warn: 1, info: 2 };
out.sort((a, b) => order[a.level] - order[b.level]);
for (const o of out) console.log(`${o.level.toUpperCase().padEnd(5)} ${o.where}: ${o.msg}`);
const n = out.filter((o) => o.level === 'error').length;
console.log(`\n${n} error(s), ${out.filter((o) => o.level === 'warn').length} warning(s), ${out.filter((o) => o.level === 'info').length} info`);
process.exit(n ? 1 : 0);
