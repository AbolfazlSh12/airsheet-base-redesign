/* Attach the customer's photos to records: one image per row, mapped BY NAME (never by row order), uploaded once.
   Usage (from the cloud-back checkout, project.json next to lib.ts):
     DRY=1 npx tsx build/attach-images.ts <tableId> <imageFieldId> <nameFieldId> <mapping.json> <dir>
   mapping.json = {"<record name>": "<file in dir>", …}; names are compared after stripping ZWNJ and spaces.
   Keys are cached in <dir>/../keys.json (never a DRY key). A row whose single cover already is that key is skipped,
   so the script is idempotent; an unmapped name, a file mapped twice, or a missing file stops it before any write.
   See references/asset-pipeline.md for sizes (≤ 1200 px, ≈ 100–250 KB JPEG) and the attachment shape. */
import * as L from "./lib";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
const [table, imgField, nameField, mapFile, dir] = process.argv.slice(2);
if (!dir) { console.error("usage: attach-images.ts <tableId> <imageFieldId> <nameFieldId> <mapping.json> <dir>"); process.exit(1); }
const KEYS = path.join(dir, "..", "keys.json");
const norm = (s: string) => String(s ?? "").replace(/[‌‏\s]/g, "");
const MAP: Record<string, string> = JSON.parse(fs.readFileSync(mapFile, "utf8"));
const BY_NORM = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [norm(k), v]));
const mime = (f: string) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");
L.run(async () => {
  const keys: Record<string, string> = fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, "utf8")) : {};
  const rows = await L.listRecords(table);
  const seen = new Set<string>();
  let changed = 0, same = 0;
  for (const r of rows) {
    const name = String(r[nameField] ?? "");
    const file = BY_NORM[norm(name)];
    if (!file) throw new Error(`no photo mapped for «${name}» (${r.id})`);
    if (seen.has(file)) throw new Error(`photo ${file} mapped twice`);
    seen.add(file);
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
    let key = keys[file];
    if (!key) {
      key = await L.uploadFile(p, mime(file), { tableId: table, recordId: r.id });
      if (!key.startsWith("DRY/")) { keys[file] = key; fs.writeFileSync(KEYS, JSON.stringify(keys, null, 1)); }
    }
    const cur = Array.isArray(r[imgField]) ? r[imgField] : [];
    if (cur.length === 1 && cur[0]?.key === key) { same++; continue; }
    const size = fs.statSync(p).size;
    await L.updateRecord(table, r.id, { [imgField]: [{ id: randomUUID(), key, url: key, mimetype: mime(file), filename: file, size, fileSize: size, preview: true, type: path.extname(file).slice(1).toLowerCase(), thumbnails: { large: { url: key } } }] });
    changed++;
  }
  if (seen.size !== Object.keys(MAP).length) console.warn(`mapping has ${Object.keys(MAP).length} entries, table has ${seen.size} matching rows`);
  console.log(`${process.env.DRY === "1" ? "DRY " : ""}${changed} covers ${process.env.DRY === "1" ? "would change" : "changed"}, ${same} already current`);
});
