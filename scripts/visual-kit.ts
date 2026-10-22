// Visual kit for portal / workbench pages: the look a customer accepted after three review rounds («اداره امنیت»,
// 2026-10-22) — dark gradient HERO (chip, title, one-line sub, round icon badge), short info cards, icon-square section
// headings, white cards around lists, TABS instead of long scrolls, a per-side page background (wash + pattern).
// Sanitizer-safe: TEXT styles only from the whitelist (no flex alignment/gap/gradients, platform-lessons «Page HTML
// sanitiser»); gradients live in SVG data URIs used as SECTION backgroundImage / page background. Block ids are
// deterministic (uid, seeded with the base id) so a re-run is a no-op. Use from a step: `import * as K from "./visual-kit"`.
import { createHash } from "crypto";
import { BASE } from "./lib";

export const uid = (k: string) => { const h = createHash("sha1").update(`${BASE}-visual:` + k).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const svgUri = (svg: string) => "data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27");

// ---------- tones: one hue per side ----------
export type Tone = { name: string; dark: string; mid: string; accent: string; token: string; pattern?: string };
// one tone AND one pattern per side: `const t = { ...TONES.navy, pattern: "circuit" }`
export const TONES: Record<string, Tone> = {
  navy:   { name: "navy",   dark: "#0b1d3a", mid: "#17457a", accent: "#5aa9e6", token: "blue" },
  teal:   { name: "teal",   dark: "#08302f", mid: "#0f6b6a", accent: "#4fd1c5", token: "teal" },
  purple: { name: "purple", dark: "#1e1442", mid: "#4b2f8f", accent: "#a78bfa", token: "purple" },
  red:    { name: "red",    dark: "#3a0d14", mid: "#8a1f2d", accent: "#f87171", token: "red" },
  green:  { name: "green",  dark: "#0c2e1b", mid: "#1b6b3e", accent: "#4ade80", token: "green" },
  orange: { name: "orange", dark: "#3a1d07", mid: "#9a4a12", accent: "#fb923c", token: "orange" },
  slate:  { name: "slate",  dark: "#111827", mid: "#374151", accent: "#93c5fd", token: "gray" },
};

