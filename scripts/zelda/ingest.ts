/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Wrap every mapped botw spec from the pinned clone into the wrapper store (`~/.pof/pof.db`).
 * Idempotent: a re-run over an unchanged clone and unchanged mappings reports `unchanged` for
 * every record. Wrap only — nothing is promoted into `catalog_entities`.
 *
 *   npx tsx scripts/zelda/ingest.ts --root <botw clone> [--vault <Zelda vault dir>] [--json]
 *
 * The run is recorded with this round's coverage counts and vault learning counts, so
 * `status.ts` can tell whether a full round moved anything (the STOP rule).
 */
import { getDb } from '@/lib/db';
import { BOTW_PIN } from '@/lib/catalog/ingest/botw';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { BOTW } from '@/lib/catalog/reference/sources';
import { arg, botwCoverage, countsOf, DEFAULT_VAULT, flag, requireClone, treeFiles, vaultCounts } from './shared';

const root = arg('root');
requireClone(root);
const dataRoot = root as string;
const vault = arg('vault') ?? DEFAULT_VAULT;

const coverage = countsOf(botwCoverage(dataRoot));
const { vaultFound, ...learning } = vaultCounts(vault);
const files = treeFiles(dataRoot);
const summary = ingestSourceFromDir(BOTW.id, dataRoot, {
  db: getDb(),
  listFiles: () => files,
  runExtras: { pin: BOTW_PIN, pathCoverage: coverage, vault: learning },
});

if (flag('json')) {
  console.log(JSON.stringify({ pin: BOTW_PIN, coverage, vault: learning, summary }, null, 2));
  process.exit(0);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
console.log(`\n=== INGEST ${BOTW.id} @ ${BOTW_PIN.slice(0, 7)} (run #${summary.runId}) from ${dataRoot} ===\n`);
if (!BOTW.tables.length) console.log('(no spec mapped yet — nothing to wrap)');
for (const t of summary.tables) {
  const f = t.files;
  const fileLine = f ? `files ${f.matched} (no records ${f.withoutRecords}, refused ${f.refused.length})` : '';
  if (t.status !== 'ingested') {
    console.log(`${t.status.toUpperCase().padEnd(8)} ${t.file} → ${t.catalogId}  ${fileLine}`);
    continue;
  }
  console.log(`${t.catalogId.padEnd(16)} ${t.file}`);
  console.log(`   ${fileLine}  records ${t.rows}  coverage ${pct(t.coverage)}  gaps ${t.gaps}  dupes ${t.duplicateKeys}  malformed ${t.malformed}  map ${t.mappingVersion}`);
  if (t.unclassified.length) console.log(`   UNCLASSIFIED (defect): ${t.unclassified.join(', ')}`);
  if (t.declaredButAbsent.length) console.log(`   READER DRIFT (mapped columns the reader no longer emits): ${t.declaredButAbsent.join(', ')}`);
  for (const r of f?.refused ?? []) console.log(`   REFUSED file: ${r}`);
}
const s = summary.store;
console.log(`\nstore: created ${s.created} · rawChanged ${s.rawChanged} · reprojected ${s.reprojected} · unchanged ${s.unchanged}`);
console.log(`coverage: total ${coverage.total} · covered ${coverage.covered} · descoped ${coverage.descoped} · open ${coverage.open}`);
console.log(`vault: Path nodes ${learning.pathNodes} · findings ${learning.findings} · upgrades ${learning.upgrades}${vaultFound ? '' : `  (vault ${vault} not found — counted as 0)`}`);
if (s.rawChanged) console.log('\nrawChanged ≠ 0: records moved under the wrappers (reader change or moved tree) — record it in Findings.md before anything else.');
