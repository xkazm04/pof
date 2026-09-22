/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Legacy-RPG ingest DRY RUN — reads a local checkout of a reverse-engineering project's
 * data tables and reports what PoF could hold, what it would drop, and what it has no
 * place for. Writes nothing: no database, no files.
 *
 *   npx tsx scripts/research/ingest-dry-run.ts <path-to>/assets/txtdata
 *
 * The path is supplied by the operator because this repo deliberately does not carry the
 * ingested values (see the licence note in `src/lib/catalog/ingest/diablo1.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TARGET_GAPS, provenanceFor } from '../../src/lib/catalog/ingest/diablo1';
import { DIABLO1 } from '../../src/lib/catalog/reference/sources';
import { ingestTable, type TableIngestResult } from '../../src/lib/catalog/ingest/run';

const root = process.argv[2];
if (!root) {
  console.error('usage: ingest-dry-run.ts <path to assets/txtdata>');
  process.exit(2);
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const results: TableIngestResult[] = [];

for (const table of DIABLO1.tables) {
  let text: string;
  try {
    text = readFileSync(join(root, table.file), 'utf8');
  } catch {
    console.error(`SKIP ${table.file} — not found under ${root}`);
    continue;
  }
  results.push(ingestTable(text, {
    catalogId: table.catalogId,
    sourceFile: table.file,
    keyColumn: table.keyColumn,
    map: table.map,
    provenanceFor,
    idPrefix: 'd1',
  }));
}

console.log('\n=== INGEST DRY RUN — nothing was written ===\n');

for (const r of results) {
  const a = r.audit;
  console.log(`## ${r.catalogId}  ←  ${r.sourceFile}`);
  console.log(`   entities produced : ${r.entities.length}`);
  console.log(`   malformed rows    : ${r.malformed.length}${r.malformed.length ? '  <-- INVESTIGATE' : ''}`);
  console.log(`   positional ids    : ${r.positionalIds}${r.positionalIds ? '  <-- identity is row ORDER, not a column' : ''}`);
  console.log(`   colliding keys    : ${r.duplicateKeys.length}${r.duplicateKeys.length ? `  <-- ${r.duplicateKeys.slice(0, 5).map((d) => d.key).join(', ')}` : ''}`);
  console.log(`   columns           : ${a.columnCount}  (mapped ${a.mapped.length} · dropped ${a.dropped.length} · gap ${a.gap.length} · unclassified ${a.unclassified.length})`);
  console.log(`   field coverage    : ${pct(a.coverage)}`);
  if (a.unclassified.length) console.log(`   UNCLASSIFIED      : ${a.unclassified.join(', ')}   <-- DEFECT: unjudged columns`);
  if (a.declaredButAbsent.length) console.log(`   UPSTREAM DRIFT    : mapping declares ${a.declaredButAbsent.join(', ')} which the file no longer has`);
  console.log(`   DESIGN GAPS (${a.gap.length}):`);
  for (const g of a.gap) console.log(`     - ${g.column}: ${g.why}`);
  console.log('');
}

const totalEntities = results.reduce((n, r) => n + r.entities.length, 0);
const totalGaps = results.reduce((n, r) => n + r.audit.gap.length, 0);
const totalUnclassified = results.reduce((n, r) => n + r.audit.unclassified.length, 0);

console.log('## TARGET-SIDE GAPS — PoF fields no source can fill');
for (const g of TARGET_GAPS) console.log(`   [${g.kind}] ${g.catalogId}.${g.field}: ${g.why}`);

console.log('\n=== TOTALS ===');
console.log(`   entities that WOULD be created : ${totalEntities}`);
console.log(`   source columns with no home    : ${totalGaps}`);
console.log(`   unjudged columns (defects)     : ${totalUnclassified}`);
console.log(`   target fields unfillable       : ${TARGET_GAPS.length}`);

// A sample entity, so the report is not the only evidence the mapping produces something.
const sample = results[0]?.entities[0];
if (sample) {
  console.log('\n=== SAMPLE ENTITY (first row of the first table) ===');
  console.log(JSON.stringify(sample, null, 2));
}
