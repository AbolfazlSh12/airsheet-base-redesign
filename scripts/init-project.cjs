// Rebuild build/project.json from a structural dump (dump-base.cjs output) when the original build folder is lost.
// Usage: node init-project.cjs <dump.json> <out project.json> [frontend=http://localhost:9003] [backend=<cloud-back path>]
// The owner id is base.owner (= creator) in the dump; test-account passwords never go here (.accounts.json, chmod 600).
const fs = require('fs');
const [dump, out, frontend = 'http://localhost:9003', backend] = process.argv.slice(2);
if (!dump || !out) { console.error('usage: node init-project.cjs <dump.json> <out project.json> [frontend] [backend]'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(dump, 'utf8'));
if (!d.base?.id || !d.base?.owner) { console.error('dump has no base.id/base.owner: re-run dump-base.cjs (owner was added 2026-10-14)'); process.exit(1); }
const p = { base: d.base.id, owner: d.base.owner, frontend, ...(backend ? { backend } : {}) };
if (fs.existsSync(out)) { const old = JSON.parse(fs.readFileSync(out, 'utf8')); Object.assign(p, old, { base: p.base, owner: old.owner || p.owner }); }
fs.writeFileSync(out, JSON.stringify(p) + '\n');
console.log('wrote', out, Object.keys(p).join(','));
