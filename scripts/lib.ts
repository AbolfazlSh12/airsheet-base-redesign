/* Safe edits to ONE Airsheet base through the same GraphQL resolvers the UI calls. Usage: references/lib.md.
   Copy this file (and project.json) into <work>/build/ and run scripts from the cloud-back checkout with `npx tsx`. */
import fs from "fs";
import { randomUUID } from "crypto";

const cfgFile = `${__dirname}/project.json`;
const P: Record<string, string> = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
const must = (env: string, key: string) => {
  const v = process.env[env] ?? P[key];
  if (!v) throw new Error(`set ${env} or "${key}" in ${cfgFile}`);
  return v;
};
const APP = process.env.AIRSHEET_BACKEND ?? P.backend ?? process.cwd();
if (!fs.existsSync(`${APP}/src/modules/database/master.js`) && !fs.existsSync(`${APP}/src/modules/database/master.ts`)) {
  throw new Error(`${APP} is not a cloud-back checkout: run from cloud-back or set AIRSHEET_BACKEND`);
}

// Must run before any app module loads: appendb.js imports the automation resolvers, which call
// queue.process() at import time. Without this the script becomes a Bull worker and can pick up
// (and half-run) cron automations of ANY base on the shared Redis. The server stays the only worker.
require(`${APP}/node_modules/bull`).prototype.process = async () => {};

const req = (p: string) => { const m = require(`${APP}/src/${p}`); return m.default ?? m; };
const mongoose = require(`${APP}/node_modules/mongoose`);
const { getRedisClient } = require(`${APP}/src/tools/redis`);
const { getDBConnection } = require(`${APP}/src/tools/mongo`);
const { validationMiddlewares } = require(`${APP}/src/api/graphql/middlewares/validateResolvers`);
const { read: readRecord } = require(`${APP}/src/modules/database/appendb`);
const master = req("modules/database/master");
const typeDefs = req("api/graphql/typeDefs");

export const M: Record<string, any> = {
  Base: req("modules/database/models/Base"),
  Table: req("modules/database/models/Table"),
  Field: req("modules/database/models/Field"),
  View: req("modules/database/models/View"),
  Role: req("modules/database/models/Role"),
  UserRole: req("modules/database/models/UserRole"),
  RecordRole: req("modules/database/models/RecordRole"),
  ExpandTemplate: req("modules/database/models/ExpandTemplate"),
  Side: req("modules/notion/models/Side"),
  Page: req("modules/notion/models/Page"),
  Automation: req("modules/automation/models/Automation"),
  Action: req("modules/automation/models/Action"),
};
const R: Record<string, any> = {
  ...req("modules/database/resolvers/index").Mutation,
  ...req("modules/automation/resolvers/index").Mutation,
};

// Greenfield: AIRSHEET_BOOTSTRAP=1 lets the lib load before the base exists, only so createBase() can run.
const BOOTSTRAP = process.env.AIRSHEET_BOOTSTRAP === "1";
export const BASE = BOOTSTRAP ? (process.env.AIRSHEET_BASE ?? P.base ?? "") : must("AIRSHEET_BASE", "base");
export const OWNER = must("AIRSHEET_OWNER", "owner");
export const LOG = process.env.CHANGES_LOG ?? P.changesLog ?? `${__dirname}/changes.log`;
const DRY = process.env.DRY === "1";
const ALLOW_LIVE = process.env.ALLOW_LIVE === "1";
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 20000);
type Opts = { force?: boolean };

// ---------- JSON-string fields ----------
const STR_JSON = new Set(["content", "layout", "header", "footer", "layouts", "filters", "preferences", "menu", "options",
  "conditions", "actions", "default", "colors", "rollupFilter", "linkViewRules", "kanbanSettings", "theme",
  "conditionalColors", "fieldColors", "summaryFields", "statsFields", "fields"]);
const ARR_JSON = new Set(["sorts", "groups", "constraints", "limits"]);
export const tryParse = (v: any) => {
  if (typeof v !== "string" || !/^\s*[[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch { return v; }
};
const norm = (k: string, v: any) =>
  STR_JSON.has(k) ? tryParse(v) : ARR_JSON.has(k) && Array.isArray(v) ? v.map(tryParse) : v;
export const parse = (doc: any) => {
  if (!doc) return doc;
  const o = JSON.parse(JSON.stringify(doc));
  for (const k of Object.keys(o)) o[k] = norm(k, o[k]);
  return o;
};
const enc = (patch: any) => {
  const o = JSON.parse(JSON.stringify(patch));
  for (const k of Object.keys(o)) {
    if (k === "fields" && Array.isArray(o[k])) continue;
    if (STR_JSON.has(k) && o[k] != null && typeof o[k] !== "string") o[k] = JSON.stringify(o[k]);
    if (ARR_JSON.has(k) && Array.isArray(o[k])) o[k] = o[k].map((x: any) => (typeof x === "string" ? x : JSON.stringify(x)));
  }
  return o;
};

const SECRET_RE = /((?:api[_-]?key|token|password|passwd|secret|authorization|bearer|pass)["'\\]*\s*[:=]\s*["'\\]*)([^"'&\\\s,}]+)/gi;
const SECRET_KEY = /^(api[_-]?key|token|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization|bearer(token)?|pass)$/i;
const maskAll = (v: any): any => typeof v === "string" ? (v ? "***" : v)
  : Array.isArray(v) ? v.map(maskAll)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskAll(x)])) : v;
// Masks before encoding, so a log line stays valid JSON (masking the encoded text left bare *** in objects).
const redact = (line: any) => JSON.stringify(line, (k, v) =>
  k && SECRET_KEY.test(k) ? maskAll(v) : typeof v === "string" ? v.replace(SECRET_RE, "$1***") : v);

