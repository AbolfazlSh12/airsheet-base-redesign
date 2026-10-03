// Read-only invariant for ONE portal side (type user): every view a published page or a side template renders, and every
// link-field picker of a form placed there, either carries a top-level user-scope condition (SCOPE_OP, default
// «has my mobile») or has no context operand ({Table.Field}) and is listed for human review (public lists, help content,
// login-gate views). Also: every template a side list opens (or a form opens after submit) must include the side,
// otherwise the portal user gets an empty box.
// Run from cloud-back:  npx tsx <work>/build/portal-invariant.ts <sideId>
import * as L from "./lib";
const SIDE = process.argv[2];
const OP = process.env.SCOPE_OP || "has my mobile";
if (!SIDE) throw new Error("usage: portal-invariant.ts <sideId>");
L.run(async () => {
  const tables = await L.listTables();
  const tn = (id: any) => tables.find((t: any) => String(t._id) === String(id))?.name;
  const views: Record<string, any> = {}; const fields: Record<string, any> = {}; const tpls: Record<string, any> = {};
  for (const t of tables) {
    for (const v of await L.listViews(t._id)) views[String(v._id)] = v;
    for (const f of await L.listFields(t._id)) fields[String(f._id)] = f;
    for (const e of await L.listExpands(t._id)) tpls[String(e._id)] = e;
  }
  const containers: [string, any][] = [
    ...(await L.listPages(SIDE)).filter((p: any) => p.status === "published").map((p: any) => [`page «${p.name}»`, p.content] as [string, any]),
    ...Object.values(tpls).filter((e: any) => (e.sides || []).map(String).includes(SIDE)).map((e: any) => [`tpl «${e.name}» ${e._id}`, e.layout] as [string, any]),
  ];
  const used = new Map<string, Set<string>>(); const opened = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, where: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(where); };
  const walk = (x: any, where: string) => {
    if (!x || typeof x !== "object") return;
    if ((x.type === "VIEW" || x.type === "ExpandRecord") && x.details?.value?.value) {
      add(used, String(x.details.value.value), where);
      const t = x.details.value.expandTemplate; if (t && /^[0-9a-f]{24}$/.test(t)) add(opened, t, where);
    }
    if (x.type === "STATS") for (const it of x.details.value || []) if (it.type === "dynamic" && it.filter?.[0]?.filter?.operator !== OP) console.log(`FAIL STATS «${it.label}» in ${where}: no leading ${OP}`);
    if (x.type === "STATS") for (const it of x.details.value || []) if (it.type === "dynamic" && (!it.field || it.field === "undefined")) console.log(`FAIL STATS «${it.label}» in ${where}: no field (count is always 0)`);
    Object.values(x).forEach((y) => walk(y, where));
  };
  for (const [where, doc] of containers) walk(doc, where);
  // pickers and after-submit templates of the forms placed on the portal side
  for (const id of [...used.keys()]) {
    const v = views[id]; if (v?.type !== "Form") continue;
    const l = (v.layout || [])[0] || {};
    if (l.expandAfterSubmit && l.expandAfterSubmitTemplate) add(opened, l.expandAfterSubmitTemplate, `form «${v.name}» after submit`);
    for (const i of l.inputs || []) { const f = fields[i.id]; if (f?.linkView) add(used, String(f.linkView), `picker ${tn(f.table)}.${f.name} in form «${v.name}»`); }
  }
  const mobileFirst = (v: any) => (v.filters || []).some((c: any) => c.filter?.operator === OP);
  const ctx = (v: any) => /\{[^}"]+\.[^}"]+\}/.test(JSON.stringify(v.filters || []));
  let fails = 0; const review: string[] = [];
  for (const [id, where] of used) {
    const v = views[id];
    if (!v) { console.log(`FAIL unknown view ${id} in ${[...where][0]}`); fails++; continue; }
    if (v.type === "Form" || mobileFirst(v)) continue;
    if (ctx(v)) { console.log(`FAIL «${v.name}» ${id} (${tn(v.table)}): context operand without ${OP}; in ${[...where].join(" · ")}`); fails++; }
    else review.push(`«${v.name}» ${id} (${tn(v.table)}) filters=${JSON.stringify((v.filters || []).map((c: any) => [fields[c.filter?.field]?.name, c.filter?.operator, c.filter?.operand]))}`);
  }
  for (const [id, where] of opened) {
    const e = tpls[id];
    if (!e || !(e.sides || []).map(String).includes(SIDE)) { console.log(`FAIL template ${id} «${e?.name}» opened from ${[...where].join(" · ")} lacks this side`); fails++; }
  }
  console.log(`\n${used.size} views, ${opened.size} templates checked; ${fails} failures. Views without ${OP} and without context operands (review):`);
  review.forEach((r) => console.log("  " + r));
});
