/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/** Ingest Diablo reference tables, optionally promoting entities or seeding step artifacts. */
import { deleteEntity, listEntities, upsertEntity } from '@/lib/catalog-db';
import { codeSeededEntities } from '@/lib/catalog/seed';
import { getDb } from '@/lib/db';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { promoteWrappers, selectForPromotion } from '@/lib/catalog/reference/promote';
import { unresolvedQuestTalk } from '@/lib/catalog/reference/questTalk';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import '@/lib/catalog/pipelines/registry.generated';
import { arg, promotionOptions, requestedIds } from './catalogs/args';
import { catalogHandlers, type CatalogReport, type SeedContext } from './catalogs';
import { emitSeeds, seedGeneric } from './catalogs/seed';

const sourceId = arg('source') ?? 'diablo1';
const print = (line: string): void => console.log(line);

const demoteCatalog = arg('demote');
if (demoteCatalog) {
  const ids = requestedIds();
  const rows = listEntities(demoteCatalog).filter(
    (row) => row.source === 'ingest' && (!ids || ids.includes(row.entityId)),
  );
  const skipped = (ids ?? []).filter((id) => !rows.some((row) => row.entityId === id));
  const removed = rows.map((row) => ({ id: row.entityId, n: deleteEntity(demoteCatalog, row.entityId) }));
  console.log(`demoted ${removed.filter((row) => row.n > 0).length} from ${demoteCatalog}: ${removed.map((row) => row.id).join(', ') || '(none)'}`);
  if (skipped.length) console.log(`   not demoted (absent or not source 'ingest'): ${skipped.join(', ')}`);
  console.log('   their pipeline artifacts are NOT removed — purge with DELETE /api/pipeline-artifacts if the wave is re-done from scratch.');
  process.exit(0);
}

const seedCatalog = arg('seed-steps');
if (seedCatalog) {
  const db = getDb();
  const ids = requestedIds();
  const promoted = new Set(
    listEntities(seedCatalog).filter((row) => row.source === 'ingest').map((row) => row.entityId),
  );
  const ctx: SeedContext = {
    db,
    sourceId,
    ids,
    promoted,
    root: arg('root'),
    emit: emitSeeds,
    generic: (wrappers, caster) => seedGeneric(ctx, wrappers, caster),
    print,
  };
  const handler = catalogHandlers.get(seedCatalog);
  if (handler?.seed) handler.seed(ctx);
  else {
    const wrappers = listWrappers(db, { sourceId, catalogId: seedCatalog })
      .filter((wrapper) => !ids || ids.includes(wrapper.entity.id));
    seedGeneric(ctx, wrappers);
  }
  process.exit(0);
}

function promotePool(catalogId: string, pool: ReferenceWrapper[]) {
  const picked = selectForPromotion(pool, promotionOptions(catalogId));
  return promoteWrappers(picked, upsertEntity, (targetCatalog, entityId) => {
    const seed = codeSeededEntities(targetCatalog).find((entity) => entity.id === entityId);
    return seed ? `id is already the code seed "${seed.name}" in ${targetCatalog} — the seed always wins` : null;
  });
}

const promoteCatalog = arg('promote');
const promoteHandler = promoteCatalog ? catalogHandlers.get(promoteCatalog) : undefined;
if (promoteCatalog && promoteHandler?.standalonePromotion) {
  const pool = promoteHandler.pool?.(getDb(), sourceId, []) ?? [];
  const promotion = promotePool(promoteCatalog, pool);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ promotion }, null, 2));
  else {
    console.log(`promoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.join(', ') || '(none)'}`);
    for (const refusal of promotion.refused) console.log(`   REFUSED ${refusal.entityId}: ${refusal.reason}${refusal.unsafeKeys ? ` (${refusal.unsafeKeys.join(', ')})` : ''}`);
  }
  process.exit(0);
}

const root = arg('root');
if (!root) {
  console.error('usage: ingest.ts --root <data root> [--source diablo1] [--promote <catalogId> [--limit N] [--ids a,b]] [--json]; vendors and status-effects promotion need no --root');
  process.exit(2);
}