// ---------- core ----------
const MUT: Record<string, { args: string[]; required: string[] }> = {};
for (const d of typeDefs.definitions) {
  if (d.name?.value !== "Mutation") continue;
  for (const f of d.fields) MUT[f.name.value] = {
    args: f.arguments.map((a: any) => a.name.value),
    required: f.arguments.filter((a: any) => a.type.kind === "NonNullType").map((a: any) => a.name.value),
  };
}
const ctx = (): any => ({
  user: { _id: OWNER, session: "base-redesign" }, db: mongoose.connection, ip: "127.0.0.1", ua: "base-redesign",
  language: "fa", startTime: Date.now(), logExtraData: {},
});
const middleware = (name: string) => validationMiddlewares.find((m: any) => m.Mutation?.[name])?.Mutation[name];

export async function validate(name: string, args: any) {
  const s = MUT[name];
  if (!s || !R[name]) throw new Error(`unknown mutation ${name}`);
  const extra = Object.keys(args).filter((k) => !s.args.includes(k));
  const missing = s.required.filter((k) => args[k] == null);
  if (extra.length || missing.length) throw new Error(`${name}: args not in GraphQL schema [${extra}] missing [${missing}]`);
  const mw = middleware(name);
  if (mw) await mw(async () => ({}), null, args, ctx());
}

export async function call(name: string, args: any) {
  await validate(name, args);
  const mw = middleware(name);
  const res = mw ? await mw(R[name], null, args, ctx()) : await R[name](null, args, ctx());
  if (res == null || res.status === "failure" || (res.constructor === Object && !Object.keys(res).length)) {
    throw new Error(`${name} failed: ${res?.message ?? JSON.stringify(res)}`);
  }
  return res;
}

const j = (x: any) => JSON.stringify(x ?? null);
const diffOf = (before: any, patch: any) => Object.fromEntries(Object.keys(patch)
  .filter((k) => j(norm(k, before?.[k])) !== j(norm(k, patch[k])))
  .map((k) => [k, { from: norm(k, before?.[k]) ?? null, to: norm(k, patch[k]) }]));

async function change(kind: string, id: string, before: any, patch: any,
  apply: () => Promise<any>, reread: (r: any) => Promise<any>, opts: Opts = {}) {
  const diff = diffOf(before, patch);
  if (!Object.keys(diff).length && !opts.force) { console.log(`= ${kind} ${id} unchanged`); return parse(before); }
  const line: any = { ts: new Date().toISOString(), kind, id, diff };
  if (DRY) { console.log("DRY " + redact(line)); return parse({ ...before, ...patch }); }
  let r: any;
  try { r = await apply(); if (typeof r === "string") line.created = r; }
  catch (e: any) { line.error = e?.message; throw e; }
  finally { fs.appendFileSync(LOG, redact(line) + "\n"); }
  return reread(r);
}

async function own(Model: any, id: string, what: string) {
  const d = await Model.findOne({ _id: id, base: BASE }).lean();
  if (!d) throw new Error(`${what} ${id} not found in base ${BASE}`);
  return d;
}
async function assertIds(Model: any, ids: any, what: string, extra: any = {}) {
  if (!Array.isArray(ids) || !ids.length) return;
  const n = await Model.countDocuments({ _id: { $in: ids }, base: BASE, ...extra });
  if (n !== new Set(ids.map(String)).size) throw new Error(`unknown ${what} id in ${ids}`);
}
const assertRoles = (ids: any) => assertIds(M.Role, ids, "role (or blocked)", { isBlocked: false });

const isLive = (type: any) => !!type && !["createRecord", "updateRecord", "deleteRecord"].includes(type);
async function assertQuiet(tableId: string) {
  if (ALLOW_LIVE) return;
  const autos = await M.Automation.find({ base: BASE, table: tableId, active: true, type: { $nin: ["cron", "period"] } }).lean();
  const acts = await M.Action.find({ automation: { $in: autos.map((a: any) => a._id) } }).lean();
  const db = mongoose.connection;
  const baseQ = { base: { $in: [BASE, new mongoose.Types.ObjectId(BASE)] } };
  const why = [
    acts.some((a: any) => isLive(a.type)) && "an active automation with external actions",
    (await db.collection("hooks").countDocuments(baseQ)) && "webhooks",
    (await db.collection("plugins").countDocuments(baseQ)) && "plugins",
    (await M.Field.countDocuments({ table: tableId, type: "collaborator", $or: [{ notify: true }, { taskField: true }] })) && "assignee notifications",
  ].filter(Boolean);
  if (why.length) throw new Error(`record write on table ${tableId} would fire ${why.join(", ")}; set ALLOW_LIVE=1 only with test providers`);
}

export const byName = (list: any[], name: string) => {
  const x = list.find((i) => i.name === name);
  if (!x) throw new Error(`no item named ${name}`);
  return x;
};

export async function run(fn: () => Promise<void>) {
  try {
    if (!getRedisClient().isOpen) await getRedisClient().connect();
    await getDBConnection();
    await fn();
  } catch (e: any) { console.error("ERR", e?.message); process.exitCode = 1; }
  if (!DRY) await new Promise((r) => setTimeout(r, SETTLE_MS));
  process.exit(process.exitCode ?? 0);
}

