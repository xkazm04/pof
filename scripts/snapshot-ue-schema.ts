/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Snapshot the UE project's table-row and data-asset shapes → src/lib/catalog/ue-schema.generated.json (/diablo W10, D6).
 * One parser (`parseUeTypes`) shared with the tests. A missing UE root is a REFUSAL — the old script wrote `{}` and
 * reported success, and the snapshot stayed empty for four months.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseUeTypes, type UeSchema } from '../src/lib/catalog/ue-schema';

const root = process.env.POF_UE_ROOT || 'C:/Users/kazda/Documents/Unreal Projects/PoF';
const src = join(root, 'Source');
if (!existsSync(src)) { console.error(`REFUSED: no UE Source at ${src} — set POF_UE_ROOT; the snapshot is left unchanged`); process.exit(1); }
const walk = (d: string, out: string[] = []): string[] => {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (n.endsWith('.h')) out.push(p); }
  return out;
};
const schema: UeSchema = {};
for (const f of walk(src)) Object.assign(schema, parseUeTypes(readFileSync(f, 'utf8')));
const sorted = Object.fromEntries(Object.keys(schema).sort().map((k) => [k, schema[k]]));
writeFileSync(resolve('src/lib/catalog/ue-schema.generated.json'), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`snapshot-ue-schema: ${Object.keys(sorted).length} type(s), ${Object.values(sorted).reduce((n, f) => n + f.length, 0)} field(s) → ue-schema.generated.json`);
