// Read-only acceptance check of every side and page (exit 1 on any finding). Each check is a review point a customer
// raised (design-guide rules 12, 26, 31, 32) or an editor autosave (CLAUDE.md «Writing data», quiet-layouts.ts):
//   noForm      list block whose «جدید» creates an empty record (no newForm/newFormPage)       → new-forms.ts
//   formBlock   a Form view placed on a page next to its list (rejected: use the «جدید» dialog)
//   urlLink     side menu / MENU / GALLERYMENU / TitleDivider pointing by URL at a page of this base → linktype "page"
//   noBg        page without `background`;  header   side without display name / logo, menu item without icon colour
//   autosave    blocks the editor rewrites on mount (toolbar flags, TitleDivider defaults, empty nested content, splitters)
//   gridInColumn  a Grid / Kanban / Calendar inside COLUMNS2-4: half width gives a horizontal scrollbar and uneven
//               heights (design-guide 4.7; Eqlim home, 2026-11-10) → full-width card, or one card with TABS
//   bareList    a list VIEW outside any SECTION card, straight on the page pattern (design-guide rule «white cards»)
//   photoAsFile a record's photo, logo or album shown by a read-only RECORD block (file name + small thumbnail), on a page or a
//               record template → the «گالری تصاویر» block (ImageGallery, design-guide rule 28) — 2026-11-20, Hayat profile
// Also prints every table's Form views (input for new-forms.ts FORMS).
import * as L from "./lib";

const TOOL = ["showSettings", "showFilter", "showSort", "showGroup", "showSearchFields", "showPageSize"];
const TD = ["title", "showLine", "showButton", "buttonText", "showIndicator", "indicatorSizeKey", "indicatorOrient", "linktype", "openInNewTab", "url", "side", "indicatorColor", "buttonColor", "buttonTextColor", "lineColor", "titleColor"];
const LIST = ["Grid", "Gallery", "Kanban", "Calendar"];

