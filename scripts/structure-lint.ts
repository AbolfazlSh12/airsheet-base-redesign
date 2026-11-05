// Read-only lint of the structure rules (references/structure-rules.md); run with DRY=1 so nothing waits at exit.
// Exit 1 on an «error». A «warn» is a question to answer, or a reason to write down in the design package.
// JOB_TABLES="<name>,<name>": tables an external job fills, so nobody needs to create their rows by hand.
//   groupField   grouped view whose group field is not a column                        C1
//   group1000    grouped Grid/Gallery on a table over 1000 rows                        C2
//   gridLook     placed Grid without preset widths or wrapped headers                  C3
//   flatDump     placed Grid over 200 rows with no group, filter or filter bar         B3
//   machineCol   placed Grid showing a scope / mobile formula / text copy              C4 (counts: judge by eye)
//   singleton    one-row table another table links to                                  A1
//   oneRowList   list placed for a one-row table                                       A5
//   kpiLabel     STATS label that means nothing alone                                  B5
//   tabsMirror   TABS right under STATS with different labels or order                 B5
//   noCreate     table shown in lists, with no way to create its rows anywhere         D3, A4
//   cover        more than one page cover across the sides                             D4
//   home         default side is a public site: confirm anonymous visitors exist       D1
import * as L from "./lib";

const VAGUE = /^(کل|همه|تعداد|مجموع|میانگین|فعال|باز|بسته|جدید|در حال انجام|انجام شده|انجام‌شده)$/;
const MACHINE = /اسکوپ|\(متن\)|کد واردات|import/i;
const JOBS = new Set((process.env.JOB_TABLES || "").split(",").map((s) => s.trim()).filter(Boolean));

