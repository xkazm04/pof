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
import { affixFamilies, seedAffixSteps } from '../../src/lib/catalog/reference/affixFamilies';
import type { ReferenceWrapper } from '../../src/lib/catalog/reference/wrapper';
import { seedBestiarySteps, seedItemSteps, seedSpellSteps } from '../../src/lib/catalog/reference/stepSeeds';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { seededEntities } from '../../src/lib/catalog/seed';
import '../../src/lib/catalog/pipelines/registry.generated';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTsv } from '../../src/lib/catalog/ingest/tsv';
import { referenceCaster, type ReferenceCaster } from '../../src/lib/catalog/reference/spellLaw';
import { unresolvedQuestTalk } from '../../src/lib/catalog/reference/questTalk';
import { dialogueTrees, seedDialogSteps, type DialogueTreesResult } from '@/lib/catalog/reference/dialogueTrees';
import { monsterTalkTrees, seedMonsterTalkSteps, type MonsterTalkTreesResult } from '@/lib/catalog/reference/monsterTalk';
import { seedQuestSteps } from '@/lib/catalog/reference/questSpecs';
import { experienceCurve } from '@/lib/catalog/reference/experienceCurve';
import { seedCharacterCombatSteps, seedProgressionCurveSteps } from '@/lib/catalog/reference/combatSeeds';
import { loreBooks, seedLoreSteps } from '@/lib/catalog/reference/loreBooks';
import {
  effectiveUniqueItemsForPromotion,
  type EffectiveUniqueItemsResult,
} from '@/lib/catalog/reference/uniqueItems';
import { seedStatusSteps, statusEntities } from '@/lib/catalog/reference/statusSpecs';
import { seedObjectSteps, withObjectSpecs } from '@/lib/catalog/reference/objectSpecs';
import { locationEntities, seedLocationSteps } from '@/lib/catalog/reference/locationSpecs';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { combatGameMode, withClassSwingTimes } from '@/lib/catalog/reference/combatInputs';
import type { Difficulty } from '@/lib/catalog/reference/combatMath';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  descentEntity,
  type DescentClassName,
  type StatPointPolicy,
} from '@/lib/catalog/reference/descentSim';
import {
  seedCharacterVendorSteps,
  seedVendorSteps,
  vendorEntities,
} from '@/lib/catalog/reference/storeSpecs';

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
  // A descent is a 16-point depth curve. combat-map's Balance view is a fixed three-bin
  // histogram (wave1Threat/wave2Threat/hazardPressure), so seeding it would persist hidden data
  // the step cannot render or grade. Report the shape mismatch instead of inventing a scalar.
  if (seedCatalog === 'combat-map') {
    const requested = (ids ?? [...promoted]).filter((id) => id.startsWith('d1-descent-'));
    for (const id of requested) {
      if (!promoted.has(id)) { console.log(`SKIP ${id}: not promoted (promote it first)`); continue; }
      console.log(`MISFIT ${id}: combat-map Balance is a fixed three-bin histogram, not a per-depth curve; no SOURCED step artifact was written`);
    }
    process.exit(0);
  }
  // Affix families are promoted aggregates (W11): seed from the family entity itself.
  if (seedCatalog === 'affixes') {
    for (const e of seededEntities('affixes').filter((x) => x.id.startsWith('d1-affix-') && (!ids || ids.includes(x.id)))) {
      for (const seed of seedAffixSteps(e as unknown as ReferenceWrapper['entity'])) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Dialog trees are promoted conversations (W16), not the individual text and quest-talk rows.
  if (seedCatalog === 'dialog-trees') {
    for (const e of seededEntities('dialog-trees').filter((x) => x.id.startsWith('d1-dialog-') && (!ids || ids.includes(x.id)))) {
      const entity = e as unknown as ReferenceWrapper['entity'];
      const seeds = entity.data.talker === 'monster' ? seedMonsterTalkSteps(entity) : seedDialogSteps(entity);
      for (const seed of seeds) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Codex rows are lore-book aggregates: rebuild them from their text-line wrappers before seeding.
  if (seedCatalog === 'codex') {
    const report = loreBooks(listWrappers(getDb(), { sourceId }));
    for (const item of report.unresolved) console.log(`UNRESOLVED ${item.entry}: line ${item.line}`);
    for (const wrapper of report.wrappers.filter((item) => !ids || ids.includes(item.entity.id))) {
      const e = wrapper.entity;
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      for (const seed of seedLoreSteps(e)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Status effects are engine-derived pseudo-wrappers, not rows in the wrapper database.
  if (seedCatalog === 'status-effects') {
    for (const wrapper of statusEntities().filter((item) => !ids || ids.includes(item.entity.id))) {
      const e = wrapper.entity;
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      for (const seed of seedStatusSteps(e)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Props keep one wrapper per objdat row, enriched at promotion/seeding with the shared
  // engine-derived kind specification rather than duplicating behaviour on every row.
  if (seedCatalog === 'props') {
    const wrappers = withObjectSpecs(listWrappers(getDb(), { sourceId, catalogId: 'props' }))
      .filter((item) => !ids || ids.includes(item.entity.id));
    for (const wrapper of wrappers) {
      const e = wrapper.entity;
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      for (const seed of seedObjectSteps(wrapper)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Town stores are engine-derived pseudo-wrappers. Cain is intentionally included as a
  // service-only vendor so identification has the same resolvable interaction binding.
  if (seedCatalog === 'vendors') {
    for (const wrapper of vendorEntities().filter((item) => !ids || ids.includes(item.entity.id))) {
      const e = wrapper.entity;
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      for (const seed of seedVendorSteps(e)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Locations are engine-derived pseudo-wrappers whose pools and set-level parents are
  // resolved from the external monster and quest wrappers already held in the local store.
  if (seedCatalog === 'zone-map') {
    for (const wrapper of locationEntities(listWrappers(getDb(), { sourceId })).filter((item) => !ids || ids.includes(item.entity.id))) {
      const e = wrapper.entity;
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      for (const seed of seedLocationSteps(e)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // Quest behaviour is engine-derived. Town conversations are already promoted W16
  // entities, so bind topics from those entities rather than rebuilding the table rows.
  if (seedCatalog === 'quests') {
    const conversations = seededEntities('dialog-trees').filter((e) => e.id.startsWith('d1-dialog-TOWN_'));
    for (const e of seededEntities('quests').filter((x) => x.id.startsWith('d1-Q_') && (!ids || ids.includes(x.id)))) {
      if (!promoted.has(e.id)) { console.log(`SKIP ${e.id}: not promoted (promote it first)`); continue; }
      const expansion = (e.data as { derived?: { expansion?: unknown } } | undefined)?.derived?.expansion;
      if (expansion === 'hellfire') {
        console.log(`OUT OF SCOPE ${e.id}: d1-quest-scope-law limits engine-derived quest specs to vanilla Diablo I`);
        continue;
      }
      for (const seed of seedQuestSteps(e, conversations)) {
        const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
        console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
        for (const g of seed.gaps) console.log(`    gap: ${g}`);
      }
    }
    process.exit(0);
  }
  // The XP curve is a promoted aggregate, not an individual Experience.tsv row.
  if (seedCatalog === 'progression-curves') {
    const [curve] = experienceCurve(listWrappers(getDb(), { sourceId, catalogId: 'progression-curves' }));
    if (curve && (!ids || ids.includes(curve.entity.id))) {
      if (!promoted.has(curve.entity.id)) console.log(`SKIP ${curve.entity.id}: not promoted (promote it first)`);
      else {
        for (const seed of seedProgressionCurveSteps(curve)) {
          const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
          console.log(`${seed.entityId} · ${seed.step}: ${r.acceptance?.status ?? '?'}${r.acceptance?.reason ? ` — ${r.acceptance.reason.slice(0, 150)}` : ''}`);
          for (const g of seed.gaps) console.log(`    gap: ${g}`);
        }
      }
    }
    process.exit(0);
  }
  // Spell Balance (W13, D33) needs a named reference caster, read from the class tables under --root (values never
  // enter the repo). Without --root the spell seeds stop at Effect Logic.
  let caster: ReferenceCaster | undefined;
  const seedRoot = arg('root');
  if (seedCatalog === 'spellbook' && seedRoot) {
    const cls = arg('class') ?? 'sorcerer';
    const kv = (rel: string, k: string, v: string) => {
      const t = parseTsv(readFileSync(join(seedRoot, rel), 'utf8'));
      if (t.refusal) throw new Error(`${rel}: ${t.refusal.message}`);
      return Object.fromEntries(t.rows.map((r) => [r[k], r[v]]));
    };
    const className = kv('classes/classdat.tsv', 'folderName', 'className')[cls] ?? cls;
    caster = referenceCaster({
      className,
      attributes: kv(`classes/${cls}/attributes.tsv`, 'Attribute', 'Value'),
      animations: kv(`classes/${cls}/animations.tsv`, 'Variable', 'Value'),
    });
    console.log(`reference caster: ${caster.basis} — Magic ${caster.magic}, to-hit ${caster.magicToHit}, cast ${caster.castingFrames} frames (release ${caster.castingActionFrame}), mana ${caster.maxMana}`);
  }
  const storedWrappers = listWrappers(getDb(), { sourceId, catalogId: seedCatalog });
  const wrappers = (seedCatalog === 'characters' ? aggregateClassWrappers(storedWrappers) : storedWrappers)
    .filter((w) => !ids || ids.includes(w.entity.id));
  for (const w of wrappers) {
    if (!promoted.has(w.entity.id)) { console.log(`SKIP ${w.entity.id}: not promoted (promote it first)`); continue; }
    for (const seed of [...seedBestiarySteps(w), ...seedItemSteps(w), ...seedSpellSteps(w, caster), ...seedCharacterCombatSteps(w), ...seedCharacterVendorSteps(w.entity)]) {
      const r = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
      const a = r.acceptance;
      console.log(`${seed.entityId} · ${seed.step}: ${a?.status ?? '?'}${a?.reason ? ` — ${a.reason.slice(0, 150)}` : ''}`);
      for (const g of seed.gaps) console.log(`    gap: ${g}`);
    }
  }
  process.exit(0);
}

// Engine-derived town services need no --root; their pinned Source citations and projections are
// code-owned pseudo-wrappers, while promotion still uses the guarded persistence door.
if (arg('promote') === 'vendors') {
  const limit = arg('limit');
  const ids = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  const picked = selectForPromotion(vendorEntities() as unknown as ReferenceWrapper[], {
    catalogId: 'vendors', entityIds: ids, limit: limit ? Number(limit) : undefined,
  });
  const promotion = promoteWrappers(picked, upsertEntity, (catalogId, entityId) => {
    const seed = codeSeededEntities(catalogId).find((e) => e.id === entityId);
    return seed ? `id is already the code seed "${seed.name}" in ${catalogId} — the seed always wins` : null;
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify({ promotion }, null, 2));
  else {
    console.log(`promoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.join(', ') || '(none)'}`);
    for (const r of promotion.refused) console.log(`   REFUSED ${r.entityId}: ${r.reason}${r.unsafeKeys ? ` (${r.unsafeKeys.join(', ')})` : ''}`);
  }
  process.exit(0);
}

// Engine-derived status rows need no --root: their pinned Source citations and projections are
// code-owned pseudo-wrappers, while promotion still uses the same guarded persistence door.
if (arg('promote') === 'status-effects') {
  const limit = arg('limit');
  const ids = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  const picked = selectForPromotion(statusEntities() as unknown as ReferenceWrapper[], {
    catalogId: 'status-effects', entityIds: ids, limit: limit ? Number(limit) : undefined,
  });
  const promotion = promoteWrappers(picked, upsertEntity, (catalogId, entityId) => {
    const seed = codeSeededEntities(catalogId).find((e) => e.id === entityId);
    return seed ? `id is already the code seed "${seed.name}" in ${catalogId} — the seed always wins` : null;
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify({ promotion }, null, 2));
  else {
    console.log(`promoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.join(', ') || '(none)'}`);
    for (const r of promotion.refused) console.log(`   REFUSED ${r.entityId}: ${r.reason}${r.unsafeKeys ? ` (${r.unsafeKeys.join(', ')})` : ''}`);
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
let dialogueReport: DialogueTreesResult | null = null;
let monsterTalkReport: MonsterTalkTreesResult | null = null;
let uniqueItemReport: EffectiveUniqueItemsResult | null = null;
const promoteCatalog = arg('promote');
if (promoteCatalog) {
  const limit = arg('limit');
  const ids = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  // Affixes promote as FAMILIES (W11): a Diablo row is one tier, PoF's entity is the family — aggregated pseudo-wrappers.
  let pool: ReferenceWrapper[];
  if (promoteCatalog === 'affixes') {
    pool = affixFamilies(listWrappers(db, { sourceId, catalogId: 'affixes' })) as unknown as ReferenceWrapper[];
  } else if (promoteCatalog === 'dialog-trees') {
    const wrappers = listWrappers(db, { sourceId });
    dialogueReport = dialogueTrees(wrappers);
    monsterTalkReport = monsterTalkTrees(wrappers);
    pool = [...dialogueReport.wrappers, ...monsterTalkReport.wrappers] as unknown as ReferenceWrapper[];
  } else if (promoteCatalog === 'codex') {
    const report = loreBooks(listWrappers(db, { sourceId }));
    pool = report.wrappers as unknown as ReferenceWrapper[];
    for (const item of report.unresolved) console.log(`UNRESOLVED ${item.entry}: line ${item.line}`);
  } else if (promoteCatalog === 'progression-curves') {
    pool = experienceCurve(listWrappers(db, { sourceId, catalogId: 'progression-curves' })) as unknown as ReferenceWrapper[];
  } else if (promoteCatalog === 'zone-map') {
    pool = locationEntities(listWrappers(db, { sourceId })) as unknown as ReferenceWrapper[];
  } else if (promoteCatalog === 'props') {
    pool = withObjectSpecs(listWrappers(db, { sourceId, catalogId: 'props' }));
  } else if (promoteCatalog === 'combat-map') {
    const allWrappers = listWrappers(db, { sourceId });
    const classFromId = ids?.map((id) => /^d1-descent-(warrior|rogue|sorcerer)$/.exec(id)?.[1]).find(Boolean);
    const className = (arg('class') ?? classFromId ?? 'warrior') as DescentClassName;
    const policy = (arg('policy') ?? 'none') as StatPointPolicy;
    const difficulty = (arg('difficulty') ?? 'normal') as Difficulty;
    const tilesPerLevel = Number(arg('tiles-per-level') ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION);
    const weaponId = arg('weapon');
    const weapon = weaponId
      ? allWrappers.find((wrapper) => wrapper.catalogId === 'items' && wrapper.entity.id === weaponId)
      : undefined;
    if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);
    pool = [descentEntity({
      className,
      policy,
      tilesPerLevel,
      gameMode: combatGameMode(process.argv),
      difficulty,
      weapon,
      wrappers: allWrappers,
    })];
  } else if (promoteCatalog === 'characters') {
    pool = aggregateClassWrappers(listWrappers(db, { sourceId, catalogId: 'characters' }));
  } else {
    pool = listWrappers(db, { sourceId, catalogId: promoteCatalog });
  }
  let picked = selectForPromotion(pool, {
    catalogId: promoteCatalog, entityIds: ids, limit: limit ? Number(limit) : undefined,
  });
  // A unique is an itemdat base initialized first, followed by its ordered unique powers
  // (.reference/devilutionX/Source/items.cpp:3131-3154,1452-1460). Aggregate that runtime
  // state only for the selected promotion rows; unresolved engine-first base selection is
  // reported and withheld rather than promoted without data.effective.
  if (promoteCatalog === 'items') {
    uniqueItemReport = effectiveUniqueItemsForPromotion(picked, pool);
    const classes = aggregateClassWrappers(listWrappers(db, { sourceId, catalogId: 'characters' }));
    picked = withClassSwingTimes(uniqueItemReport.wrappers, classes);
    uniqueItemReport = { ...uniqueItemReport, wrappers: picked };
  }
  // Same door as the hand-made path: a code seed's id is refused, never overwritten.
  promotion = promoteWrappers(picked, upsertEntity, (catalogId, entityId) => {
    const seed = codeSeededEntities(catalogId).find((e) => e.id === entityId);
    return seed ? `id is already the code seed "${seed.name}" in ${catalogId} — the seed always wins` : null;
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, promotion, dialogueReport, monsterTalkReport, uniqueItemReport }, null, 2));
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
  if (t.rowIdMismatch) console.log(`   ROW-ID MISMATCH (the engine enum moved): expected ${t.rowIdMismatch.expected} rows, file has ${t.rowIdMismatch.actual}`);
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
for (const u of summary.links.unresolved) byRef.set(`${u.role}→${u.catalogId}:${u.ref}`, (byRef.get(`${u.role}→${u.catalogId}:${u.ref}`) ?? 0) + 1);
for (const [k, n] of [...byRef].slice(0, 12)) console.log(`   unresolved ${k} ×${n}`);
// Quest talk is a LABELLED list, not a link (it must keep which quest each line is about), so link resolution does not see it (W16).
const questTalkMissing = unresolvedQuestTalk(listWrappers(db, { sourceId }));
console.log(`quest talk: ${questTalkMissing.length} line id(s) with no wrapped line${questTalkMissing.length ? `: ${questTalkMissing.slice(0, 12).join(', ')}` : ''}`);
const s = summary.store;
console.log(`store: created ${s.created} · rawChanged ${s.rawChanged} · reprojected ${s.reprojected} · unchanged ${s.unchanged}`);
if (promotion) {
  console.log(`\npromoted ${promotion.promoted.length} → catalog_entities (source ingest): ${promotion.promoted.slice(0, 10).join(', ')}${promotion.promoted.length > 10 ? ' …' : ''}`);
  for (const r of promotion.refused) console.log(`   REFUSED ${r.entityId}: ${r.reason}${r.unsafeKeys ? ` (${r.unsafeKeys.join(', ')})` : ''}`);
}
if (dialogueReport) {
  for (const item of dialogueReport.skipped) console.log(`   SKIPPED ${item.towner}: ${item.reason}`);
  for (const item of dialogueReport.unresolved) console.log(`   UNRESOLVED ${item.towner}: line ${item.line}`);
}
if (monsterTalkReport) {
  for (const item of monsterTalkReport.skipped) console.log(`   SKIPPED ${item.monster}: ${item.reason}`);
  for (const item of monsterTalkReport.unresolved) console.log(`   UNRESOLVED ${item.monster}: line ${item.line}`);
}
if (uniqueItemReport) {
  for (const item of uniqueItemReport.unresolved) console.log(`   UNRESOLVED ${item.entityId}: ${item.reason}`);
}