const SIDEBAR_COLORS = ["blue3", "cyan3", "teal3", "green3", "yellow3", "orange3", "red3", "pink3", "purple3", "gray3", "blue4", "cyan4", "teal4", "green4", "yellow4", "orange4", "red4", "pink4", "purple4", "gray4", "#000000", "#ffffff"];
L.run(async () => {
  const V: Record<string, any> = {}; const forms: Record<string, any[]> = {};
  for (const t of await L.listTables()) for (const v of await L.listViews(String(t._id))) {
    V[String(v._id)] = { type: v.type, name: v.name, table: String(t._id), tname: t.name };
    if (v.type === "Form") (forms[`${t.name} ${t._id}`] ||= []).push(`${v.name} ${v._id}`);
  }
  const sides = await L.listSides(); const pages: Record<string, any[]> = {};
  for (const s of sides) pages[String(s._id)] = await L.listPages(String(s._id));
  const ids = [L.BASE, ...sides.map((s: any) => String(s._id)), ...Object.values(pages).flat().map((p: any) => String(p._id))];
  const intoBase = (u: any) => ids.some((id) => String(u ?? "").includes(id));
  const F: Record<string, string[]> = { noForm: [], formBlock: [], urlLink: [], noBg: [], header: [], autosave: [], gridInColumn: [], bareList: [] };
  const walk = (bs: any[], where: string, inCol = false, inCard = false) => {
    for (const b of bs || []) {
      const d = b.details ?? {};
      if (b.type === "VIEW" && d.value?.value) {
        const v = V[d.value.value] || {};
        if (v.type === "Form") F.formBlock.push(`${where} ${v.name}`);
        else if (LIST.includes(v.type) && (d.value.newable ?? "access") !== "denied" && !(d.value.newForm && d.value.newFormPage?.details?.value))
          F.noForm.push(`${where} ${v.type} «${v.name}» of «${v.tname}»`);
        if (d.value.viewToolbar === "visible" && TOOL.some((k) => d.value[k] == null)) F.autosave.push(`${where} VIEW toolbar flags`);
        if (inCol && ["Grid", "Kanban", "Calendar", "Gantt", "Pivot2"].includes(v.type)) F.gridInColumn.push(`${where} ${v.type} «${v.name}»`);
        if (!inCard && LIST.includes(v.type)) F.bareList.push(`${where} ${v.type} «${v.name}»`);
      }
      if ((b.type === "MENU" || b.type === "GALLERYMENU") && Array.isArray(d.value)) for (const it of d.value)
        if (it.linktype !== "page" && intoBase(it.url ?? it.value ?? it.link)) F.urlLink.push(`${where} «${it.label}»`);
      if (b.type === "TitleDivider") {
        if (TD.some((k) => d[k] === undefined)) F.autosave.push(`${where} TitleDivider defaults`);
        if (d.showButton && d.linktype !== "page" && intoBase(d.url)) F.urlLink.push(`${where} TitleDivider «${d.title}»`);
      }
      for (const k of ["column1", "column2", "column3", "column4", "section"]) if (b[k]) {
        if (!(b[k].content?.blocks || []).length) F.autosave.push(`${where} empty ${b.type}.${k}`);
        walk(b[k].content?.blocks, where, inCol || k !== "section", inCard || k === "section");
      }
      if (/^COLUMNS[234]$/.test(b.type)) for (let i = 1; i < +b.type.slice(-1); i++) if (b[`column${i}`]?.splitter === undefined) F.autosave.push(`${where} ${b.type} splitter`);
      if (b.type === "TABS" && Array.isArray(d)) for (const t of d) { if (!(t.content?.blocks || []).length) F.autosave.push(`${where} empty tab`); walk(t.content?.blocks, `${where}>${t.label}`, inCol, inCard); }
    }
  };
  for (const s of sides) {
    const h = s.header || {};
    if (!h.name || !h.logo) F.header.push(`${s.name}: ${!h.name ? "no display name " : ""}${!h.logo ? "no logo" : ""}`);
    const items = (m: any[]): any[] => (m || []).flatMap((x) => [x, ...items(x.children)]);
    for (const it of items(h.menuItems)) {
      // icon/iconColor have an editor only in the sidebar layout (SidebarMenuSetting.vue presetColors); a website header has none
      if (s.layoutType === "sidebar" && (!it.icon || !SIDEBAR_COLORS.includes(it.iconColor))) F.header.push(`${s.name}: menu «${it.title}» without icon or with a colour the picker does not offer (${it.iconColor})`);
      if (s.layoutType !== "sidebar" && (it.icon || it.iconColor)) F.header.push(`${s.name}: menu «${it.title}» carries icon/iconColor, which a website header cannot edit`);
      if (it.linktype !== "page" && intoBase(it.link ?? it.url)) F.urlLink.push(`${s.name}|header «${it.title}»`);
    }
    for (const p of pages[String(s._id)]) {
      const where = `${s.name}|${p.name || p._id}`;
      if (!p.content?.background) F.noBg.push(where);
      walk(p.content?.blocks, where);
    }
  }
  // photoAsFile: attachments fields whose stored files are images, then every RECORD block that shows one read-only
  const IMG = new Set<string>(), NAME: Record<string, string> = {};
  for (const t of await L.listTables()) {
    const att = (await L.listFields(String(t._id))).filter((f: any) => f.type === "attachments" || f.lookupType === "attachments");
    if (!att.length) continue;
    const rows = await L.listRecords(String(t._id));
    for (const f of att) { NAME[String(f._id)] = f.name; if (rows.some((r: any) => JSON.stringify(r[String(f._id)] ?? "").includes('"mimetype":"image/'))) IMG.add(String(f._id)); }
  }
  const photo: string[] = [];
  const seek = (x: any, where: string) => {
    if (!x || typeof x !== "object") return;
    if (x.type === "RECORD" && Array.isArray(x.details?.value)) for (const f of x.details.value)
      if (IMG.has(String(f)) && x.details.immutable?.[f] !== undefined) photo.push(`${where} RECORD «${NAME[f]}» → ImageGallery`);
    for (const v of Object.values(x)) seek(v, where);
  };
  for (const s of sides) for (const p of pages[String(s._id)]) seek(p.content, `${s.name}|${p.name || p._id}`);
  for (const t of await L.listTables()) for (const e of await L.listExpands(String(t._id))) seek(e.layout, `${t.name}|template «${e.name}»`);
  F.photoAsFile = photo;
  console.log(JSON.stringify({ forms }, null, 1));
  let n = 0;
  for (const [k, v] of Object.entries(F)) { console.log(`${k}: ${v.length}`); v.slice(0, 40).forEach((x) => console.log("  " + x)); n += v.length; }
  if (n) process.exitCode = 1;
});
