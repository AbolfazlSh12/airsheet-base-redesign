// Read-only smoke test of lib.ts and project.json. Run from cloud-back: DRY=1 npx tsx <work>/build/smoke-read.ts
import * as L from "./lib";
L.run(async () => {
  const b = await L.getBase();
  const tables = await L.listTables();
  const sides = await L.listSides();
  const autos = await L.M.Automation.countDocuments({ base: L.BASE, active: true });
  console.log(`base «${b.name}» | ${tables.length} tables | sides: ${sides.map((s: any) => `${s.name} (${s.type})`).join(", ")} | active automations: ${autos} | tokens hidden: ${!("tokens" in b)} | log: ${L.LOG}`);
});
