/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Ingest a reference source into the wrapper store, and optionally promote a selection into
 * `catalog_entities` (source 'ingest') so the lab and the pipelines can see it.
 *
 *   npx tsx scripts/diablo/ingest.ts --root <devilutionX>/assets/txtdata
 *   npx tsx scripts/diablo/ingest.ts --root <…> --promote bestiary --limit 5
 *   npx tsx scripts/diablo/ingest.ts --root <…> --promote items --ids d1-IDI_WARRIOR,d1-IDI_ROGUE
 *   npx tsx scripts/diablo/ingest.ts --root <…> --json        # machine-readable summary
 *   npx tsx scripts/diablo/ingest.ts --demote bestiary --ids d1-MT_NZOMBIE   # un-promote (re-do a wave)
 *   npx tsx scripts/diablo/ingest.ts --seed-steps bestiary --ids d1-MT_NZOMBIE   # SOURCED step artifacts (graded by the server)
 *
 * Writes the LOCAL PoF database (~/.pof/pof.db, or POF_DB_PATH). Never the repo.
 */
import { getDb } from '../../src/lib/db';
import { deleteEntity, listEntities, upsertEntity } from '../../src/lib/catalog-db';
import { ingestSourceFromDir } from '../../src/lib/catalog/reference/ingestSource';
import { listWrappers } from '../../src/lib/catalog/reference/wrappers-db';
import { codeSeededEntities } from '../../src/lib/catalog/seed';
import { promoteWrappers, selectForPromotion } from '../../src/lib/catalog/reference/promote';
import { seedBestiarySteps } from '../../src/lib/catalog/reference/stepSeeds';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import '../../src/lib/catalog/pipelines/registry.generated';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sourceId = arg('source') ?? 'diablo1';

// Un-promote: remove INGESTED rows from catalog_entities (the wrappers stay — they are the
// record; promotion is only what the lab and pipelines see). Refuses anything not
// source 'ingest', so it can never delete an authored entity.
const demoteCatalog = arg('demote');
if (demoteCatalog) {
  const ids = arg('ids')?.split(',').map((x) => x.trim()).filter(Boolean);
  const rows = listEntities(demoteCatalog).filter((r) => r.source === 'ingest' && (!ids || ids.includes(r.entityId)));
  const skipped = (ids ?? []).filter((id) => !rows.some((r) => r.entityId === id));
  const removed = rows.map((r) => ({ id: r.entityId, n: deleteEntity(demoteCatalog, r.entityId) }));
  console.log(`demoted ${removed.filter((r) => r.n > 0).length} from ${demoteCatalog}: ${removed.map((r) => r.id).join(', ') || '(none)'}`);
  if (skipped.length) console.log(`   not demoted (absent or not source 'ingest'): ${skipped.join(', ')}`);
  console.log('   their pipeline artifacts are NOT removed — purge with DELETE /api/pipeline-artifacts if the wave is re-done from scratch.');
  process.exit(0);
}

// Seed step artifacts from the reference (D3: graded by the SERVER through the same door as any
// submission, never pass). Requires the entities to be promoted first — a step belongs to an entity.
const seedCatalog = arg('seed-steps');
if (seedCatalog) {
  const ids = arg('ids')?.split(',').map((x) => x.trim()).filter(Boolean);
  const promoted = new Set(listEntities(seedCatalog).filter((r) => r.source === 'ingest').map((r) => r.entityId));
  const wrappers = listWrappers(getDb(), { sourceId, catalogId: seedCatalog }).filter((w) => !ids || ids.includes(w.entity.id));
  for (const w of wrappers) {
    if (!promoted.has(w.entity.id)) { console.log(`SKIP ${w.entity.id}: not promoted (promote it first)`); continue; }
    for (const seed of seedBestiarySteps(w)) {
      const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
      const a = r.acceptance;
      console.log(`${seed.entityId} · ${seed.step}: ${a?.status ?? '?'}${a?.reason ? ` — ${a.reason.slice(0, 150)}` : ''}`);
      for (const g of seed.gaps) console.log(`    gap: ${g}`);
    }
  }
  process.exit(0);
}

const root = arg('root');
if (!root) {
  console.error('usage: ingest.ts --root <data root> [--source diablo1] [--promote <catalogId> [--limit N] [--ids a,b]] [--json]');
  process.exit(2);
}

const db = getDb();
const summary = ingestSourceFromDir(sourceId, root, { db });

let promotion: ReturnType<typeof promoteWrappers> | null = null;
const promoteCatalog = arg('promote');
if (promoteCatalog) {
  const limit = arg('limit');
  const ids = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  const picked = selectForPromotion(listWrappers(db, { sourceId, catalogId: promoteCatalog }), {
    catalogId: promoteCatalog, entityIds: ids, limit: limit ? Number(limit) : undefined,
  });
  // Same door as the hand-made path: a code seed's id is refused, never overwritten.
  promotion = promoteWrappers(picked, upsertEntity, (catalogId, entityId) => {
    const seed = codeSeededEntities(catalogId).find((e) => e.id === entityId);
    return seed ? `id is already the code seed "${seed.name}" in ${catalogId} — the seed always wins` : null;
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, promotion }, null, 2));
  process.exit(0);
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
console.log(`\n=== INGEST ${sourceId} (run #${summary.runId}) from ${root} ===\n`);
for (const t of summary.tables) {
  if (t.status === 'missing') { console.log(`MISSING  ${t.file} → ${t.catalogId}`); continue; }
  if (t.status === 'refused') { console.log(`REFUSED  ${t.file} → ${t.catalogId}: ${t.refusal?.message ?? 'no reason recorded'}`); continue; }
  console.log(`${t.catalogId.padEnd(12)} ${String(t.rows).padStart(4)} rows  coverage ${pct(t.coverage).padStart(6)}  gaps ${t.gaps}  positional ${t.positionalIds}  dupes ${t.duplicateKeys}  malformed ${t.malformed}  map ${t.mappingVersion}`);
  if (t.unclassified.length) console.log(`   UNCLASSIFIED (defect): ${t.unclassified.join(', ')}`);
  if (t.declaredButAbsent.length) console.log(`   UPSTREAM DRIFT: ${t.declaredButAbsent.join(', ')}`);
  for (const s of t.sentinelColumns) console.log(`   sentinel in mapped column ${s.column}: ${s.values.join(', ')} — is it decoded?`);
}
console.log(`\nlinks: ${summary.links.resolved} resolved, ${summary.links.unresolved.length} unresolved`);
const byRef = new Map<string, number>();
for (const u of summary.links.unresolved) byRef.set(`${u.role}→${u.catalogId}:${u.ref}`, (byRef.get(`${u.role}→${u.catalogId}:${u.ref}`) ?? 0) + 1);
for (const [k, n] of [...byRef].slice(0, 12)) console.log(`   unresolved ${k} ×${n}`);
const s = summary.store;
console.log(`store: created ${s.created} · rawChanged ${s.rawChanged} · reprojected ${s.reprojected} · unchanged ${s.unchanged}`);
if (promotion) {
  console.log(`\npromoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.slice(0, 10).join(', ')}${promotion.promoted.length > 10 ? ' …' : ''}`);
  for (const r of promotion.refused) console.log(`   REFUSED ${r.entityId}: ${r.reason}${r.unsafeKeys ? ` (${r.unsafeKeys.join(', ')})` : ''}`);
}
