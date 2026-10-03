// Read-only: how many rows each view returns for real portal users and for an anonymous visitor, evaluated the way
// searchAPI / sharedStats evaluate it (filterExpression + Splunk). Proves a portal filter really scopes rows: the query
// builder silently DROPS a condition it cannot compile for a field type, and the view then returns every row.
// Run from cloud-back:  AS=0999xxxxxx1,0999xxxxxx2,anon npx tsx <work>/build/view-count-as.ts <viewId> [...]
// Prints counts only, never record values.
import * as L from "./lib";
const APP = process.env.AIRSHEET_BACKEND ?? process.cwd();
const { filterExpression } = require(`${APP}/src/modules/database/query.js`);
const mongoose = require(`${APP}/node_modules/mongoose`);
L.run(async () => {
  const who = (process.env.AS || "anon").split(",");
  const users = await mongoose.connection.collection("users").find({ mobile: { $in: who } }).project({ mobile: 1 }).toArray();
  const uid = (m: string) => (m === "anon" ? undefined : users.find((u: any) => u.mobile === m)?._id);
  for (const m of who) if (m !== "anon" && !uid(m)) throw new Error(`no user with mobile ${m}`);
  for (const id of process.argv.slice(2)) {
    const v = await L.getView(id);
    const counts: string[] = [];
    for (const m of who) {
      const f = await filterExpression(JSON.stringify(v.filters || []), L.BASE, uid(m));
      const n = (await L.listRecords(v.table, `| dedup id ${f.before} | search NOT status="_deleted_record" | search table="*" ${f.expression} ${f.after}`)).length;
      counts.push(`${m}=${n}`);
    }
    const all = (await L.listRecords(v.table)).length;
    console.log(`«${v.name}» ${id} [${v.type}] ${counts.join(" ")} | table total=${all}${counts.some((c) => c.endsWith(`=${all}`)) && all > 1 ? "  <- REVIEW: a scoped view returns the whole table" : ""}`);
  }
});
