// Read-only Splunk search through the app's own client. Run from cloud-back: npx tsx splunk-query.ts '<spl>' [out.json]
// e.g. 'search index=main base="<id>" | dedup id | search NOT status="_deleted_record" | stats count by table'
const APP = process.env.AIRSHEET_BACKEND ?? process.cwd();
require(`${APP}/node_modules/bull`).prototype.process = async () => {};
const m = require(`${APP}/src/modules/database/master`);
const master = m.default ?? m;
(async () => {
  const r: any = await master.runQuery("", process.argv[2]);
  require("fs").writeFileSync(process.argv[3] || "/dev/stdout", JSON.stringify(r));
  process.exit(0);
})().catch((e) => { console.error("ERR", e?.message); process.exit(1); });
