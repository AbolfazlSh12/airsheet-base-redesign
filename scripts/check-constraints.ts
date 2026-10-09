// Read-only proof that every table constraint of the base works: for each rule, a copy of an existing row (same values
// on the rule's fields, unique values on the other rules' fields) must be REJECTED, and a copy with fresh values on the
// rule's fields must be ACCEPTED. Runs the server's own constraint.check; nothing is written.
// Run from cloud-back: npx tsx <work>/build/check-constraints.ts
import * as L from "./lib";
const APP = process.env.AIRSHEET_BACKEND || process.cwd();
const constraint = (() => { const m = require(`${APP}/src/modules/database/resolvers/crud/constraint`); return m.default ?? m; })();

const dynFields = (nodes: any[]): string[] => (nodes || []).flatMap((n: any) => n?.filter?.children ? dynFields(n.filter.children)
  : n?.filter?.operandType === "field" || (typeof n?.filter?.operand === "string" && /^[0-9a-f]{24}$/.test(n.filter.operand)) ? [String(n.filter.operand)] : []);
const fresh = (v: any) => (Array.isArray(v) ? [{ _id: "00000000-0000-4000-a000-000000000000", primaryFieldValue: "ZZ-none" }] : `ZZ-${Date.now()}-${Math.random()}`);

L.run(async () => {
  let bad = 0, n = 0;
  for (const t of await L.listTables()) {
    const rules = (t.constraints ?? []).filter((c: any) => c.active !== false);
    if (!rules.length) continue;
    const rows = await L.listRecords(String(t._id));
    for (const rule of rules) {
      const keys = dynFields(rule.filters);
      const others = rules.filter((r: any) => r !== rule).flatMap((r: any) => dynFields(r.filters)).filter((k: string) => !keys.includes(k));
      const src = rows.find((r: any) => keys.every((k) => r[k] !== undefined && r[k] !== "" && !(Array.isArray(r[k]) && !r[k].length)));
      if (!src) { console.log(`SKIP ${t.name} «${rule.name}»: no row with all rule fields filled`); continue; }
      n++;
      const dup: any = { ...src, changes: keys.map((field) => ({ field })) }; delete dup.id;
      for (const k of others) dup[k] = fresh(dup[k]);
      const uniq: any = { ...dup }; for (const k of keys) uniq[k] = fresh(uniq[k]);
      const r1 = await constraint.check(String(L.OWNER), String(t.base), String(t._id), [dup], { operations: ["create"] });
      const r2 = await constraint.check(String(L.OWNER), String(t.base), String(t._id), [uniq], { operations: ["create"] });
      const ok = r1 !== "success" && r2 === "success";
      if (!ok) bad++;
      console.log(`${ok ? "OK  " : "BAD "} ${t.name} «${rule.name}»: duplicate ${r1 !== "success" ? "rejected" : "ACCEPTED"}, fresh ${r2 === "success" ? "accepted" : "REJECTED"}`);
    }
  }
  console.log(bad ? `${bad} of ${n} rules do not work` : `all ${n} rules work`);
  if (bad) process.exitCode = 1;
});
