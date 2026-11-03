// Read-only: finds values in the base that the Airsheet UI never writes, so the owner cannot see or change them in the
// editor (non-negotiable 18, references/ui-values.md). Every rule is a value a build wrote and an editor audit proved
// unreachable (2026-11-01, kindergarten base). Exit 1 when anything is found. Run from cloud-back:
//   npx tsx <work>/build/ui-values-lint.ts
import * as L from "./lib";

const SIDEBAR_COLORS = ["blue3", "cyan3", "teal3", "green3", "yellow3", "orange3", "red3", "pink3", "purple3", "gray3",
  "blue4", "cyan4", "teal4", "green4", "yellow4", "orange4", "red4", "pink4", "purple4", "gray4", "#000000", "#ffffff"];
const PALETTE = /^var\(--(blue|cyan|teal|green|yellow|orange|red|pink|purple|gray)[2-4]?\)$/;
const READONLY_TYPES = ["lookup", "rollup", "count", "formula", "autonumber", "createdby", "modifiedby", "createdtime", "modifiedtime"];
const TIME_TOKENS = new Set(["now", "today", "clock", "today-1d", "today+1d", "now+1h", "today+7d", "today|jalali", "today|gregorian", "epoch"]);

L.run(async () => {
  const out: string[] = [];
  const hit = (where: string, what: string) => out.push(`${where}: ${what}`);
  const tables = await L.listTables();
  const fields: any[] = [];
  for (const t of tables) for (const f of await L.listFields(t._id)) fields.push({ ...f, tableName: t.name });
  const byId = new Map(fields.map((f) => [String(f._id), f]));

  for (const f of fields) {
    const rules = L.tryParse(f.linkViewRules) || [];
    if (JSON.stringify(rules).includes('"[role]"')) hit(`field ${f.tableName}.${f.name}`, "link-view rule on [role] (the rule editor never offers it; the-records.vue never evaluates it)");
  }
  for (const t of tables) for (const c of (t.constraints || []).map(L.tryParse)) for (const n of c.filters || []) {
    const x = n.filter || {}, ft = byId.get(String(x.field))?.type;
    if (x.operandType !== "field") continue;
    if (x.table === true) hit(`constraint ${t.name}/${c.name}`, "field operand with table:true (the constraint editor saves table:false)");
    if (ft === "records" && x.operator !== "dynamic") hit(`constraint ${t.name}/${c.name}`, `link field compared with «${x.operator}» (editor: «dynamic»)`);
    if (ft === "date" && x.relativeDate !== "dynamic") hit(`constraint ${t.name}/${c.name}`, "date field operand without relativeDate «dynamic»");
  }
  for (const r of await L.listRecordRoles()) if (r.userProperty === "mobile") hit(`record role ${r.name}`, 'userProperty "mobile" (the select offers "" for mobile)');
  for (const r of [...await L.listRoles(), ...await L.listUserRoles()]) if ((r.description || "").length > 31) hit(`role ${r.name}`, `description ${r.description.length} chars (editor max 31)`);

  for (const t of tables) for (const v of await L.listViews(t._id)) {
    const w = `view ${t.name}/${v.name}`;
    for (const s of (v.sorts || []).map(L.tryParse)) if (!["AZ", "ZA"].includes(s.direction)) hit(w, "sort without direction AZ/ZA (a missing direction sorts descending)");
    for (const g of (v.groups || []).map(L.tryParse)) if (g.direction === "ZA" || g.collapse === true) hit(w, "group direction ZA / collapse true (the group editor writes AZ / false only)");
    for (const l of Array.isArray(v.layout) ? v.layout : []) {
      if (v.type === "Intelligence" && !Array.isArray(l.filter)) hit(w, "chart without filter [] (its filter menu then crashes)");
      if (v.type === "Intelligence" && l.legend === false) hit(w, "chart legend false (no editor)");
      for (const i of l.inputs || []) if ("recordsSelect" in i || "recordsMultiple" in i) hit(w, `form input ${i.name}: recordsSelect/recordsMultiple (editors removed in 4fc6bad3b)`);
      if (v.type === "Form" && l.defaultValues && typeof l.defaultValues === "object") for (const k of Object.keys(l.defaultValues)) {
        const f = byId.get(k);
        if (f && READONLY_TYPES.includes(f.type)) hit(w, `default on ${f.type} field «${f.name}» (the form cell is read-only: it can be neither changed nor removed)`);
      }
    }
  }

  const blocks = (where: string, bs: any[], inRecord: boolean) => { for (const b of bs || []) {
    const v = b.type === "VIEW" && typeof b.details?.value === "object" ? b.details.value : null;
    if (v && "viewFilterbar" in v) hit(where, "VIEW viewFilterbar (control removed in 54b11ed33, still read)");
    if (v && "export" in v) hit(where, "VIEW export (control removed in 54b11ed33; use downloadList)");
    if (v && v.filterType === "none") hit(where, `VIEW filterType "none" (options are in/out/join${inRecord ? "; use showAll" : ""})`);
    if (b.type === "MENU" && Array.isArray(b.details?.value)) for (const m of b.details.value)
      for (const k of ["iconBgColor", "textColor"]) if (m[k] && m[k].startsWith("var(") && !PALETTE.test(m[k])) hit(where, `MENU ${k} ${m[k]} (not in the colour dialog)`);
    if (typeof b.padding === "string" && b.padding !== "") hit(where, `SECTION padding "${b.padding}" as text (the editor saves a number)`);
    if (typeof b.radius === "number") hit(where, `SECTION radius ${b.radius} as number (the editor saves text)`);
    if (typeof b.backgroundImage === "string" && b.backgroundImage.startsWith("data:")) hit(where, "SECTION backgroundImage data: URI (the editor stores an upload URL)");
    for (const k of ["section", "column1", "column2", "column3", "column4"]) if (b[k]?.content) blocks(where, b[k].content.blocks, inRecord);
    if (b.type === "TABS" && Array.isArray(b.details)) for (const tab of b.details) blocks(where, tab.content?.blocks, inRecord);
  } };
  for (const s of await L.listSides()) {
    for (const p of await L.listPages(s._id)) {
      blocks(`page ${s.name}/${p.name}`, p.content?.blocks, false);
      if (String(p.content?.background?.value || "").startsWith("data:")) hit(`page ${s.name}/${p.name}`, "background data: URI (the editor stores an upload URL)");
    }
    const items = (m: any[]): any[] => (m || []).flatMap((x) => [x, ...items(x.children)]);
    for (const m of items(s.header?.menuItems)) {
      if (s.layoutType === "sidebar" && m.iconColor && !SIDEBAR_COLORS.includes(m.iconColor)) hit(`side ${s.name}`, `menu «${m.title}» iconColor ${m.iconColor} (not in the sidebar picker)`);
      if (s.layoutType !== "sidebar" && (m.icon || m.iconColor)) hit(`side ${s.name}`, `menu «${m.title}» icon/iconColor on a ${s.layoutType} header (no editor there)`);
    }
  }
  for (const t of tables) for (const e of await L.listExpands(t._id)) {
    blocks(`template ${t.name}/${e.name}`, e.layout?.blocks, true);
    if (String(e.layout?.background?.value || "").startsWith("data:")) hit(`template ${t.name}/${e.name}`, "background data: URI");
  }

  const sides = await L.listSides(), defaults = sides.filter((s: any) => s.default === true);
  if (defaults.length !== 1) hit("sides", `${defaults.length} default sides (${defaults.map((s: any) => s.name).join(" + ")}); the settings page keeps exactly one`);
  if (sides.some((s: any) => s.type === "visitor") && !defaults.some((s: any) => s.type === "visitor")) hit("sides", "the base has a public site but it is not the default side");

  const autos = new Map((await L.listAutomations()).map((a: any) => [String(a._id), a]));
  for (const x of (await L.M.Action.find({ base: L.BASE }).lean()).map(L.parse)) {
    const a: any = autos.get(String(x.automation)), w = `automation ${a?.name ?? x.automation}/${x.type}`;
    const o = L.tryParse(x.options) || {};
    if (o.maxRecords != null) hit(w, `maxRecords ${o.maxRecords} (no editor; engine default 10000)`);
    if ((o.matchFields || []).some((m: any) => "label" in m)) hit(w, "matchFields[].label (not in the UI card shape)");
    for (const m of JSON.stringify(x).matchAll(/\{time:([^}]+)\}/g)) if (!TIME_TOKENS.has(m[1])) hit(w, `{time:${m[1]}} (the token menu offers ${[...TIME_TOKENS].join(", ")})`);
  }
  for (const a of autos.values()) if (a.cronType && !["jalaliMonthly", "monthly", "weekly", "hourly"].includes(a.cronType))
    hit(`automation ${a.name}`, `cronType ${a.cronType} (ScheduleTrigger.vue offers jalaliMonthly, monthly, weekly, hourly)`);

  for (const l of out) console.log(l);
  console.log(out.length ? `${out.length} value(s) the UI does not write` : "0 values the UI does not write");
  if (out.length) process.exitCode = 1;
});
