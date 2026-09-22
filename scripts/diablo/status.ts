/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * The replication GATE snapshot: what a human reviews before the /diablo loop takes its next
 * wave. Read-only.
 *
 *   npx tsx scripts/diablo/status.ts [--source diablo1] [--json]
 *
 * Per catalog: wrapped rows → promoted entities → pipeline artifacts by status → UE assets
 * claimed. Plus the coverage trend over recent ingest runs, which is how the hundreds of
 * mapping adjustments show up as a number that moves.
 */
import '../../src/lib/catalog/pipelines/registry.generated';
import { getDb } from '../../src/lib/db';
import { listEntities } from '../../src/lib/catalog-db';
import { listAllArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { getCatalogPipeline } from '../../src/lib/catalog/pipeline-registry';
import { getReferenceSource } from '../../src/lib/catalog/reference/sources';
import { listRuns, summarizeWrappers } from '../../src/lib/catalog/reference/wrappers-db';
import type { IngestRunSummary } from '../../src/lib/catalog/reference/ingestSource';

const i = process.argv.indexOf('--source');
const source = getReferenceSource(i >= 0 ? process.argv[i + 1] : 'diablo1');
const db = getDb();

const wrapped = summarizeWrappers(db, source.id);
const catalogs = [...new Set(source.tables.map((t) => t.catalogId))];

const rows = catalogs.map((catalogId) => {
  const promoted = listEntities(catalogId).filter((e) => e.source === 'ingest' && e.entityId.startsWith(`${source.idPrefix}-`));
  const steps = getCatalogPipeline(catalogId)?.steps.length ?? 0;
  const byStatus: Record<string, number> = {};
  let ueAssets = 0;
  let entitiesWithArtifacts = 0;
  for (const e of promoted) {
    const arts = listAllArtifacts({ catalogId, entityId: e.entityId });
    if (arts.length) entitiesWithArtifacts++;
    for (const a of arts) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      ueAssets += a.ueAssets.length;
    }
  }
  return {
    catalogId,
    wrapped: wrapped.filter((w) => w.catalogId === catalogId).reduce((n, w) => n + w.wrappers, 0),
    promoted: promoted.length,
    pipelineSteps: steps,
    entitiesWithArtifacts,
    artifactSlots: promoted.length * steps,
    artifactsByStatus: byStatus,
    ueAssets,
  };
});

const trend = listRuns(db, source.id, 10).map((r) => {
  const s = r.summary as Omit<IngestRunSummary, 'runId'>;
  return {
    run: r.id, at: r.at,
    coverage: Object.fromEntries(s.tables.filter((t) => t.status === 'ingested').map((t) => [t.catalogId, Number((t.coverage * 100).toFixed(1))])),
    unresolvedLinks: s.links.unresolved.length,
    reprojected: s.store.reprojected,
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ source: source.id, catalogs: rows, trend }, null, 2));
  process.exit(0);
}

console.log(`\n=== ${source.game} — replication status ===\n`);
console.log('catalog        wrapped  promoted  steps  w/artifacts  artifacts(pass/deferred/fail/pending)   UE assets');
for (const r of rows) {
  const s = r.artifactsByStatus;
  const arts = `${s.pass ?? 0}/${s.deferred ?? 0}/${s.fail ?? 0}/${s.pending ?? 0} of ${r.artifactSlots}`;
  console.log(`${r.catalogId.padEnd(14)} ${String(r.wrapped).padStart(7)}  ${String(r.promoted).padStart(8)}  ${String(r.pipelineSteps).padStart(5)}  ${String(r.entitiesWithArtifacts).padStart(11)}  ${arts.padEnd(38)} ${r.ueAssets}`);
}
console.log('\ncoverage trend (newest first):');
for (const t of trend) console.log(`  run #${t.run} ${t.at}  ${JSON.stringify(t.coverage)}  unresolved links ${t.unresolvedLinks}  reprojected ${t.reprojected}`);
if (!trend.length) console.log('  (no ingest runs yet — run scripts/diablo/ingest.ts)');