L.run(async () => {
  const out: [string, string, string][] = [];
  const add = (level: string, rule: string, msg: string) => out.push([level, rule, msg]);
  const tables = await L.listTables();
  const V: Record<string, any> = {}, F: Record<string, any> = {}, rows: Record<string, number> = {};
  const create = new Set<string>(); const shown = new Set<string>();
  for (const t of tables) {
    const id = String(t._id);
    rows[id] = await L.countRecords(id);
    for (const f of await L.listFields(id)) F[String(f._id)] = { ...f, tid: id };
    for (const v of await L.listViews(id)) V[String(v._id)] = { ...v, tid: id, tname: t.name };
  }
  // a view is linted once, wherever it is first placed
  const seen = new Set<string>();
  const place = (d: any, where: string) => {
    const v = V[d.value?.value]; if (!v) return;
    if (v.type === "Form") { create.add(v.tid); return; }
    if (!["Grid", "Gallery", "Kanban", "Calendar"].includes(v.type)) return;
    const name = `${where}: «${v.name}» of «${v.tname}»`;
    shown.add(v.tid);
    if (d.value.newForm && d.value.newFormPage?.details?.value) create.add(v.tid);
    if (d.value.autoLinkField) create.add(v.tid);
    if (rows[v.tid] === 1) add("warn", "oneRowList", `${name} lists a one-row table`);
    if (seen.has(String(v._id))) return; seen.add(String(v._id));
    const groups = (v.groups || []).map((g: any) => (typeof g === "string" ? JSON.parse(g) : g));
    const filtered = (v.filters || []).length > 0 || !!d.value.filterType;
    if (v.fields) for (const g of groups) if (!v.fields.includes(g.field)) add("error", "groupField", `${name} groups on «${F[g.field]?.name ?? g.field}», which is not a column`);
    if (groups.length && rows[v.tid] > 1000) add(filtered ? "warn" : "error", "group1000", `${name} is grouped, table has ${rows[v.tid]} rows${filtered ? " (filtered: check the largest user)" : ""}`);
    if (v.type !== "Grid") return;
    const widths = Object.keys(v.layout?.[0] || {}).some((k) => F[k]);
    if (!widths || !v.theme?.wrapHeaders) add("warn", "gridLook", `${name}: ${widths ? "" : "no widths "}${v.theme?.wrapHeaders ? "" : "headers not wrapped"}`);
    if (rows[v.tid] > 200 && !groups.length && !filtered && !v.summaryFields && !v.freeSearch) add("warn", "flatDump", `${name}: ${rows[v.tid]} rows, no group, filter or filter bar`);
    const bad = (v.fields || []).map((id: string) => F[id]).filter((f: any) => f && (MACHINE.test(f.name) || (f.type === "formula" && /موبایل/.test(f.name))));
    if (bad.length) add("warn", "machineCol", `${name} shows ${bad.map((f: any) => `«${f.name}»`).join("، ")}`);
  };
  const statLabels = (b: any) => (b.details?.value || []).map((i: any) => String(i.label ?? "").trim());
  const walk = (bs: any[], where: string) => {
    (bs || []).forEach((b, i) => {
      if (b.type === "VIEW") place(b.details ?? {}, where);
      if (b.type === "ExpandRecord") return;
      if (b.type === "STATS") {
        for (const l of statLabels(b)) if (VAGUE.test(l)) add("warn", "kpiLabel", `${where}: «${l}» means nothing alone`);
        const next = (bs.slice(i + 1).find((x) => x.type !== "TEXT" && x.type !== "TitleDivider"));
        if (next?.type === "TABS" && Array.isArray(next.details)) {
          const a = statLabels(b).join(" | "), c = next.details.map((t: any) => String(t.label ?? "").trim()).join(" | ");
          if (a !== c) add("warn", "tabsMirror", `${where}: cards [${a}] / tabs [${c}]`);
        }
      }
      for (const k of ["column1", "column2", "column3", "column4", "section"]) if (b[k]?.content) walk(b[k].content.blocks, where);
      if (b.type === "TABS" && Array.isArray(b.details)) for (const t of b.details) walk(t.content?.blocks, `${where}>${t.label}`);
    });
  };
  const sides = await L.listSides(); const covers = new Set<string>();
  for (const s of sides) {
    if (s.default && s.type === "visitor") add("warn", "home", `default side «${s.name}» is a public site: confirm anonymous visitors exist, otherwise a user side behind login`);
    for (const p of await L.listPages(String(s._id))) {
      if (p.content?.cover) covers.add(String(p.content.cover).slice(0, 80));
      walk(p.content?.blocks, `${s.name}|${p.name || p._id}`);
    }
  }
  for (const t of tables) for (const e of await L.listExpands(String(t._id))) walk(e.layout?.blocks, `template «${e.name}»`);
  if (covers.size > 1) add("warn", "cover", `${covers.size} different page covers across the sides`);
  const tname = (id: string) => tables.find((t: any) => String(t._id) === id)?.name;
  for (const t of tables) if (rows[String(t._id)] === 1) {
    const from = (Object.values(F) as any[]).filter((f) => f.type === "records" && String(f.linkedTable ?? "") === String(t._id)).map((f) => `${tname(f.tid)}.${f.name}`);
    if (from.length) add("warn", "singleton", `«${t.name}» has one row and ${from.length} link(s) to it: ${from.join("، ")}. Will it grow?`);
  }
  for (const t of tables) if (shown.has(String(t._id)) && !create.has(String(t._id)) && !JOBS.has(t.name)) add("warn", "noCreate", `«${t.name}»: shown in lists, no «جدید» form, form block or auto-link anywhere (a job fills it? add it to JOB_TABLES)`);
  const order: Record<string, number> = { error: 0, warn: 1 };
  out.sort((a, b) => order[a[0]] - order[b[0]] || a[1].localeCompare(b[1]));
  for (const [l, r, m] of out) console.log(`${l.toUpperCase().padEnd(5)} ${r.padEnd(10)} ${m}`);
  const n = out.filter((o) => o[0] === "error").length;
  console.log(`\n${n} error(s), ${out.length - n} warning(s)`);
  if (n) process.exitCode = 1;
});