// ---------- base ----------
export const getBase = async () => parse(await M.Base.findById(BASE).select("-tokens -scripts").lean());
const BASE_DENY = ["creator", "isTemplate", "roles", "acl", "baleToken", "tokens", "scripts", "rate", "tags"];
export async function updateBase(id: string, patch: any, opts?: Opts) {
  if (id !== BASE) throw new Error(`only base ${BASE}`);
  const bad = Object.keys(patch).filter((k) => BASE_DENY.includes(k));
  if (bad.length) throw new Error(`refusing base keys ${bad}`);
  const before = await M.Base.findById(BASE).select("-tokens -scripts").lean();
  if (patch.preferences && typeof patch.preferences === "object") {
    patch = { ...patch, preferences: { ...tryParse(before.preferences), ...patch.preferences } };
  }
  const p = enc(patch);
  return change("base", id, before, p, () => call("ubase", { base: id, ...p }), () => getBase(), opts);
}

// Greenfield only (AIRSHEET_BOOTSTRAP=1 ALLOW_LIVE=1). Creates the base as OWNER (cbase also creates the owner collaborator, a default side «تیم» and one
// page) and writes its id into project.json. Refuses when project.json already names a base.
export async function createBase(name: string, requirementDescription = "") {
  if (!BOOTSTRAP) throw new Error("createBase needs AIRSHEET_BOOTSTRAP=1");
  if (BASE) throw new Error(`project.json already names base ${BASE}; one project = one base`);
  if (!ALLOW_LIVE) throw new Error("cbase posts the owner's mobile to sales.uba.inputUrl and may add a row to sales.uba.newUsersTable; rerun with ALLOW_LIVE=1 once the user agreed (greenfield.md G3)");
  const line: any = { ts: new Date().toISOString(), kind: "base.create", id: "", diff: { name: { from: null, to: name } } };
  if (DRY) { console.log("DRY " + redact(line)); return ""; }
  let id = "";
  try { id = String((await call("cbase", { name, requirementDescription })).message); line.id = id; line.created = id; }
  catch (e: any) { line.error = e?.message; throw e; }
  finally { fs.appendFileSync(LOG, redact(line) + "\n"); }
  fs.writeFileSync(cfgFile, JSON.stringify({ ...P, base: id }, null, 1) + "\n");
  console.log(`base ${id} created and saved to ${cfgFile}`);
  return id;
}

// ---------- roles ----------
export const listRoles = async () => (await M.Role.find({ base: BASE }).lean()).map(parse);
export async function createRole(name: string, description = "", opts?: Opts) {
  const existing = await M.Role.findOne({ base: BASE, name }).lean();
  if (existing) { console.log(`= role «${name}» exists`); return parse(existing); }
  return change("role.create", BASE, {}, { name, description },
    async () => String((await call("crole", { base: BASE, name, description })).message),
    async (id) => parse(await M.Role.findById(id).lean()), opts);
}

// ---------- tables ----------
export const getTable = async (id: string) => parse(await own(M.Table, id, "table"));
export const listTables = async () => (await M.Table.find({ base: BASE }).lean()).map(parse);
// ctable also creates a default Grid view and a text primary field «نام»: rename/retype that field with updateField
// (type change only while the table is empty) instead of adding a second title field.
export async function createTable(name: string, opts?: Opts) {
  const existing = await M.Table.findOne({ base: BASE, name }).lean();
  if (existing) { console.log(`= table «${name}» exists`); return parse(existing); }
  return change("table.create", BASE, {}, { name },
    async () => String((await call("ctable", { base: BASE, name }))._id), (id) => getTable(id), opts);
}
// Greenfield rebuilds only: refuses a table that has any record or is linked from another table.
export async function deleteTable(id: string, opts?: Opts) {
  const before = await own(M.Table, id, "table");
  const n = await countRecords(id);
  if (n) throw new Error(`deleteTable: «${before.name}» has ${n} record(s)`);
  const refs = await M.Field.countDocuments({ base: BASE, linkedTable: id, table: { $ne: id } });
  if (refs) throw new Error(`deleteTable: «${before.name}» is linked from ${refs} field(s) in other tables`);
  return change("table.delete", id, before, { deleted: true }, () => call("dtable", { table: id }), async () => null, opts);
}
export async function updateTable(id: string, patch: any, opts?: Opts) {
  const before = await own(M.Table, id, "table");
  for (const k of ["canview", "canadd", "candelete", "canviewfields", "caneditfields"]) await assertRoles(patch[k]);
  const p = enc(patch);
  return change("table", id, before, p, () => call("utable", { table: id, ...p }), () => getTable(id), opts);
}
export async function upsertConstraint(tableId: string, constraint: any, opts?: Opts) {
  const before = await own(M.Table, tableId, "table");
  const list = (before.constraints || []).map(tryParse);
  const i = constraint.id ? list.findIndex((c: any) => String(c.id) === String(constraint.id)) : -1;
  const next = i < 0 ? [...list, constraint] : list.map((c: any, n: number) => (n === i ? { ...c, ...constraint } : c));
  return change("table.constraints", tableId, before, enc({ constraints: next }),
    () => call(i < 0 ? "createConstraint" : "updateConstraint", { table: tableId, constraint: JSON.stringify(constraint) }),
    () => getTable(tableId), opts);
}