// ---------- page background: a visible wash + a pattern of its own per side ----------
// Calibrated with the customer: wash-only (accent 0.10→0.02→mid 0.06, no pattern) was "too faint, all pages alike";
// the patterns below at full strength were "too busy"; PATTERN_STRENGTH 0.55 + the wash below was accepted.
// Give each side a different pattern (not only a different hue). Transparent, so dark mode still works.
const PATTERNS: Record<string, (c: string, a: string) => string> = {
  circuit: (c, a) => `<pattern id="q" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M0 45h30l10-10h20l10 10h20M45 0v25l-8 8M45 90v-20l8-8" fill="none" stroke="${c}" stroke-opacity="0.16" stroke-width="1.6"/><circle cx="30" cy="45" r="3" fill="${a}" fill-opacity="0.35"/><circle cx="70" cy="45" r="3" fill="${a}" fill-opacity="0.35"/><circle cx="45" cy="25" r="2.5" fill="${c}" fill-opacity="0.3"/></pattern>`,
  hex: (c) => `<pattern id="q" width="56" height="97" patternUnits="userSpaceOnUse"><path d="M28 0l28 16v32L28 64 0 48V16zM28 64v33" fill="none" stroke="${c}" stroke-opacity="0.15" stroke-width="1.4"/></pattern>`,
  waves: (c) => `<pattern id="q" width="120" height="40" patternUnits="userSpaceOnUse"><path d="M0 20c20-14 40-14 60 0s40 14 60 0" fill="none" stroke="${c}" stroke-opacity="0.16" stroke-width="1.6"/></pattern>`,
  dots: (c) => `<pattern id="q" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2.2" fill="${c}" fill-opacity="0.2"/></pattern>`,
  grid: (c) => `<pattern id="q" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0v44" fill="none" stroke="${c}" stroke-opacity="0.14" stroke-width="1.2"/></pattern>`,
  diagonal: (c) => `<pattern id="q" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v22" stroke="${c}" stroke-opacity="0.13" stroke-width="2"/></pattern>`,
  plus: (c) => `<pattern id="q" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 13v14M13 20h14" stroke="${c}" stroke-opacity="0.2" stroke-width="2" stroke-linecap="round"/></pattern>`,
  chevron: (c) => `<pattern id="q" width="48" height="28" patternUnits="userSpaceOnUse"><path d="M0 22l24-16 24 16" fill="none" stroke="${c}" stroke-opacity="0.15" stroke-width="1.8"/></pattern>`,
  triangles: (c) => `<pattern id="q" width="60" height="52" patternUnits="userSpaceOnUse"><path d="M30 6l24 42H6z" fill="none" stroke="${c}" stroke-opacity="0.13" stroke-width="1.4"/></pattern>`,
  squares: (c) => `<pattern id="q" width="48" height="48" patternUnits="userSpaceOnUse"><rect x="10" y="10" width="18" height="18" rx="4" fill="none" stroke="${c}" stroke-opacity="0.16" stroke-width="1.5"/></pattern>`,
  rings: (c) => `<pattern id="q" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="14" fill="none" stroke="${c}" stroke-opacity="0.15" stroke-width="1.5"/><circle cx="50" cy="50" r="30" fill="none" stroke="${c}" stroke-opacity="0.09" stroke-width="1.5"/></pattern>`,
  nodes: (c, a) => `<pattern id="q" width="110" height="80" patternUnits="userSpaceOnUse"><path d="M10 15L60 40L100 12M60 40L35 72M60 40L95 70" fill="none" stroke="${c}" stroke-opacity="0.13" stroke-width="1.3"/><circle cx="10" cy="15" r="3.5" fill="${a}" fill-opacity="0.35"/><circle cx="60" cy="40" r="4" fill="${c}" fill-opacity="0.3"/><circle cx="100" cy="12" r="3" fill="${a}" fill-opacity="0.35"/><circle cx="35" cy="72" r="3" fill="${c}" fill-opacity="0.3"/><circle cx="95" cy="70" r="3" fill="${a}" fill-opacity="0.35"/></pattern>`,
  stars: (c, a) => `<pattern id="q" width="140" height="120" patternUnits="userSpaceOnUse"><circle cx="20" cy="30" r="2" fill="${c}" fill-opacity="0.35"/><circle cx="90" cy="18" r="1.6" fill="${a}" fill-opacity="0.5"/><circle cx="60" cy="80" r="2.4" fill="${c}" fill-opacity="0.3"/><circle cx="120" cy="96" r="1.8" fill="${a}" fill-opacity="0.45"/><path d="M20 30L60 80L90 18" fill="none" stroke="${c}" stroke-opacity="0.1"/></pattern>`,
};
// the tuning knob: multiplies every pattern opacity (0.55 accepted; 1 = too busy, 0 = wash only)
export const PATTERN_STRENGTH = Number(process.env.PATTERN_STRENGTH ?? 0.55);
const soften = (svg: string) => svg.replace(/(stroke|fill)-opacity="([\d.]+)"/g, (_m, k, v) => `${k}-opacity="${+(Number(v) * PATTERN_STRENGTH).toFixed(3)}"`);
export const PATTERN_NAMES = Object.keys(PATTERNS);
export const pageBg = (t: Tone, pattern = t.pattern ?? "dots") => ({ type: "image", fixed: true, value: svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">` +
  `<defs><linearGradient id="g" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.16"/>` +
  `<stop offset="0.5" stop-color="${t.accent}" stop-opacity="0.04"/><stop offset="1" stop-color="${t.mid}" stop-opacity="0.10"/></linearGradient>` +
  soften((PATTERNS[pattern] ?? PATTERNS.dots)(t.mid, t.accent)) + `</defs>` +
  `<rect width="1600" height="1000" fill="url(#g)"/><rect width="1600" height="1000" fill="url(#q)"/>` +
  `<circle cx="1480" cy="80" r="260" fill="${t.mid}" fill-opacity="0.065"/><circle cx="90" cy="930" r="220" fill="${t.accent}" fill-opacity="0.08"/></svg>`) });

