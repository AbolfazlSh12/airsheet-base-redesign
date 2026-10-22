// Read-only acceptance check of every side and page (exit 1 on any finding). Each check is a review point a customer
// raised (design-guide rules 12, 26, 31, 32) or an editor autosave (CLAUDE.md «Writing data», quiet-layouts.ts):
//   noForm      list block whose «جدید» creates an empty record (no newForm/newFormPage)       → new-forms.ts
//   formBlock   a Form view placed on a page next to its list (rejected: use the «جدید» dialog)
//   urlLink     side menu / MENU / GALLERYMENU / TitleDivider pointing by URL at a page of this base → linktype "page"
//   noBg        page without `background`;  header   side without display name / logo, menu item without icon colour
//   autosave    blocks the editor rewrites on mount (toolbar flags, TitleDivider defaults, empty nested content, splitters)
// Also prints every table's Form views (input for new-forms.ts FORMS).
import * as L from "./lib";

const TOOL = ["showSettings", "showFilter", "showSort", "showGroup", "showSearchFields", "showPageSize"];
const TD = ["title", "showLine", "showButton", "buttonText", "showIndicator", "indicatorSizeKey", "indicatorOrient", "linktype", "openInNewTab", "url", "side", "indicatorColor", "buttonColor", "buttonTextColor", "lineColor", "titleColor"];
const LIST = ["Grid", "Gallery", "Kanban", "Calendar"];

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
  const F: Record<string, string[]> = { noForm: [], formBlock: [], urlLink: [], noBg: [], header: [], autosave: [] };
  const walk = (bs: any[], where: string) => {
    for (const b of bs || []) {
      const d = b.details ?? {};
      if (b.type === "VIEW" && d.value?.value) {
        const v = V[d.value.value] || {};
        if (v.type === "Form") F.formBlock.push(`${where} ${v.name}`);
        else if (LIST.includes(v.type) && (d.value.newable ?? "access") !== "denied" && !(d.value.newForm && d.value.newFormPage?.details?.value))
          F.noForm.push(`${where} ${v.type} «${v.name}» of «${v.tname}»`);
        if (d.value.viewToolbar === "visible" && TOOL.some((k) => d.value[k] == null)) F.autosave.push(`${where} VIEW toolbar flags`);
      }
      if ((b.type === "MENU" || b.type === "GALLERYMENU") && Array.isArray(d.value)) for (const it of d.value)
        if (it.linktype !== "page" && intoBase(it.url ?? it.value ?? it.link)) F.urlLink.push(`${where} «${it.label}»`);
      if (b.type === "TitleDivider") {
        if (TD.some((k) => d[k] === undefined)) F.autosave.push(`${where} TitleDivider defaults`);
        if (d.showButton && d.linktype !== "page" && intoBase(d.url)) F.urlLink.push(`${where} TitleDivider «${d.title}»`);
      }
      for (const k of ["column1", "column2", "column3", "column4", "section"]) if (b[k]) {
        if (!(b[k].content?.blocks || []).length) F.autosave.push(`${where} empty ${b.type}.${k}`);
        walk(b[k].content?.blocks, where);
      }
      if (/^COLUMNS[234]$/.test(b.type)) for (let i = 1; i < +b.type.slice(-1); i++) if (b[`column${i}`]?.splitter === undefined) F.autosave.push(`${where} ${b.type} splitter`);
      if (b.type === "TABS" && Array.isArray(d)) for (const t of d) { if (!(t.content?.blocks || []).length) F.autosave.push(`${where} empty tab`); walk(t.content?.blocks, `${where}>${t.label}`); }
    }
  };
  for (const s of sides) {
    const h = s.header || {};
    if (!h.name || !h.logo) F.header.push(`${s.name}: ${!h.name ? "no display name " : ""}${!h.logo ? "no logo" : ""}`);
    const items = (m: any[]): any[] => (m || []).flatMap((x) => [x, ...items(x.children)]);
    for (const it of items(h.menuItems)) {
      if (!it.icon || !it.iconColor) F.header.push(`${s.name}: menu «${it.title}» without icon/colour`);
      if (it.linktype !== "page" && intoBase(it.link ?? it.url)) F.urlLink.push(`${s.name}|header «${it.title}»`);
    }
    for (const p of pages[String(s._id)]) {
      const where = `${s.name}|${p.name || p._id}`;
      if (!p.content?.background) F.noBg.push(where);
      walk(p.content?.blocks, where);
    }
  }
  console.log(JSON.stringify({ forms }, null, 1));
  let n = 0;
  for (const [k, v] of Object.entries(F)) { console.log(`${k}: ${v.length}`); v.slice(0, 40).forEach((x) => console.log("  " + x)); n += v.length; }
  if (n) process.exitCode = 1;
});