// ---------- fields ----------
export const getField = async (id: string) => parse(await own(M.Field, id, "field"));
export const listFields = async (tableId: string) => (await M.Field.find({ base: BASE, table: tableId }).lean()).map(parse);
export async function createField(tableId: string, spec: any, opts?: Opts) {
  await own(M.Table, tableId, "table");
  const existing = await M.Field.findOne({ base: BASE, table: tableId, name: spec.name }).lean();
  if (existing) { console.log(`= field «${spec.name}» exists`); return parse(existing); }
  const p = enc(spec);
  return change("field.create", tableId, {}, p,
    async () => String((await call("cfield", { base: BASE, table: tableId, ...p }))._id), (id) => getField(id), opts);
}
export async function updateField(id: string, patch: any, opts?: Opts & { allowTypeChangeOnEmptyTable?: boolean }) {
  const before = await own(M.Field, id, "field");
  if ("type" in patch && patch.type !== before.type) {
    if (!opts?.allowTypeChangeOnEmptyTable) throw new Error("field type changes are out of scope (greenfield: pass allowTypeChangeOnEmptyTable)");
    const n = await countRecords(String(before.table));
    if (n) throw new Error(`type change refused: table has ${n} record(s)`);
  }
  await assertRoles(patch.canview);
  await assertRoles(patch.canedit);
  const p = enc(patch);
  const keep = ["lookup", "rollup"].includes(before.type) && !p.rollupField ? { rollupField: String(before.rollupField) } : {};
  return change("field", id, before, p, () => call("ufield", { field: id, ...p, ...keep }), () => getField(id), opts);
}

// ---------- views ----------
export const getView = async (id: string) => parse(await own(M.View, id, "view"));
export const listViews = async (tableId: string) => (await M.View.find({ base: BASE, table: tableId }).lean()).map(parse);
export async function createView(tableId: string, spec: any, opts?: Opts) {
  await own(M.Table, tableId, "table");
  const existing = await M.View.findOne({ table: tableId, name: spec.name }).lean();
  if (existing) { console.log(`= view «${spec.name}» exists`); return parse(existing); }
  const { type = "Grid", name, subtype, ...rest } = spec;
  const p = enc(rest);
  return change("view.create", tableId, {}, enc(spec), async () => {
    const v = await call("cview", { table: tableId, type, name, ...(subtype ? { subtype } : {}) });
    if (Object.keys(p).length) await call("uview", { _id: String(v._id), ...p });
    return String(v._id);
  }, (id) => getView(id), opts);
}
export async function updateView(id: string, patch: any, opts?: Opts) {
  const before = await own(M.View, id, "view");
  const p = enc(patch);
  return change("view", id, before, p, () => call("uview", { _id: id, ...p }), () => getView(id), opts);
}

// ---------- sides & pages ----------
export const getSide = async (id: string) => parse(await own(M.Side, id, "side"));
export const listSides = async () => (await M.Side.find({ base: BASE }).lean()).map(parse);
export async function updateSide(id: string, patch: any, opts?: Opts) {
  const before = await own(M.Side, id, "side");
  await assertRoles(patch.roles);
  await assertIds(M.Page, patch.pagesOrder, "page of this side", { side: id });
  const p = enc(patch);
  return change("side", id, before, p, () => call("uside", { base: BASE, _id: id, ...p }), () => getSide(id), opts);
}

// cside also creates one empty page. type: "collaborator" (staff) | "user" (login via userRole/accreditView) | "visitor".
export async function createSide(spec: { name: string; type: string; [k: string]: any }, opts?: Opts) {
  const existing = await M.Side.findOne({ base: BASE, name: spec.name }).lean();
  if (existing) { console.log(`= side «${spec.name}» exists`); return parse(existing); }
  await assertRoles(spec.roles);
  if (spec.userRole) await own(M.UserRole, spec.userRole, "userrole");
  if (spec.accreditView) await own(M.View, spec.accreditView, "view");
  const p = enc(spec);
  return change("side.create", BASE, {}, p, async () => String((await call("cside", { base: BASE, ...p }))._id), (id) => getSide(id), opts);
}

export const getPage = async (id: string) => parse(await own(M.Page, id, "page"));
export async function listPages(sideId: string) {
  const order = (await own(M.Side, sideId, "side")).pagesOrder.map(String);
  const rank = (p: any) => { const i = order.indexOf(String(p._id)); return i < 0 ? Infinity : i; };
  return (await M.Page.find({ base: BASE, side: sideId }).lean()).sort((a: any, b: any) => rank(a) - rank(b)).map(parse);
}
export async function updatePage(id: string, patch: any, opts?: Opts) {
  const before = await own(M.Page, id, "page");
  const p = enc(patch);
  const falsy = Object.keys(p).filter((k) => !p[k]);
  if (falsy.length) throw new Error(`upage silently ignores falsy values: ${falsy}`);
  return change("page", id, before, p, () => call("upage", { base: BASE, _id: id, ...p }), () => getPage(id), opts);
}
export async function setPagePublished(id: string, published = true, opts?: Opts) {
  const before = await own(M.Page, id, "page");
  return change("page", id, before, { status: published ? "published" : "draft" },
    () => call(published ? "publishPage" : "unpublishPage", { base: BASE, page: id }), () => getPage(id), opts);
}
export async function createPage(sideId: string, spec: any, { publish = true, ...opts }: Opts & { publish?: boolean } = {}) {
  const side = await own(M.Side, sideId, "side");
  const { name, ...rest } = spec;
  const p = enc(rest);
  return change("page.create", sideId, {}, enc(spec), async () => {
    const pid = String((await call("cpage", { base: BASE, side: sideId, ...p }))._id);
    if (name) await call("upage", { base: BASE, _id: pid, name });
    if (publish) await call("publishPage", { base: BASE, page: pid });
    await call("uside", { base: BASE, _id: sideId, pagesOrder: [...side.pagesOrder.map(String), pid] });
    return pid;
  }, (pid) => getPage(pid), opts);
}
export async function deletePage(id: string, opts?: Opts) {
  const page = await own(M.Page, id, "page");
  const side = await own(M.Side, String(page.side), "side");
  const header = tryParse(side.header) || {};
  const strip = (items: any[] = []): any[] => items.filter((i) => i.path !== id).map((i) => (i.children ? { ...i, children: strip(i.children) } : i));
  const sidePatch = {
    pagesOrder: side.pagesOrder.map(String).filter((x: string) => x !== id),
    ...(header.menuItems ? { header: JSON.stringify({ ...header, menuItems: strip(header.menuItems) }) } : {}),
  };
  return change("page.delete", id, { page }, { page: null }, async () => {
    await call("dpage", { base: BASE, page: id });
    await call("uside", { base: BASE, _id: String(side._id), ...sidePatch });
  }, async () => null, opts);
}