const db = getDb();
const summary = ingestSourceFromDir(sourceId, root, { db });
let promotion: ReturnType<typeof promoteWrappers> | null = null;
let report: CatalogReport = {};
if (promoteCatalog) {
  const allWrappers = listWrappers(db, { sourceId });
  const pool = promoteHandler?.pool?.(db, sourceId, allWrappers)
    ?? allWrappers.filter((wrapper) => wrapper.catalogId === promoteCatalog);
  promotion = promotePool(promoteCatalog, pool);
  report = promoteHandler?.report?.() ?? {};
  for (const line of report.beforeSummary ?? []) console.log(line);
}

const dialogueReport = report.dialogueReport ?? null;
const monsterTalkReport = report.monsterTalkReport ?? null;
const uniqueItemReport = report.uniqueItemReport ?? null;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, promotion, dialogueReport, monsterTalkReport, uniqueItemReport }, null, 2));
  process.exit(0);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
console.log(`\n=== INGEST ${sourceId} (run #${summary.runId}) from ${root} ===\n`);
for (const table of summary.tables) {
  if (table.status === 'missing') { console.log(`MISSING  ${table.file} → ${table.catalogId}`); continue; }
  if (table.status === 'refused') { console.log(`REFUSED  ${table.file} → ${table.catalogId}: ${table.refusal?.message ?? 'no reason recorded'}`); continue; }
  console.log(`${table.catalogId.padEnd(12)} ${String(table.rows).padStart(4)} rows  coverage ${pct(table.coverage).padStart(6)}  gaps ${table.gaps}  positional ${table.positionalIds}  dupes ${table.duplicateKeys}  malformed ${table.malformed}  map ${table.mappingVersion}`);
  if (table.unclassified.length) console.log(`   UNCLASSIFIED (defect): ${table.unclassified.join(', ')}`);
  if (table.declaredButAbsent.length) console.log(`   UPSTREAM DRIFT: ${table.declaredButAbsent.join(', ')}`);
  for (const sentinel of table.sentinelColumns) console.log(`   sentinel in mapped column ${sentinel.column}: ${sentinel.values.join(', ')} — is it decoded?`);
  if (table.rowIdMismatch) console.log(`   ROW-ID MISMATCH (the engine enum moved): expected ${table.rowIdMismatch.expected} rows, file has ${table.rowIdMismatch.actual}`);
}
for (const manifest of summary.manifests) {
  if (manifest.status === 'missing') { console.log(`MISSING  ${manifest.file} (manifest)`); continue; }
  if (manifest.status === 'refused') { console.log(`REFUSED  ${manifest.file} (manifest): ${manifest.refusal?.message ?? 'no reason recorded'}`); continue; }
  if (manifest.unclassified.length) console.log(`   UNCLASSIFIED manifest columns in ${manifest.file}: ${manifest.unclassified.join(', ')}`);
  if (manifest.declaredButAbsent.length) console.log(`   UPSTREAM DRIFT manifest columns in ${manifest.file}: ${manifest.declaredButAbsent.join(', ')}`);
  if (manifest.unregisteredKeys.length) console.log(`   UPSTREAM DRIFT unregistered keys in ${manifest.file}: ${manifest.unregisteredKeys.join(', ')}`);
}
console.log(`\nlinks: ${summary.links.resolved} resolved, ${summary.links.unresolved.length} unresolved`);
const byRef = new Map<string, number>();
for (const item of summary.links.unresolved) byRef.set(`${item.role}→${item.catalogId}:${item.ref}`, (byRef.get(`${item.role}→${item.catalogId}:${item.ref}`) ?? 0) + 1);
for (const [key, count] of [...byRef].slice(0, 12)) console.log(`   unresolved ${key} ×${count}`);
const questTalkMissing = unresolvedQuestTalk(listWrappers(db, { sourceId }));
console.log(`quest talk: ${questTalkMissing.length} line id(s) with no wrapped line${questTalkMissing.length ? `: ${questTalkMissing.slice(0, 12).join(', ')}` : ''}`);
const store = summary.store;
console.log(`store: created ${store.created} · rawChanged ${store.rawChanged} · reprojected ${store.reprojected} · unchanged ${store.unchanged}`);
if (promotion) {
  console.log(`\npromoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.slice(0, 10).join(', ')}${promotion.promoted.length > 10 ? ' …' : ''}`);
  for (const refusal of promotion.refused) console.log(`   REFUSED ${refusal.entityId}: ${refusal.reason}${refusal.unsafeKeys ? ` (${refusal.unsafeKeys.join(', ')})` : ''}`);
}
for (const line of report.afterSummary ?? []) console.log(line);
