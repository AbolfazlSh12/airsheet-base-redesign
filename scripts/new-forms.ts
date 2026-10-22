// Post-process (run LAST, after every step that rebuilds pages — a page step re-run drops what this adds): every list
// block whose «جدید» would create an empty record (Grid / Gallery / Kanban / Calendar, newable ≠ "denied", no form)
// opens its table's form in the platform dialog instead — the keys the editor writes (ViewSettingMenu.vue selectForm):
// newForm:true + newFormPage {id, type:"VIEW", details:{value:<Form view id>}}. Blocks that already name a form are kept.
// FORMS=<path to {tableId: formViewId}> — pick the form per table yourself (page-lint.ts prints every table's Form views;
// a table without a usable one gets a «فرم ثبت …» Form view first, design-guide rule 12). Pages only, not templates.
import * as L from "./lib";
import * as fs from "fs";
import { createHash } from "crypto";

const FORMS: Record<string, string> = JSON.parse(fs.readFileSync(process.env.FORMS || "forms.json", "utf8"));
const LIST = new Set(["Grid", "Gallery", "Kanban", "Calendar"]);
const uid = (k: string) => { const h = createHash("sha1").update(`${L.BASE}-nf:` + k).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

L.run(async () => {
  const vt: Record<string, { type: string; table: string }> = {};
  for (const t of await L.listTables()) for (const v of await L.listViews(String(t._id))) vt[String(v._id)] = { type: v.type, table: String(t._id) };
  for (const [t, f] of Object.entries(FORMS)) if (vt[f]?.type !== "Form" || vt[f].table !== t) throw new Error(`${f} is not a Form view of table ${t}`);
  const missing = new Set<string>();
  const fix = (bs: any[]): any[] => (bs || []).map((b) => {
    const o: any = { ...b }; const d = b.details;
    if (b.type === "VIEW" && d?.value?.value) {
      const v = vt[d.value.value];
      const has = d.value.newForm && d.value.newFormPage?.details?.value;
      if (v && LIST.has(v.type) && (d.value.newable ?? "access") !== "denied" && !has) {
        const form = FORMS[v.table];
        if (form) o.details = { ...d, value: { ...d.value, newForm: true, newFormPage: { id: uid(`${b.id}-nf`), type: "VIEW", details: { value: form } } } };
        else missing.add(v.table);
      }
    }
    for (const k of ["column1", "column2", "column3", "column4", "section"]) if (b[k]?.content)
      o[k] = { ...b[k], content: { ...b[k].content, blocks: fix(b[k].content.blocks) } };
    if (b.type === "TABS" && Array.isArray(d)) o.details = d.map((t: any) => ({ ...t, content: { ...t.content, blocks: fix(t.content?.blocks) } }));
    return o;
  });
  for (const s of await L.listSides()) for (const p of await L.listPages(String(s._id))) {
    const c = p.content || {}; const q = { ...c, blocks: fix(c.blocks) };
    if (JSON.stringify(q) !== JSON.stringify(c)) await L.updatePage(String(p._id), { content: q });
  }
  if (missing.size) { console.log(`tables without a form in FORMS: ${[...missing].join(", ")}`); process.exitCode = 1; }
});