// ---------- expand templates ----------
export const getExpand = async (id: string) => parse(await own(M.ExpandTemplate, id, "expand template"));
export const listExpands = async (tableId: string) =>
  (await M.ExpandTemplate.find({ base: BASE, table: tableId }).sort({ order: 1 }).lean()).map(parse);
export async function createExpand(tableId: string, spec: any, opts?: Opts) {
  await own(M.Table, tableId, "table");
  await assertIds(M.Side, spec.sides, "side");
  const p = enc(spec);
  return change("expand.create", tableId, {}, p,
    async () => String((await call("cexpandtemplate", { baseId: BASE, tableId, ...p }))._id), (id) => getExpand(id), opts);
}
export async function updateExpand(id: string, patch: any, opts?: Opts) {
  const before = await own(M.ExpandTemplate, id, "expand template");
  if ("sideId" in patch || "template" in patch) throw new Error("pass sides/defaultSides, not sideId/template");
  await assertIds(M.Side, patch.sides, "side");
  await assertIds(M.Side, patch.defaultSides, "side");
  const p = enc(patch);
  return change("expand", id, before, p,
    () => call("uexpandtemplate", { tableId: String(before.table), template: id, ...p }), () => getExpand(id), opts);
}
export async function reorderExpands(tableId: string, ids: string[], opts?: Opts) {
  const before = { order: (await listExpands(tableId)).map((t: any) => t._id) };
  return change("expand.order", tableId, before, { order: ids },
    () => call("reorderExpandTemplates", { tableId, templateIds: ids }), () => listExpands(tableId), opts);
}

// ---------- automations ----------
async function ownAction(id: string) {
  const a = await M.Action.findById(id).lean();
  if (!a) throw new Error(`action ${id} not found`);
  await own(M.Automation, String(a.automation), "automation");
  return a;
}
export const getAction = async (id: string) => parse(await ownAction(id));
export async function getAutomation(id: string) {
  const a = await own(M.Automation, id, "automation");
  return { ...parse(a), actions: (await M.Action.find({ automation: id }).sort({ createdAt: 1 }).lean()).map(parse) };
}
export const listAutomations = async () =>
  Promise.all((await M.Automation.find({ base: BASE }).lean()).map((a: any) => getAutomation(String(a._id))));
async function assertCanActivate(automationId: string) {
  if (ALLOW_LIVE) return;
  const live = (await M.Action.find({ automation: automationId }).lean()).map((a: any) => a.type).filter(isLive);
  if (live.length) throw new Error(`activating ${automationId} would run ${live} against real providers; set ALLOW_LIVE=1 only with test providers`);
}
const assertNotBoth = (p: any) => {
  if ("conditions" in p && "fields" in p) throw new Error("Automation pre-save rebuilds `fields` from `conditions`: set them in separate calls");
};
export async function createAutomation(spec: any, opts?: Opts) {
  const { name, category, active, ...rest } = spec;
  if (active) throw new Error("create inactive, then activate with updateAutomation");
  assertNotBoth(rest);
  const p = enc(rest);
  return change("automation.create", BASE, {}, enc(spec), async () => {
    const id = String((await call("cautomation", { base: BASE, name, ...(category ? { category } : {}) }))._id);
    if (Object.keys(p).length) await call("uautomation", { _id: id, ...p });
    return id;
  }, (id) => getAutomation(id), opts);
}
export async function updateAutomation(id: string, patch: any, opts?: Opts) {
  const before = await own(M.Automation, id, "automation");
  assertNotBoth(patch);
  if (patch.active === true && !before.active) await assertCanActivate(id);
  const p = enc(patch);
  return change("automation", id, before, p, async () => {
    const a = await call("uautomation", { _id: id, ...p });
    if (a._errors?.length) throw new Error(`uautomation saved with errors: ${a._errors.join("; ")}`);
  }, () => getAutomation(id), opts);
}
// dautomation also deletes the automation's actions and its Bull jobs. changes.log keeps the whole automation
// (actions included, secrets redacted); the raw copy for a restore is the snapshots-private backup taken first.
export async function deleteAutomation(id: string, opts?: Opts) {
  const before = await getAutomation(id);
  if (before.active) throw new Error(`automation ${id} is active: deactivate it before deleting`);
  return change("automation.delete", id, { automation: before }, { automation: null },
    () => call("dautomation", { _id: id }), async () => null, opts);
}
export async function createAction(automationId: string, spec: any, opts?: Opts) {
  const auto = await own(M.Automation, automationId, "automation");
  if (auto.active && isLive(spec.type) && !ALLOW_LIVE) throw new Error("adding an external action to an active automation; set ALLOW_LIVE=1");
  const p = enc(spec);
  return change("action.create", automationId, {}, p, async () => {
    const id = String((await call("caction", { base: BASE, automation: automationId }))._id);
    await call("uaction", { _id: id, ...p });
    return id;
  }, (id) => getAction(id), opts);
}
export async function updateAction(id: string, patch: any, opts?: Opts) {
  const before = await ownAction(id);
  const auto = await M.Automation.findById(before.automation).lean();
  if (auto.active && patch.type && patch.type !== before.type && isLive(patch.type) && !ALLOW_LIVE) {
    throw new Error("switching an action of an active automation to an external type; set ALLOW_LIVE=1");
  }
  const p = enc(patch);
  return change("action", id, before, p, () => call("uaction", { _id: id, ...p }), () => getAction(id), opts);
}

