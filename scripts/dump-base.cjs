// Usage (read-only): node dump-base.cjs <baseId> <out.json> [counts.json]
//   counts.json = output of splunk-query.ts '… | stats count by table' (adds tables[].records and stats.liveRecords).
//   env: AIRSHEET_BACKEND (cloud-back checkout, default cwd), MONGO_URL (default mongodb://127.0.0.1:27017/air).
// Structure only, names instead of ids, secrets and URL query strings redacted. Record contents are never read.
const fs = require('fs');
const mongoose = require(`${process.env.AIRSHEET_BACKEND || process.cwd()}/node_modules/mongoose`);

const SECRET_RE = /((?:api[_-]?key|token|password|passwd|secret|authorization|bearer|pass)["'\\]*\s*[:=]\s*["'\\]*)([^"'&\\\s,}]+)/gi;
const redact = (s) => (typeof s === 'string' ? s.replace(SECRET_RE, '$1***') : s);
const parse = (s, d) => { if (typeof s !== 'string') return s ?? d; try { return JSON.parse(s); } catch { return d; } };
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const baseId = process.argv[2];
  const out = process.argv[3];
  const countsFile = process.argv[4];
  const c = await mongoose.createConnection(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/air').asPromise();
  const db = c.db;
  const id = new mongoose.Types.ObjectId(baseId);
  const q = { base: id };
  const all = async (n) => db.collection(n).find(q).toArray();

  const base = await db.collection('bases').findOne({ _id: id });
  const [tables, fields, views, sides, pages, expands, autos, actions, roles, userroles, recordroles, collabs] = await Promise.all(
    ['tables', 'fields', 'views', 'sides', 'pages', 'expandtemplates', 'automations', 'actions', 'roles', 'userroles', 'recordroles', 'collaborators'].map(all));

  const name = {};
  for (const x of [...tables, ...fields, ...views, ...sides, ...pages, ...expands, ...roles, ...autos]) name[String(x._id)] = x.name;
  const nm = (i) => (i == null ? i : name[String(i)] || String(i));
  const nms = (a) => (Array.isArray(a) ? a.map(nm) : a);
  const refs = (s) => (typeof s === 'string' ? s.replace(/\{record:([0-9a-f]{24})\}/g, (_, i) => `{${nm(i)}}`).replace(/\$([0-9a-f]{24})\$/g, (_, i) => `$${nm(i)}$`) : s);
  const fieldRefs = (s) => (typeof s === 'string' ? s.replace(/[0-9a-f]{24}/g, (i) => (name[i] ? `‹${name[i]}›` : i)) : s);

  const filt = (s) => {
    const f = parse(s, s);
    if (!f || (Array.isArray(f) && !f.length)) return undefined;
    return fieldRefs(JSON.stringify(f)).slice(0, 1500);
  };

  const fieldOut = (f) => {
    const o = { id: String(f._id), name: f.name, type: f.type };
    if (f.description) o.description = f.description;
    if (f.linkedTable) o.linkedTable = nm(f.linkedTable);
    if (f.type === 'records') o.linkMultiple = f.linkMultiple;
    if (f.lookupType) o.lookupType = f.lookupType;
    if (f.rollupField) o.rollupField = nm(f.rollupField);
    if (f.rollupAggregation) o.rollupAggregation = f.rollupAggregation;
    if (f.rollupFilter && f.rollupFilter !== '[]') o.rollupFilter = filt(f.rollupFilter);
    if (f.formula) o.formula = refs(f.formula).slice(0, 800);
    if (f.possibleValues?.length) o.options = f.possibleValues.slice(0, 40);
    if (f.canview?.length) o.canview = nms(f.canview);
    if (f.canedit?.length) o.canedit = nms(f.canedit);
    const acts = parse(f.actions, []);
    if (Array.isArray(acts) && acts.some((a) => a.type)) o.buttonActions = fieldRefs(JSON.stringify(acts)).slice(0, 600);
    if (f.symbol) o.buttonLabel = f.symbol;
    const lim = (f.limits || []).map((l) => parse(l, l)).filter((l) => l && l.key);
    if (lim.length) o.limits = fieldRefs(JSON.stringify(lim)).slice(0, 400);
    const def = parse(f.default, {});
    if (def && Object.keys(def).length) o.default = fieldRefs(JSON.stringify(def)).slice(0, 200);
    if (f.notify) o.notify = true;
    if (f.protectedfield) o.protected = true;
    if (f.linkForms?.length) o.linkForms = nms(f.linkForms);
    return o;
  };

  // who a menu item / tab is for: the operand of a «[role] has any of» filter
  const roleWho = (f) => { const x = (parse(f, f) || []).find((n) => n?.filter?.field === '[role]'); return x ? nms(x.filter.operand || []) : undefined; };
  // forms: every input (an audit needs required/hidden/conditional per field, not a truncated JSON string)
  const formOut = (layout) => { const L = parse(layout, []); if (!Array.isArray(L)) return undefined;
    return L.map((pg) => ({ button: pg.button?.text, inputs: (pg.inputs || []).map((i) => [nm(i.id) || i.name, i.required ? 'REQ' : '', i.invisible ? 'HIDDEN' : '', (i.conditions || []).length ? 'COND' : ''].filter(Boolean).join(' ')),
      defaults: Object.keys(pg.defaultValues || {}).map(nm) })); };
  // report views: what they group and measure (Pivot2 / Pivot / Dashboard / Calendar / Gantt / Kanban)
  const reportOut = (v) => { const L = parse(v.layout, []); if (!Array.isArray(L) || !L.length) return undefined;
    if (v.type === 'Pivot2') return L.map((x) => ({ title: x.reportTitle, rows: (x.rowFields || []).map((r) => nm(r.field)), cols: (x.colFields || []).map((r) => nm(r.field)), measures: (x.measures || []).map((m) => `${m.function}(${nm(m.field)})`) }));
    if (v.type === 'Dashboard') return L.map((x) => `${x.type} by ${nm(x.by)} ${x.stats === 'count' ? 'count' : `${x.aggregate}(${nm(x.field)})`} «${x.title || ''}»`);
    if (v.type === 'Pivot') return L.map((x) => ({ groups: (x.groups || []).map(nm), bys: (x.bys || []).map(nm), measure: x.field ? `${x.aggregate}(${nm(x.field)})` : undefined }));
    if (v.type === 'Calendar' || v.type === 'Gantt') return L.map((x) => ({ start: nm(x.startTimeField || x.timeField), end: nm(x.endTimeField), title: nm(x.titleField) }));
    if (v.type === 'Gallery') return L.map((x) => ({ look: x.type || 'cards', featuredSize: x.featuredSize, featuredImageHeight: x.featuredImageHeight, imageFit: x.imageFit, advancedHeader: !!x.advancedHeader, sorts: (x.customSortFields || []).length }));
    return undefined; };

  const blocks = (node, acc = []) => {
    if (!node) return acc;
    if (Array.isArray(node)) { node.forEach((n) => blocks(n, acc)); return acc; }
    if (typeof node !== 'object') return acc;
    if (node.type && typeof node.type === 'string' && node.id) {
      const b = { t: node.type };
      const d = node.details || {};
      const v = d.value;
      if (v && typeof v === 'object' && v.value) { b.view = nm(v.value); if (v.expandTemplate && v.expandTemplate !== 'default') b.expand = nm(v.expandTemplate); if (v.filterInField) b.filterInField = nm(v.filterInField); }
      else if (typeof v === 'string' && v.length > 20 && /^[0-9a-f]{24}$/.test(v) === false) b.text = stripHtml(v).slice(0, 220);
      else if (typeof v === 'string' && /^[0-9a-f]{24}$/.test(v)) b.ref = nm(v);
      if (Array.isArray(v) && v.length && typeof v[0] === 'string') b.refs = v.map(nm).slice(0, 12);
      if (node.filter?.length) b.filter = filt(node.filter);
      for (const k of ['buttonText', 'title', 'label']) if (typeof d[k] === 'string' && d[k]) b[k] = d[k].slice(0, 80);
      if (d.items && Array.isArray(d.items)) b.items = d.items.map((i) => (i.title || i.name || i.label || '')).filter(Boolean).slice(0, 20);
      if (node.type === 'TABS' && Array.isArray(d)) b.tabs = d.map((t) => (roleWho(t.userFilterTab) ? `${t.label} [${roleWho(t.userFilterTab).join('/')}]` : t.label));
      if (node.type === 'STATS' && Array.isArray(v)) b.items = v.map((i) => i.label).filter(Boolean);
      if (node.type === 'PROGRESS' && d.stateField) b.stateField = nm(d.stateField);
      acc.push(b);
    }
    for (const [k, v] of Object.entries(node)) if (k !== 'details' || (node.details && typeof node.details === 'object')) { if (typeof v === 'object') blocks(v, acc); }
    return acc;
  };

  const dump = {
    base: {
      id: baseId, name: base.name, owner: base.creator == null ? undefined : String(base.creator), owners: (base.owners || []).map(String), hostname: base.hostname, createdAt: base.createdAt, updatedAt: base.updatedAt,
      preferences: redact(base.preferences), menu: fieldRefs(base.menu), tableOrder: nms(base.tableOrder), sideOrder: nms(base.sideOrder),
    },
    roles: roles.map((r) => ({ id: String(r._id), name: r.name, isBlocked: r.isBlocked })),
    collaboratorSummary: collabs.reduce((a, x) => { const k = `${x.type}:${nms(x.roles || []).join('+') || '-'}${x.active === false ? ':inactive' : ''}`; a[k] = (a[k] || 0) + 1; return a; }, {}),
    userroles: userroles.map((u) => ({ name: u.name, description: u.description, accreditView: nm(u.accreditView), accreditField: nm(u.accreditField), usernameField: nm(u.usernameField), userProperty: u.userProperty, accreditForm: nm(u.accreditForm) })),
    recordroles: recordroles.map((r) => ({ name: r.name, table: nm(r.table), field: nm(r.field), userProperty: r.userProperty, filters: filt(r.filters), canedit: nms(r.canedit), canadd: r.canadd })),
    tables: tables.map((t) => ({
      id: String(t._id), name: t.name,
      canview: nms(t.canview), canadd: nms(t.canadd), candelete: nms(t.candelete),
      constraints: (t.constraints || []).map((x) => fieldRefs(x).slice(0, 600)),
      primaryField: nm(t.primaryField),
      fields: fields.filter((f) => String(f.table) === String(t._id)).map(fieldOut),
      views: views.filter((v) => String(v.table) === String(t._id)).map((v) => ({
        id: String(v._id), name: v.name, type: v.type,
        visibleFields: nms(parse(v.visibleFields, v.visibleFields) || []).slice?.(0, 60),
        filters: filt(v.filters), sorts: filt(v.sorts), groups: filt(v.groups),
        public: v.public || undefined, publicShare: v.publicShare || undefined, shared: v.shared || undefined,
        form: v.type === 'Form' ? formOut(v.layout) : undefined,
        report: reportOut(v),
      })),
    })),
    sides: sides.map((s) => ({
      id: String(s._id), name: s.name, type: s.type, layoutType: s.layoutType, default: s.default, roles: nms(s.roles),
      accreditView: nm(s.accreditView) || undefined, accreditForm: nm(s.accreditForm) || undefined,
      // `who` = roles of the item's userFilter: the panel menu may be role-filtered even when side.roles is empty
      menu: (parse(s.header, {})?.menuItems || []).map((m) => ({ title: m.title, to: nm(m.path) || m.link, who: roleWho(m.userFilter), children: (m.children || []).map((ch) => ({ title: ch.title, to: nm(ch.path) || ch.link, who: roleWho(ch.userFilter) })) })),
      pages: (s.pagesOrder || []).map(nm),
    })),
    pages: pages.map((p) => ({ id: String(p._id), side: nm(p.side), name: p.name, type: p.type, conditions: filt(p.conditions), blocks: blocks(parse(p.content, {})) })),
    expandTemplates: expands.map((e) => ({ id: String(e._id), name: e.name, table: nm(e.table), sides: nms(e.sides), blocks: blocks(parse(e.layout, {})) })),
    automations: autos.map((a) => ({
      id: String(a._id), name: a.name, category: a.category, active: a.active, type: a.type, cron: a.cron || undefined,
      table: nm(a.table), watchFields: nms(a.fields), forms: nms(a.forms), conditions: filt(a.conditions),
      actions: actions.filter((x) => String(x.automation) === String(a._id)).sort((x, y) => (x.order || 0) - (y.order || 0)).map((x) => {
        const o = parse(x.options, {}) || {};
        const s = redact(refs(fieldRefs(JSON.stringify(o))));
        // recipients: field templates by name; literal mobiles masked (personal data)
        const to = x.to ? refs(fieldRefs(String(x.to))).replace(/(09\d{2})\d{4}(\d{3})/g, '$1****$2') : undefined;
        return { type: x.type, description: x.description, to, conditions: filt(x.conditions), options: s.replace(/(https?:\/\/[^"?\\]+)\?[^"\\]*/g, '$1?<query-redacted>').slice(0, 2500) };
      }),
    })),
  };
  dump.stats = {
    tables: tables.length, fields: fields.length, views: views.length, sides: sides.length, pages: pages.length,
    expandTemplates: expands.length, automations: autos.length, activeAutomations: autos.filter((a) => a.active).length, actions: actions.length,
    roles: roles.length, userroles: userroles.length, recordroles: recordroles.length,
    fieldTypes: fields.reduce((a, f) => ((a[f.type] = (a[f.type] || 0) + 1), a), {}),
    viewTypes: views.reduce((a, v) => ((a[v.type] = (a[v.type] || 0) + 1), a), {}),
  };
  if (countsFile) {
    const n = Object.fromEntries(JSON.parse(fs.readFileSync(countsFile, 'utf8')).map((r) => [String(r.table), Number(r.count)]));
    dump.tables.forEach((t) => { t.records = n[t.id] || 0; });
    dump.stats.liveRecords = dump.tables.reduce((a, t) => a + t.records, 0);
  }
  const text = JSON.stringify(dump, null, 1)
    .replace(/(https?:\/\/[^"?\\\s]+)\?[^"\\\s]*/g, '$1?<query-redacted>')
    .replace(SECRET_RE, '$1***');
  fs.writeFileSync(out, text);
  console.log(baseId, JSON.stringify(dump.stats));
  await c.close();
})().catch((e) => { console.error('ERR', e.stack); process.exit(1); });
