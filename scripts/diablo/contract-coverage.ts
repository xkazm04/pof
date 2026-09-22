/**
 * Contract-declaration coverage (/diablo W03, D12): per catalog, how many steps GRADE a wiring
 * contract (their checker tags a `wiringContract` field) and how many of those DECLARE one
 * (`StepSpec.contract`). An undeclared step's prompt carries no contract guidance at all.
 *
 *   npx tsx scripts/diablo/contract-coverage.ts                 # every catalog
 *   npx tsx scripts/diablo/contract-coverage.ts --require a,b   # exit 1 unless a and b are fully declared
 */
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';

const req = process.argv.includes('--require')
  ? process.argv[process.argv.indexOf('--require') + 1].split(',').map((s) => s.trim())
  : null;
let bad = 0;
let graded = 0;
let declared = 0;
for (const p of allCatalogPipelines()) {
  const missing: string[] = [];
  let g = 0;
  for (const s of p.steps) {
    if (!requiredFieldsOf(s.accept).some((r) => r.field.endsWith('wiringContract'))) continue;
    g++;
    if (!s.contract) missing.push(s.label);
  }
  if (!g) continue;
  graded += g;
  declared += g - missing.length;
  const line = `${p.catalogId.padEnd(22)} ${g - missing.length}/${g}${missing.length ? `  undeclared: ${missing.join(' · ')}` : ''}`;
  if (!req || req.includes(p.catalogId)) process.stdout.write(`${line}\n`);
  if (req?.includes(p.catalogId) && missing.length) bad++;
}
process.stdout.write(`total ${declared}/${graded} declared\n`);
if (req) {
  const unknown = req.filter((c) => !allCatalogPipelines().some((p) => p.catalogId === c));
  if (unknown.length) { process.stdout.write(`unknown catalog(s): ${unknown.join(', ')}\n`); process.exit(1); }
  if (bad) process.exit(1);
}
