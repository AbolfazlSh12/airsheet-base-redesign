// «ذخیره شد» on every record open (Amin, 2026-10-17). Cause: for a base owner, composables/record.js installs a deep
// watcher on the template layout that calls uexpandtemplate whenever the layout object mutates; several blocks
// normalise themselves when they mount, and the script-built templates lacked those defaults, so every open was a
// save: TitleDividerBlock.initDefaults() adds buttonText/linktype/openInNewTab/url/side/buttonColor/buttonTextColor/
// lineColor…, NotionViewer inserts an empty TEXT into any nested content with 0 blocks (section, column, tab,
// PROGRESS state — a different record renders a different state, hence "every time"), Columns2/3/4 set missing
// splitters; ViewApp.initToolbarDefaults() adds six show* flags to a list block with a visible toolbar (pages: TABS render one
// tab at a time, so each tab switch was another save). This step writes exactly those defaults into every template (and page) so nothing changes on open.
// Idempotent: a template is written only when the normalised layout differs.
import * as L from "./lib";

const TD_DEFAULTS: Record<string, any> = { title: "عنوان جدید", showLine: true, showButton: true, buttonText: "مشاهده همه", showIndicator: true, indicatorSizeKey: "md", indicatorOrient: "vertical", linktype: "page", openInNewTab: false, url: "", indicatorColor: "var(--blue2)", buttonColor: "var(--blue2)", buttonTextColor: "#ffffff", lineColor: "var(--gray3)", titleColor: "" };
const SPLIT: Record<string, number[]> = { COLUMNS2: [50], COLUMNS3: [33.33, 50], COLUMNS4: [25, 33.33, 50] };
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const emptyText = (id: string) => ({ id, type: "TEXT", details: { value: "" } });

// mutate in place; return the number of changes
function normalise(blocks: any[], side: string | undefined, path: string): number {
  let n = 0;
  const fill = (content: any, key: string) => { if (content && Array.isArray(content.blocks) && content.blocks.length === 0) { content.blocks.push(emptyText(key)); n++; } if (content?.blocks) n += normalise(content.blocks, side, key); };
  for (const b of blocks || []) {
    if (b.type === "TitleDivider") {
      b.details = b.details || {};
      for (const [k, v] of Object.entries(TD_DEFAULTS)) if (b.details[k] === undefined) { b.details[k] = v; n++; }
      if (b.details.side === undefined && side) { b.details.side = side; n++; }
    }
    // ViewApp.initToolbarDefaults(): a visible toolbar writes six show* flags when they are undefined/null
    if (b.type === "VIEW" && b.details?.value && b.details.value.viewToolbar === "visible") {
      for (const k of ["showSettings", "showFilter", "showSort", "showGroup", "showSearchFields", "showPageSize"]) if (b.details.value[k] === undefined || b.details.value[k] === null) { b.details.value[k] = true; n++; }
    }
    if (SPLIT[b.type]) SPLIT[b.type].forEach((v, i) => { const c = b[`column${i + 1}`]; if (c && !c.splitter) { c.splitter = v; n++; } });
    if (b.section) fill(b.section.content, `${b.id}-s0`);
    for (const k of ["column1", "column2", "column3", "column4"]) if (b[k]) fill(b[k].content, `${b.id}-${k}-0`);
    if (b.type === "TABS" && Array.isArray(b.details)) b.details.forEach((t: any, i: number) => fill(t.content, `${b.id}-tab${i}-0`));
    if (b.type === "PROGRESS" && b.details?.states) b.details.states.forEach((s: any, i: number) => { if (s.content && Array.isArray(s.content.blocks)) fill(s.content, `${b.id}-state${i}-0`); });
  }
  return n;
}

L.run(async () => {
  let touched = 0;
  for (const t of await L.listTables()) {
    for (const e of await L.listExpands(String(t._id))) {
      const layout = JSON.parse(JSON.stringify(e.layout));
      const n = normalise(layout.blocks, e.sides?.[0] ? String(e.sides[0]) : undefined, e.name);
      if (n && !same(layout, e.layout)) { await L.updateExpand(String(e._id), { layout }); touched++; console.log(`+ template «${e.name}»: ${n} default(s) written`); }
      else console.log(`= template «${e.name}» quiet`);
    }
  }
  for (const s of await L.listSides()) {
    for (const p of await L.listPages(String(s._id))) {
      if (!p.content?.blocks) continue;
      const content = JSON.parse(JSON.stringify(p.content));
      const n = normalise(content.blocks, String(s._id), p.name);
      if (n && !same(content, p.content)) { await L.updatePage(String(p._id), { content }); touched++; console.log(`+ page «${p.name}»: ${n} default(s) written`); }
    }
  }
  console.log(`done (${touched} object(s) written)`);
});
