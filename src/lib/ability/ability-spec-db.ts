import { getDb } from '@/lib/db';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

// DDL is idempotent (IF NOT EXISTS) but parsing/planning it on every read is
// pure overhead. Bootstrap runs at most once per process; subsequent calls are
// a cheap boolean check. Every read/write still calls ensureTable() so first-call
// correctness is preserved.
let abilitySpecBootstrapped = false;

function ensureTable() {
  if (abilitySpecBootstrapped) return;

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ability_specs (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      effects TEXT NOT NULL DEFAULT '[]',
      tag_rules TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);

  abilitySpecBootstrapped = true;
}

/** Column row → EnrichedAbilitySpec. Pure (exported for unit test). */
export function rowToSpec(row: Record<string, unknown>): EnrichedAbilitySpec {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    effects: JSON.parse((row.effects as string) || '[]') as EditorEffect[],
    tagRules: JSON.parse((row.tag_rules as string) || '[]') as TagRule[],
    updatedAt: (row.updated_at as string | null) ?? undefined,
  };
}

export function getSpec(catalogId: string, entityId: string): EnrichedAbilitySpec | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM ability_specs WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToSpec(row) : null;
}

export function upsertSpec(rec: EnrichedAbilitySpec): EnrichedAbilitySpec {
  ensureTable();
  getDb().prepare(`
    INSERT INTO ability_specs (catalog_id, entity_id, effects, tag_rules, updated_at)
    VALUES (@catalog_id, @entity_id, @effects, @tag_rules, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      effects=@effects, tag_rules=@tag_rules, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    effects: JSON.stringify(rec.effects),
    tag_rules: JSON.stringify(rec.tagRules),
  });
  return getSpec(rec.catalogId, rec.entityId)!;
}