// ---------- hero (image 3): dark gradient + diamond pattern, chip, title, round icon ----------
const heroBg = (t: Tone) => svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice">` +
  `<defs><linearGradient id="h" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.dark}"/></linearGradient>` +
  `<pattern id="p" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="34" height="34" fill="none" stroke="#ffffff" stroke-opacity="0.06"/></pattern></defs>` +
  `<rect width="1200" height="240" fill="url(#h)"/><rect width="1200" height="240" fill="url(#p)"/>` +
  `<circle cx="120" cy="40" r="160" fill="${t.accent}" fill-opacity="0.10"/></svg>`);

// 24×24 stroke icons (Lucide geometry) for the hero badge and section headings
export const ICONS: Record<string, string> = {
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`,
  shieldCheck: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
  alert: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  server: `<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>`,
  bug: `<rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/>`,
  chart: `<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>`,
  grid: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`,
  calendar: `<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>`,
  list: `<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  file: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/>`,
  lock: `<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  layers: `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`,
  briefcase: `<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>`,
  network: `<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>`,
  check: `<path d="M21.8 10A10 10 0 1 1 17 3.33"/><path d="m9 11 3 3L22 4"/>`,
  book: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>`,
  cpu: `<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>`,
};
const iconG = (name: string, stroke: string) =>
  `<g fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.shield}</g>`;