// ---------- user roles & record roles ----------
export const getUserRole = async (id: string) => parse(await own(M.UserRole, id, "userrole"));
export const listUserRoles = async () => (await M.UserRole.find({ base: BASE }).lean()).map(parse);
export async function createUserRole(spec: any, opts?: Opts) {
  return change("userrole.create", BASE, {}, spec,
    async () => String((await call("cuserrole", { base: BASE, ...spec })).message), (id) => getUserRole(id), opts);
}
export async function updateUserRole(id: string, patch: any, opts?: Opts) {
  const before = await own(M.UserRole, id, "userrole");
  return change("userrole", id, before, patch, () => call("uuserrole", { userrole: id, ...patch }), () => getUserRole(id), opts);
}
export const getRecordRole = async (id: string) => parse(await own(M.RecordRole, id, "recordrole"));
export const listRecordRoles = async () => (await M.RecordRole.find({ base: BASE }).lean()).map(parse);
export async function createRecordRole(tableId: string, spec: any, opts?: Opts) {
  await own(M.Table, tableId, "table");
  await assertIds(M.Field, spec.canedit, "field");
  await assertIds(M.Table, spec.canadd, "table");
  const p = enc(spec);
  return change("recordrole.create", tableId, {}, p,
    async () => String((await call("crecordrole", { base: BASE, table: tableId, ...p }))._id), (id) => getRecordRole(id), opts);
}
export async function updateRecordRole(id: string, patch: any, opts?: Opts) {
  const before = await own(M.RecordRole, id, "recordrole");
  await assertIds(M.Field, patch.canedit, "field");
  await assertIds(M.Table, patch.canadd, "table");
  const p = enc(patch);
  return change("recordrole", id, before, p, () => call("urecordrole", { _id: id, ...p }), () => getRecordRole(id), opts);
}

// ---------- records ----------
export const countRecords = async (tableId: string) => Number((await master.runQuery(BASE,
  `search index=main base=${BASE} table=${tableId} | dedup id | search NOT status="_deleted_record" | stats count as n`))[0]?.n ?? 0);
export async function listRecords(tableId: string, where = "") {
  await own(M.Table, tableId, "table");
  const spl = `search index=main base=${BASE} table=${tableId} ${where} | dedup id | search NOT status="_deleted_record" | fields _raw`;
  return (await master.runQuery(BASE, spl)).map((r: any) => JSON.parse(r._raw));
}
export async function getRecord(tableId: string, id: string) {
  const r = await readRecord(BASE, id);
  if (!r || String(r.table) !== String(tableId) || r.status === "_deleted_record") throw new Error(`record ${id} not in table ${tableId}`);
  return r;
}
export async function createRecord(viewId: string, init: any, opts?: Opts) {
  const v = await own(M.View, viewId, "view");
  await assertQuiet(String(v.table));
  return change("record.create", viewId, {}, init,
    async () => JSON.parse(await call("crecord", { view: viewId, init: JSON.stringify(init) })).id,
    (id) => getRecord(String(v.table), id), opts);
}
export async function updateRecord(tableId: string, id: string, values: any, opts?: Opts) {
  await assertQuiet(tableId);
  const before = await getRecord(tableId, id);
  const keys = Object.keys(values);
  const rec = { base: BASE, table: tableId, id, ...values, ...(keys.length === 1 ? { modifiedfield: keys[0] } : {}) };
  return change("record", id, before, values, () => call("updateCell", { rec: JSON.stringify(rec) }), () => getRecord(tableId, id), opts);
}
// ponytail: one SPL `id IN (...)` per call; chunk the rows yourself above ~500.
export async function bulkUpsert(tableId: string, rows: any[], opts?: Opts) {
  const ids = rows.filter((r) => r.id).map((r) => r.id);
  const before = ids.length ? await listRecords(tableId, `id IN (${ids.join(",")})`) : [];
  if (before.length !== new Set(ids).size) throw new Error("bulkUpsert: some update ids do not exist in this table");
  const values = rows.map((r) => (r.id ? r : { ...r, id: randomUUID() }));
  const all = values.map((r) => r.id);
  return change("records.upsert", tableId, { rows: before }, { rows: values },
    () => call("urecords", { table: tableId, values: JSON.stringify(values) }), async () => {
      for (let i = 0; i < 15; i++) {
        const got = await listRecords(tableId, `id IN (${all.join(",")})`);
        if (got.length === all.length) return got;
        await new Promise((r) => setTimeout(r, 1000));
      }
      console.warn(`bulkUpsert: not all ${all.length} rows searchable yet; ids: ${all}`);
      return values;
    }, opts);
}
export async function deleteRecords(tableId: string, ids: string[], opts?: Opts) {
  await assertQuiet(tableId);
  const before = await listRecords(tableId, `id IN (${ids.join(",")})`);
  if (before.length !== new Set(ids).size) throw new Error("deleteRecords: some ids not found (drecords would crash on them)");
  return change("records.delete", tableId, { records: before }, { records: null },
    () => call("drecords", { table: tableId, ids }), async () => null, opts);
}

