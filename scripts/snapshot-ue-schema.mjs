import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.POF_UE_ROOT || 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'lib', 'catalog', 'ue-schema.generated.json');
const structRe = /struct\s+(\w*Row\w*|F\w*Def)\s*:\s*public\s+FTableRowBase\s*\{([\s\S]*?)\n\}/g;
function walk(d, out = []) { if (!existsSync(d)) return out; for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : n.endsWith('.h') && out.push(p); } return out; }
const schema = {};
if (existsSync(root)) for (const f of walk(join(root, 'Source'))) { const s = readFileSync(f, 'utf8'); let m; while ((m = structRe.exec(s))) schema[m[1]] = [...m[2].matchAll(/UPROPERTY\([^)]*\)\s*\n?\s*[\w:<>*\s]+?\s+(\w+)\s*;/g)].map((x) => x[1]); }
writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n');
console.log(`snapshot-ue-schema: ${Object.keys(schema).length} struct(s) → ue-schema.generated.json`);
