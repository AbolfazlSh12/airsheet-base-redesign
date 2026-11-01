// upload-backgrounds.ts — page and SECTION backgrounds written as inline `data:` SVG URIs become
// uploaded files, the only form the background controls write (cloud-front BackgroundSettings / SectionBlock: an
// upload stored as `${S3}/${bucket_prefix}uploads/<key>`). Each distinct image is uploaded once; the key map in
// data/ui-audit/uploaded-backgrounds.json keeps re-runs from uploading again. Every URL is fetched before a page
// points at it. Images inside TEXT html are left alone (the text editor keeps pasted images inline). DRY=1.
// Env: S3_PUBLIC = the frontend's VUE_APP_S3 (window.configs of the served index.html), BUCKET_PREFIX = config
// system.setting.bucket_prefix.
import * as L from "./lib";
import * as fs from "fs";
import * as crypto from "crypto";

const DRY = process.env.DRY === "1";
const S3 = (process.env.S3_PUBLIC || "").replace(/\/$/, "");
const DIR = `${__dirname}/../data/ui-audit`;
const MAP = `${DIR}/uploaded-backgrounds.json`;

L.run(async () => {
  if (!S3) throw new Error("S3_PUBLIC is not set");
  const prefix = process.env.BUCKET_PREFIX;
  if (prefix == null) throw new Error("BUCKET_PREFIX is not set (config key system.setting.bucket_prefix)");
  const map: Record<string, string> = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, "utf8")) : {};
  const urlOf = async (uri: string) => {
    const sha = crypto.createHash("sha1").update(uri).digest("hex").slice(0, 16);
    if (map[sha]) return map[sha];
    const m = uri.match(/^data:image\/svg\+xml(;base64)?,(.*)$/s);
    if (!m) throw new Error(`not an svg data uri: ${uri.slice(0, 40)}`);
    const svg = m[1] ? Buffer.from(m[2], "base64").toString("utf8") : decodeURIComponent(m[2]);
    fs.mkdirSync(`${DIR}/assets`, { recursive: true });
    const file = `${DIR}/assets/bg-${sha}.svg`;
    fs.writeFileSync(file, svg);
    const key = await L.uploadFile(file, "image/svg+xml");
    if (DRY) return `DRY:${sha}`;
    const url = `${S3}/${prefix}uploads/${key}`;
    const res = await fetch(url);
    if (!res.ok || !String(res.headers.get("content-type")).includes("svg")) throw new Error(`uploaded ${sha} is not served: ${res.status} ${res.headers.get("content-type")}`);
    map[sha] = url;
    fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
    return url;
  };
  const fixBlocks = async (bs: any[]): Promise<any[]> => {
    const out = [];
    for (const b0 of bs || []) {
      const b = { ...b0 };
      if (typeof b.backgroundImage === "string" && b.backgroundImage.startsWith("data:")) b.backgroundImage = await urlOf(b.backgroundImage);
      for (const k of ["section", "column1", "column2", "column3", "column4"]) if (b[k]?.content) b[k] = { ...b[k], content: { ...b[k].content, blocks: await fixBlocks(b[k].content.blocks) } };
      if (b.type === "TABS" && Array.isArray(b.details)) b.details = await Promise.all(b.details.map(async (t: any) => ({ ...t, content: { ...t.content, blocks: await fixBlocks(t.content?.blocks) } })));
      out.push(b);
    }
    return out;
  };
  const fixDoc = async (d: any) => {
    const n = { ...d, blocks: await fixBlocks(d.blocks) };
    if (typeof n.background?.value === "string" && n.background.value.startsWith("data:")) n.background = { ...n.background, value: await urlOf(n.background.value) };
    return n;
  };
  for (const s of await L.listSides()) for (const p of await L.listPages(s._id)) {
    if (!p.content?.blocks) continue;
    const c = await fixDoc(p.content);
    if (JSON.stringify(c) !== JSON.stringify(p.content)) await L.updatePage(String(p._id), { content: c });
  }
  for (const t of await L.listTables()) for (const e of await L.listExpands(t._id)) {
    if (!e.layout?.blocks) continue;
    const l = await fixDoc(e.layout);
    if (JSON.stringify(l) !== JSON.stringify(e.layout)) await L.updateExpand(String(e._id), { layout: l });
  }
  console.log(DRY ? "DRY done" : "done", Object.keys(map).length, "images");
});