// ---------- uploads (logo, covers, backgrounds) ----------
// Same function the `upload` GraphQL mutation runs; returns the storage key that IMAGE/MENU/header/brandField values need.
export async function uploadFile(path: string, mimetype: string, extra: { sideId?: string; tableId?: string; recordId?: string } = {}) {
  const filename = path.split("/").pop()!;
  const line: any = { ts: new Date().toISOString(), kind: "upload", id: filename, diff: {} };
  if (DRY) { console.log("DRY " + JSON.stringify(line)); return `DRY/${filename}`; }
  const { uploadBase64 } = require(`${APP}/src/modules/database/resolvers/crud/utils`);
  try {
    const r = await uploadBase64({ baseId: BASE, filename, mimetype, base64: fs.readFileSync(path).toString("base64"), ...extra });
    line.created = r.key;
    return r.key as string;
  } catch (e: any) { line.error = e?.message; throw e; }
  finally { fs.appendFileSync(LOG, JSON.stringify(line) + "\n"); }
}

// ---------- demo data: raw export, mock seed, raw restore, raw tombstone (references/demo-data.md) ----------
export const MOCK_MANIFEST = `${__dirname}/mock-manifest.json`;
// Link targets mock rows may point at although they are real (reference tables kept during the demo), from project.json.
const KEEP_LINK_TABLES = new Set<string>(((P as any).keepLinkTables ?? []).map(String));
const TOMBSTONE = "_deleted_record";
const md5_28 = (s: string) => parseInt(require("crypto").createHash("md5").update(s, "utf8").digest("hex").slice(0, 7), 16);
const withoutGid = (raw: string) => raw.replace(/"gid":"[^"]+"/g, "");
// Mock rows seeded with uuid ids (round 3): a link filter «has any of [id]» only compares _id when the id is
// uuid-shaped, otherwise it compares primaryFieldValue, so readable MOCK- ids broke every record-context list.
// The MOCK-id → uuid map is the proof that a uuid row is mock data.
export const MOCK_IDMAP = `${__dirname}/mock-idmap.json`;
const mockUuids = (): Set<string> => { try { return new Set(Object.values(JSON.parse(fs.readFileSync(MOCK_IDMAP, "utf8")))); } catch { return new Set(); } };
const isMock = (id: string, uuids = mockUuids()) => String(id).startsWith("MOCK-") || uuids.has(String(id));

async function assertNoActiveAutomation() {
  const n = await M.Automation.countDocuments({ base: BASE, active: true });
  if (n) throw new Error(`${n} active automation(s) in the base: record writes are frozen`);
}

export async function exportRecords(tableId: string, where = ""): Promise<string[]> {
  await own(M.Table, tableId, "table");
  const q = `search index=main base=${BASE} table=${tableId} ${where}`;
  const raws: string[] = (await master.runQuery(BASE, `${q} | dedup id | fields _raw`)).map((r: any) => r._raw);
  const [{ n = 0 } = {}] = await master.runQuery(BASE, `${q} | stats dc(id) as n`);
  if (raws.length !== Number(n)) throw new Error(`exportRecords ${tableId}: ${raws.length} rows but ${n} distinct ids`);
  return raws;
}

export function checksum(raws: string[]) {
  return { count: raws.length, sum: raws.reduce((a, r) => a + md5_28(r), 0), sumNoGid: raws.reduce((a, r) => a + md5_28(withoutGid(r)), 0) };
}

export async function serverChecksum(tableId: string, where = "") {
  await own(M.Table, tableId, "table");
  const [s = {}] = await master.runQuery(BASE, `search index=main base=${BASE} table=${tableId} ${where} | dedup id | search NOT status="${TOMBSTONE}"`
    + ` | eval h=tonumber(substr(md5(_raw),1,7),16), r=replace(_raw, "\\"gid\\":\\"[^\\"]+\\"", ""), g=tonumber(substr(md5(r),1,7),16)`
    + ` | stats count sum(h) as s sum(g) as sg`);
  return { count: Number(s.count ?? 0), sum: Math.round(Number(s.s ?? 0)), sumNoGid: Math.round(Number(s.sg ?? 0)) };
}

const linkIds = (v: any): string[] => [].concat(v ?? []).map((l: any) => String(l?._id ?? l));

export async function seedRows(tableId: string, rows: any[]) {
  await own(M.Table, tableId, "table");
  await assertNoActiveAutomation();
  const ids = rows.map((r) => String(r.id ?? ""));
  const uuids = mockUuids();
  if (ids.some((id) => !isMock(id, uuids))) throw new Error("seedRows: every row needs a MOCK- id or a uuid from mock-idmap.json");
  if (new Set(ids).size !== ids.length) throw new Error("seedRows: duplicate ids");
  const links = await M.Field.find({ base: BASE, table: tableId, type: "records" }).lean();
  for (const f of links) {
    if (KEEP_LINK_TABLES.has(String(f.linkedTable))) continue;
    const real = rows.flatMap((r) => linkIds(r[String(f._id)])).filter((id) => !isMock(id, uuids));
    if (real.length) throw new Error(`seedRows: field ${f.name} links to non-MOCK ids ${real}`);
  }
  const line: any = { ts: new Date().toISOString(), kind: "records.seed", id: tableId, diff: { rows: { from: null, to: rows } }, created: ids.join(",") };
  if (DRY) { console.log("DRY " + redact(line)); return rows; }
  let manifest: any = {};
  try { manifest = JSON.parse(fs.readFileSync(MOCK_MANIFEST, "utf8")); } catch { /* first seed */ }
  const known = new Set((manifest.rows ?? []).map((r: any) => r.id));
  manifest.rows = [...(manifest.rows ?? []), ...ids.filter((id) => !known.has(id)).map((id) => ({ id, table: tableId }))];
  fs.writeFileSync(MOCK_MANIFEST, JSON.stringify(manifest, null, 1));
  try { await call("urecords", { table: tableId, values: JSON.stringify(rows) }); }
  catch (e: any) { line.error = e?.message; throw e; }
  finally { fs.appendFileSync(LOG, redact(line) + "\n"); }
  for (let i = 0; i < 15; i++) {
    const got = await listRecords(tableId, `id IN (${ids.join(",")})`);
    if (got.length === ids.length) return got;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn(`seedRows: not all ${ids.length} rows searchable yet`);
  return rows;
}

let restoreGuardInstalled = false;
function installRestoreCrashGuard() {
  if (restoreGuardInstalled) return;
  restoreGuardInstalled = true;
  process.on("unhandledRejection", (e: any) => {
    fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), kind: "records.restore", error: `unhandledRejection: ${e?.message ?? e}` }) + "\n");
    console.error("unhandledRejection during restore (history write?):", e?.message ?? e, "— re-run the restore; it is idempotent");
  });
}

