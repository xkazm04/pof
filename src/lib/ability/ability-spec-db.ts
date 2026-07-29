import { getDb } from '@/lib/db';
import type {
  AttrRelationship, CodegenReport, EnrichedAbilitySpec, SpecProvenance,
} from '@/lib/ability/spec';
import type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';

// DDL is idempotent (IF NOT EXISTS) but parsing/planning it on every read is
// pure overhead. Bootstrap runs at most once per process; subsequent calls are
// a cheap boolean check. Every read/write still calls ensureTable() so first-call
// correctness is preserved.
let abilitySpecBootstrapped = false;

function ensureTable() {
  if (abilitySpecBootstrapped) return;

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ability_specs (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      effects TEXT NOT NULL DEFAULT '[]',
      tag_rules TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);

  // Additive migration: adoption provenance (raw forged C++ + prompt). Optional
  // column so existing rows/consumers are unaffected.
  const cols = db.prepare('PRAGMA table_info(ability_specs)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'provenance')) {
    db.exec('ALTER TABLE ability_specs ADD COLUMN provenance TEXT');
  }

  // Additive migration: codegen provenance (what the generate-gas-effects agent
  // actually wrote/built/seeded in UE). Owned solely by the codegen callback —
  // `upsertSpec` never writes this column, so a Save/Adopt cannot clobber it.
  if (!cols.some((c) => c.name === 'codegen')) {
    db.exec('ALTER TABLE ability_specs ADD COLUMN codegen TEXT');
  }

  // Additive migration: the remaining three editor slices (attributes /
  // relationship web / loadout). They are the AttributeSet.h + GameplayTags.h
  // codegen inputs and used to vanish on entity switch or reload. Nullable so
  // legacy rows keep reading back as "not authored".
  for (const col of ['attributes', 'relationships', 'loadout']) {
    if (!cols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE ability_specs ADD COLUMN ${col} TEXT`);
    }
  }

  abilitySpecBootstrapped = true;
}

/** JSON column → array, or undefined when the column was never written. */
function parseSlice<T>(raw: unknown): T[] | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  return JSON.parse(raw) as T[];
}

/** Column row → EnrichedAbilitySpec. Pure (exported for unit test). */
export function rowToSpec(row: Record<string, unknown>): EnrichedAbilitySpec {
  const provRaw = row.provenance as string | null | undefined;
  const codegenRaw = row.codegen as string | null | undefined;
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    effects: JSON.parse((row.effects as string) || '[]') as EditorEffect[],
    tagRules: JSON.parse((row.tag_rules as string) || '[]') as TagRule[],
    attributes: parseSlice<EditorAttribute>(row.attributes),
    relationships: parseSlice<AttrRelationship>(row.relationships),
    loadout: parseSlice<GASLoadoutSlot>(row.loadout),
    updatedAt: (row.updated_at as string | null) ?? undefined,
    provenance: provRaw ? (JSON.parse(provRaw) as SpecProvenance) : undefined,
    codegen: codegenRaw ? (JSON.parse(codegenRaw) as CodegenReport) : undefined,
  };
}

export function getSpec(catalogId: string, entityId: string): EnrichedAbilitySpec | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM ability_specs WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToSpec(row) : null;
}

/**
 * Write all five editor slices + adoption provenance.
 *
 * Deliberately does NOT touch the `codegen` column: that audit trail is owned
 * solely by the generate-gas-effects callback, so a Save/Adopt can never clobber
 * it. Keep that property when extending this statement.
 */
export function upsertSpec(rec: EnrichedAbilitySpec): EnrichedAbilitySpec {
  ensureTable();
  getDb().prepare(`
    INSERT INTO ability_specs
      (catalog_id, entity_id, effects, tag_rules, attributes, relationships, loadout, provenance, updated_at)
    VALUES
      (@catalog_id, @entity_id, @effects, @tag_rules, @attributes, @relationships, @loadout, @provenance, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      effects=@effects, tag_rules=@tag_rules,
      attributes=@attributes, relationships=@relationships, loadout=@loadout,
      provenance=@provenance, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    effects: JSON.stringify(rec.effects),
    tag_rules: JSON.stringify(rec.tagRules),
    attributes: rec.attributes ? JSON.stringify(rec.attributes) : null,
    relationships: rec.relationships ? JSON.stringify(rec.relationships) : null,
    loadout: rec.loadout ? JSON.stringify(rec.loadout) : null,
    provenance: rec.provenance ? JSON.stringify(rec.provenance) : null,
  });
  return getSpec(rec.catalogId, rec.entityId)!;
}

/**
 * Attach a {@link CodegenReport} to an entity's spec (the generate-gas-effects
 * callback's only write). Creates an empty spec row if the entity has none yet
 * so a codegen result is never dropped on the floor.
 */
export function setCodegenReport(
  catalogId: string,
  entityId: string,
  report: CodegenReport,
): EnrichedAbilitySpec {
  ensureTable();
  getDb().prepare(`
    INSERT INTO ability_specs (catalog_id, entity_id, effects, tag_rules, codegen, updated_at)
    VALUES (@catalog_id, @entity_id, '[]', '[]', @codegen, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      codegen=@codegen, updated_at=datetime('now')
  `).run({
    catalog_id: catalogId,
    entity_id: entityId,
    codegen: JSON.stringify(report),
  });
  return getSpec(catalogId, entityId)!;
}