const iconSvg = (name: string, stroke: string, size = 24) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.shield}</svg>`;
const badge = (name: string, t: Tone) => svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
  `<circle cx="60" cy="60" r="56" fill="none" stroke="#ffffff" stroke-opacity="0.18"/><circle cx="60" cy="60" r="40" fill="#ffffff" fill-opacity="0.08"/>` +
  `<circle cx="104" cy="38" r="3" fill="${t.accent}"/><circle cx="18" cy="84" r="2.5" fill="#ffffff" fill-opacity="0.6"/>` +
  `<g transform="translate(42 42) scale(1.5)">${iconG(name, "#ffffff")}</g></svg>`);

/** Hero band: chip (breadcrumb-like eyebrow), title, optional one-line subtitle, round icon badge. */
export const hero = (k: string, t: Tone, o: { eyebrow: string; title: string; sub?: string; icon: string }) => ({
  id: uid(k), type: "SECTION", details: { value: "" }, filter: [], padding: "26", radius: "20", backgroundImage: heroBg(t),
  shadowEnabled: true, shadowIntensity: 14, maxWidth: "full",
  section: { label: "section", name: uid(k + "-s"), content: { name: "section", blocks: [
    { id: uid(k + "-c"), type: "COLUMNS2", details: { value: "" },
      column1: { label: "1", name: uid(k + "-c1"), splitter: 78, content: { name: "1", blocks: [
        { id: uid(k + "-t"), type: "TEXT", details: { value:
          `<p style="margin:0 0 12px"><span style="display:inline-block;background-color:rgba(255,255,255,0.12);color:#e6eefc;border:1px solid rgba(255,255,255,0.18);border-radius:999px;padding:3px 14px;font-size:12px;font-weight:600;line-height:1.9">${o.eyebrow}</span></p>` +
          `<p style="margin:0;color:#ffffff;font-size:30px;font-weight:800;line-height:1.5">${o.title}</p>` +
          (o.sub ? `<p style="margin:6px 0 0;color:#c9d6ea;font-size:14px;font-weight:400;line-height:1.9">${o.sub}</p>` : "") } } ] } },
      column2: { label: "2", name: uid(k + "-c2"), content: { name: "2", blocks: [
        { id: uid(k + "-i"), type: "TEXT", details: { value: `<p style="margin:0;text-align:left"><img src="${badge(o.icon, t)}" alt="" style="display:inline-block;width:104px;height:104px"></p>` } } ] } } } ] } },
});

/** Section heading as in image 3: small tinted icon square + bold title (+ optional muted hint after it). */
export const heading = (k: string, t: Tone, title: string, icon = "grid", hint = "") => ({ id: uid(k), type: "TEXT", details: { value:
  `<p style="margin:18px 0 6px;font-size:18px;font-weight:800;line-height:1.6;color:hsl(var(--bc))">` +
  `<img src="${svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><rect width="30" height="30" rx="8" fill="${t.accent}" fill-opacity="0.18"/><g transform="translate(6 6) scale(0.75)">${iconG(icon, t.mid)}</g></svg>`)}" alt="" style="display:inline-block;width:30px;height:30px;vertical-align:middle;margin:0 0 0 10px">` +
  `${title}` + (hint ? `<span style="font-size:13px;font-weight:400;color:hsl(var(--nc));margin:0 10px 0 0">${hint}</span>` : "") + `</p>` } });

/** White card that wraps lists, boards, dashboards. */
export const card = (k: string, blocks: any[], o: { padding?: string } = {}) => ({
  id: uid(k), type: "SECTION", details: { value: "" }, filter: [], color: "base-100", padding: o.padding ?? "16", radius: "16",
  borderLine: true, borderWeight: 1, borderColor: "gray2", shadowEnabled: true, shadowIntensity: 8, maxWidth: "full",
  section: { label: "section", name: uid(k + "-s"), content: { name: "section", blocks } } });

/** Short info card (title + ≤ 3 short lines) on a pale token — never long paragraphs. */
export const info = (k: string, token: string, title: string, lines: string[]) => ({
  id: uid(k), type: "SECTION", details: { value: "" }, filter: [], color: token, padding: "18", radius: "16", maxWidth: "full",
  section: { label: "section", name: uid(k + "-s"), content: { name: "section", blocks: [
    { id: uid(k + "-t"), type: "TEXT", details: { value:
      `<p style="margin:0 0 6px;font-size:15px;font-weight:800;line-height:1.7">${title}</p>` +
      lines.map((l) => `<p style="margin:0;font-size:13px;font-weight:400;line-height:2">• ${l}</p>`).join("") } } ] } } });

export const cols2 = (k: string, a: any[], b: any[], split = 50) => ({ id: uid(k), type: "COLUMNS2", details: { value: "" },
  column1: { label: "1", name: uid(k + "-1"), splitter: split, content: { name: "1", blocks: a } },
  column2: { label: "2", name: uid(k + "-2"), content: { name: "2", blocks: b } } });

export const tabs = (k: string, list: { label: string; blocks: any[] }[]) => ({ id: uid(k), type: "TABS", tabsBgColor: "base-100",
  details: list.map((x, i) => ({ label: x.label, name: uid(k + "-t" + i), color: "base-100", bold: i === 0, userFilterTab: [],
    content: { name: x.label, blocks: x.blocks } })) });

/** VIEW block with every display key the checklist wants. */
export const view = (k: string, viewId: string, o: { toolbar?: boolean; newable?: string; template?: string } = {}) => ({
  id: uid(k), type: "VIEW", details: { value: { value: viewId, expandTemplate: o.template ?? "default", displayListName: false,
    viewToolbar: o.toolbar ? "visible" : "invisible", viewFilterbar: o.toolbar ? "visible" : "invisible",
    newable: o.newable ?? "access", filterType: "none" } } });
// newable "access" keeps the «جدید» button an old block had (a default of "denied" silently removed it); every list with
// «جدید» then needs its form: new-forms.ts sets newForm/newFormPage, page-lint.ts fails without it.

/** Icon navigation cards (MENU type3). */
export const navCards = (k: string, items: { label: string; sub: string; icon: string; tone: string; side: string; path: string }[]) => ({
  id: uid(k), type: "MENU", details: { value: items.map((x, i) => ({ id: uid(k + i), label: x.label, subtitle: x.sub, theme: "type3",
    cardMediaType: "icon", lucidIcon: x.icon, bgColor: "hsl(var(--b1))", iconBgColor: `var(--${x.tone})`, textColor: `var(--${x.tone}4)`,
    linktype: "page", side: x.side, path: x.path, filter: [], value: "" })) } });

// The editor (ViewApp.vue initToolbarDefaults, cloud-front:1122) sets these six flags to true on every VIEW block with
// viewToolbar "visible" when it mounts; for the owner that mutation autosaves the page («در حال ذخیره‌سازی / ذخیره شد»
// on every open). Writing them ourselves, with the value the editor writes, makes opening a page a no-op.
const TOOLBAR_FLAGS = ["showSettings", "showFilter", "showSort", "showGroup", "showSearchFields", "showPageSize"];
export const quietBlocks = (blocks: any[]): any[] => (blocks || []).map((b) => {
  const out: any = { ...b };
  if (b.type === "VIEW" && b.details?.value?.viewToolbar === "visible") {
    const v = { ...b.details.value };
    for (const k of TOOLBAR_FLAGS) if (v[k] === undefined || v[k] === null) v[k] = true;
    out.details = { ...b.details, value: v };
  }
  for (const k of ["column1", "column2", "column3", "column4", "section"]) if (b[k]?.content)
    out[k] = { ...b[k], content: { ...b[k].content, blocks: quietBlocks(b[k].content.blocks) } };
  if (b.type === "TABS" && Array.isArray(b.details))
    out.details = b.details.map((t: any) => ({ ...t, content: { ...t.content, blocks: quietBlocks(t.content?.blocks) } }));
  return out;
});

/** Page document wrapper. */
// content.name prints a title strip above everything; pages that open with a hero leave it "" (as the user's reference
// page does) so the title is not shown twice. Page.name (lists/menus) is a separate field and is not touched.
export const pageDoc = (name: string, t: Tone, blocks: any[], o: { maxw?: string; cover?: string } = {}) => ({
  name: blocks[0]?.backgroundImage ? "" : name, maxw: o.maxw ?? "tw-max-w-6xl", align: { value: "center", label: "وسط" }, background: pageBg(t),
  ...(o.cover ? { cover: o.cover, coverHeight: 140, coverVariants: { mobile: { height: 100 } } } : {}), blocks: quietBlocks(blocks) });

/** Side header: logo, Persian display name, a Lucide icon + colour on every menu item and child (keeps every item and
 *  link; an item that already has a colour keeps it). `logo` = an uploaded key that EXISTS on this server: a base
 *  restored from a backup keeps side logo keys whose files are gone (broken image) — the base logo usually survives. */
export const sideHeader = (header: any, name: string, logo: string, icons: Record<string, { icon: string; color: string }>, fallback: { icon: string; color: string }) => {
  const paint = (items: any[]): any[] => (items || []).map((m) => {
    const ic = icons[m.title] ?? fallback;
    return { ...m, icon: m.icon && m.icon !== "Home" && !icons[m.title] ? m.icon : ic.icon, iconColor: icons[m.title]?.color ?? m.iconColor ?? ic.color, children: paint(m.children) };
  });
  return { ...header, name, logo, darkLogo: logo, menuItems: paint(header?.menuItems) };
};

// ---------- flow 1 guard: a rebuilt page still offers everything the old one did ----------
const offers = (content: any) => {
  const out = new Set<string>();
  const walk = (x: any): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const d = x.details;
    if (x.type === "VIEW") { const v = typeof d?.value === "object" ? d.value : { value: d?.value }; out.add(`VIEW ${v.value} ${v.expandTemplate ?? "default"}`); }
    if (x.type === "EMBED") out.add("EMBED " + d?.value);
    if (x.type === "FileBlock") (d?.files ?? []).forEach((f: any) => out.add("FILE " + f.key));
    if (["TASKMANAGER", "ExpandRecord", "BUTTON"].includes(x.type)) out.add(x.type);
    if (x.type === "STATS") (d?.value ?? []).filter((s: any) => s.table).forEach((s: any) => out.add(`STAT ${s.table} ${s.field} ${JSON.stringify(s.filter)} ${s.drilldownView}`));
    if (["GALLERYMENU", "MENU"].includes(x.type)) (d?.value ?? []).filter((m: any) => m.path || m.url).forEach((m: any) => out.add(`LINK ${m.side} ${m.path ?? m.url}`));
    // newFormPage = the form «جدید» opens (a setting of the list block, set by new-forms.ts), not a block of the page
    Object.entries(x).forEach(([k, v]) => k !== "newFormPage" && walk(v));
  };
  walk(content?.blocks);
  return out;
};
/** throws when the new content drops a view (same id + template), embed, file, task manager, button, stat or link */
export const assertKept = (page: string, before: any, after: any) => {
  const now = offers(after), lost = [...offers(before)].filter((s) => !now.has(s));
  if (lost.length) throw new Error(`page ${page} would lose: ${lost.join(" | ")}`);
};