export async function restoreRaw(tableId: string, raws: string[], opts: Opts & { allowMock?: boolean } = {}) {
  installRestoreCrashGuard();
  await own(M.Table, tableId, "table");
  await assertNoActiveAutomation();
  const evs = raws.map((r) => JSON.parse(r));
  const foreign = evs.filter((e) => e.base !== BASE || e.table !== tableId || !e.id || e.status === TOMBSTONE);
  if (foreign.length) throw new Error(`restoreRaw: ${foreign.length} event(s) from another base or table, without id, or tombstones`);
  if (new Set(evs.map((e) => e.id)).size !== evs.length) throw new Error("restoreRaw: duplicate ids");
  const lossy = raws.filter((r) => JSON.stringify(JSON.parse(r)) !== r).length;
  if (lossy && !opts.force) throw new Error(`restoreRaw: ${lossy} event(s) would not re-serialize byte-identically`);
  const mock = evs.filter((e) => String(e.id).startsWith("MOCK-")).length;
  if (mock && !opts.allowMock) throw new Error(`restoreRaw: ${mock} MOCK- id(s); pass allowMock for the round-trip rehearsal only`);
  const noGid = evs.filter((e) => typeof e.gid !== "string" || !e.gid).length;
  if (noGid) throw new Error(`restoreRaw: ${noGid} event(s) without gid`);
  if (!opts.force) {
    const exported = new Map(evs.map((e) => [e.id, Number(e.modifiedtime)]));
    const newer: string[] = [];
    for (let i = 0; i < evs.length; i += 500) {
      const live = await listRecords(tableId, `id IN (${evs.slice(i, i + 500).map((e) => e.id).join(",")})`);
      newer.push(...live.filter((l: any) => Number(l.modifiedtime) > exported.get(l.id)!).map((l: any) => l.id));
    }
    if (newer.length) throw new Error(`restoreRaw: ${newer.length} id(s) changed after the export: ${newer}`);
  }
  evs.sort((a, b) => Number(a.modifiedtime) - Number(b.modifiedtime));
  const size = Math.ceil(evs.length / Math.ceil(evs.length / 500));
  for (let i = 0; i < evs.length; i += size) {
    const chunk = evs.slice(i, i + size);
    const line: any = { ts: new Date().toISOString(), kind: "records.restore", id: tableId, count: chunk.length, ids: chunk.map((e) => e.id) };
    if (DRY) { console.log("DRY " + redact(line)); continue; }
    try {
      const res = await master.runMutation(BASE, chunk.map((event) => ({ index: "main", event })));
      if (res?.data?.code !== 0) throw new Error(`HEC answered ${JSON.stringify(res?.data)}`);
    } catch (e: any) { line.error = e?.message; throw e; }
    finally { fs.appendFileSync(LOG, redact(line) + "\n"); }
  }
  return evs.length;
}


// Soft-deletes rows by re-posting drecords' tombstone shape through runMutation, WITHOUT the notify effects.
// drecords' delayed link/rollup effects rewrite already-deleted rows as live (observed in gate G2: children revived
// after their parent was deleted, parents revived by children's rollups), so mass deletion must not go through it.
// Use only when every row that links to these rows is being deleted too (or is kept and may show stale rollups).
export async function tombstoneRaw(tableId: string, ids: string[], opts: { allowReal?: boolean } = {}) {
  await own(M.Table, tableId, "table");
  await assertNoActiveAutomation();
  installRestoreCrashGuard();
  const uuids = mockUuids();
  const real = ids.filter((id) => !isMock(id, uuids));
  if (real.length && !opts.allowReal) throw new Error(`tombstoneRaw: ${real.length} non-MOCK id(s); pass allowReal only in the approved deletion phase`);
  let done = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const live = await listRecords(tableId, `id IN (${slice.join(",")})`);
    if (!live.length) continue;
    const events = live.map((r: any) => ({ index: "main", event: { id: r.id, gid: r.gid, base: BASE, table: tableId, createdtime: r.createdtime, status: TOMBSTONE } }));
    const line: any = { ts: new Date().toISOString(), kind: "records.tombstone", id: tableId, count: events.length, ids: live.map((r: any) => r.id) };
    if (DRY) { console.log("DRY " + redact(line)); continue; }
    try {
      const res = await master.runMutation(BASE, events);
      if (res?.data?.code !== 0) throw new Error(`HEC answered ${JSON.stringify(res?.data)}`);
      done += events.length;
    } catch (e: any) { line.error = e?.message; throw e; }
    finally { fs.appendFileSync(LOG, redact(line) + "\n"); }
  }
  return done;
}
