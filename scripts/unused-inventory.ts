/* Read-only: which tables / fields / views / templates / pages / record roles of the base nothing uses — the list to
   review before deleting what a superseded design left behind. Run from cloud-back:
     npx tsx <work>/build/unused-inventory.ts                     inventory (DEAD = unused, OWNER = only owner side uses it)
     WHY="<table>|<field>" npx tsx <work>/build/unused-inventory.ts   who mentions one field
     DELETED_SINCE=<ISO ts> npx tsx <work>/build/unused-inventory.ts  after a cleanup: anything still pointing at ids
                                                                   changes.log records as deleted since then
   env JOB_FILES=a.js,b.js : field names an external job reads/writes over REST (quoted strings) count as used.
   Roots: every page, every side, every template assigned to a side (lists open it as their "default" template, with
   no id reference), record roles that grant something, user roles, table constraints, the base document.
   Not counted as use: the column list / footer stats of default «همه» grids and the table's default record layout —
   the platform lists every field there. A field used only by other unused fields is unused. */
import * as L from "./lib";
import fs from "fs";

const HEX = /[0-9a-f]{24}/g;
L.run(async () => {
  const q = { base: L.BASE };
  const [tables, fields, views, tpls, sides, pages, rroles, uroles] = await Promise.all([
    L.M.Table.find(q).lean(), L.M.Field.find(q).lean(), L.M.View.find(q).lean(), L.M.ExpandTemplate.find(q).lean(),
    L.M.Side.find(q).lean(), L.M.Page.find(q).lean(), L.M.RecordRole.find(q).lean(), L.M.UserRole.find(q).lean()]);
  const base = await L.M.Base.findById(L.BASE).select("-tokens -scripts").lean();
  const obj = new Map<string, any>(), kind = new Map<string, string>();
  for (const [k, list] of [["table", tables], ["field", fields], ["view", views], ["template", tpls], ["side", sides],
    ["page", pages], ["recordrole", rroles], ["userrole", uroles]] as const)
    for (const d of list as any[]) { obj.set(String(d._id), d); kind.set(String(d._id), k); }
  const name = (id: any) => obj.get(String(id))?.name;
  const label = (d: any) => (d.table ?? d.side) === undefined ? d.name
    : `${name(d.table ?? d.side) ?? "(deleted table)"} › ${d.name || "(no name)"}`;
  const usedPart = (id: string, d: any) => {
    const k = kind.get(id);
    if (k === "table") { const { layout, _id, base: _b, ...rest } = d; return rest; }
    if (k === "view" && d.name === "همه") { const { fields: _f, statsFields: _s, ...rest } = d; return rest; }
    const { _id, base: _b, ...rest } = d; return rest;
  };
  const mentions = (id: string, d: any) => [...new Set(JSON.stringify(usedPart(id, d)).match(HEX) || [])].filter((x) => obj.has(x));

  if (process.env.DELETED_SINCE) {
    const gone = new Set<string>();
    for (const l of fs.readFileSync(L.LOG, "utf8").split("\n")) {
      if (!l.includes('.delete"')) continue;
      const e = JSON.parse(l); if (e.ts >= process.env.DELETED_SINCE) gone.add(String(e.id));
    }
    let n = 0;
    for (const [id, d] of [...obj.entries(), ["base", base] as [string, any]])
      for (const g of gone) if (JSON.stringify(d).includes(g)) { n++; console.log(`${kind.get(id) ?? "base"} ${d?.name ? label(d) : ""} → ${g}`); }
    console.log(`deleted since ${process.env.DELETED_SINCE}: ${gone.size}; references left: ${n}`);
    return;
  }
  if (process.env.WHY) {
    const [t, f] = process.env.WHY.split("|"); const tt = tables.find((x: any) => x.name === t);
    const fd = fields.find((x: any) => String(x.table) === String(tt?._id) && x.name === f);
    if (!fd) throw new Error(`no field ${t} › ${f}`);
    for (const [id, d] of obj) if (id !== String(fd._id) && JSON.stringify(d).includes(String(fd._id)))
      console.log(`${kind.get(id)} ${label(d)}${mentions(id, d).includes(String(fd._id)) ? "" : "   (listing only, not a use)"}`);
    return;
  }

  const jobNames = new Set((process.env.JOB_FILES || "").split(",").filter(Boolean)
    .flatMap((p) => [...fs.readFileSync(p, "utf8").matchAll(/"([^"\n]{2,60})"/g)].map((m) => m[1])));
  const roots = [
    ...pages, ...sides, ...uroles, ...tpls.filter((t: any) => (t.sides || []).length),
    ...rroles.filter((r: any) => (r.canedit || []).length || (r.canadd || []).length),
    ...fields.filter((f: any) => jobNames.has(f.name)),
  ].map((d: any) => String(d._id))
    .concat(tables.flatMap((t: any) => [...new Set(JSON.stringify(t.constraints ?? []).match(HEX) || [])]))
    .concat([...new Set(JSON.stringify(base).match(HEX) || [])]);
  const closure = (start: string[]) => {
    const seen = new Set<string>(), st = [...start];
    while (st.length) {
      const id = st.pop()!; if (seen.has(id) || !obj.has(id)) continue; seen.add(id);
      const d = obj.get(id); st.push(...mentions(id, d));
      if (kind.get(id) === "field" || kind.get(id) === "view") st.push(String(d.table));
    }
    return seen;
  };
  const ownerSides = new Set(sides.filter((s: any) => s.type === "collaborator").map((s: any) => String(s._id)));
  const all = closure(roots);
  const portal = closure(roots.filter((id) => !(kind.get(id) === "page" && ownerSides.has(String(obj.get(id).side)))
    && !(kind.get(id) === "side" && ownerSides.has(id))));
  for (const [k, list] of [["tables", tables], ["fields", fields], ["views", views], ["templates", tpls], ["pages", pages]] as const) {
    const dead = (list as any[]).filter((d) => !all.has(String(d._id)) && !(k === "views" && d.name === "همه"));
    const owner = (list as any[]).filter((d) => all.has(String(d._id)) && !portal.has(String(d._id)));
    console.log(`\n## ${k}: ${list.length}, unused ${dead.length}, owner side only ${owner.length}`);
    for (const d of dead) console.log(`DEAD   ${label(d)}${d.type ? ` (${d.type})` : ""}`);
    for (const d of owner) console.log(`OWNER  ${label(d)}`);
  }
  console.log("\n## record roles that grant nothing");
  for (const r of rroles as any[]) if (!(r.canedit || []).length && !(r.canadd || []).length) console.log(`EMPTY  ${label(r)}`);
});
