/**
 * The ONE enemy → loot-table join.
 *
 * Three spellings name the same enemy: bestiary archetype ids are kebab
 * ('melee-grunt'), loot bindings are PascalCase ('MeleeGrunt'), and loot-tables
 * catalog entities are `lt-${binding.archetypeId}` ('lt-MeleeGrunt', see
 * seed-loot.ts). Every consumer resolves through a single normalised key
 * (non-alphanumerics stripped, lowercased) instead of templating an id, so a
 * hyphenated archetype still finds its table and an unbound one yields null.
 * Loot-table ids stay PascalCase — no catalog entity id moves. Pure, no IO.
 */
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import {
  DEFAULT_ENEMY_LOOT_BINDINGS,
  type EnemyLootBinding,
} from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

const LOOT_TABLE_PREFIX = 'lt-';

/** Collapse any spelling of an archetype id to the join key ('Melee-Grunt' → 'meleegrunt'). */
export function normaliseArchetypeKey(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/** The loot-tables catalog entity id for a binding (mirrors seed-loot.ts). */
export function lootTableEntityId(binding: EnemyLootBinding): string {
  return `${LOOT_TABLE_PREFIX}${binding.archetypeId}`;
}

const BINDING_BY_KEY = new Map(
  DEFAULT_ENEMY_LOOT_BINDINGS.map((b) => [normaliseArchetypeKey(b.archetypeId), b] as const),
);
const ARCHETYPE_ID_BY_KEY = new Map(
  ARCHETYPES.map((a) => [normaliseArchetypeKey(a.id), a.id] as const),
);

/** The loot binding a bestiary archetype drops from, or null when none is bound. */
export function lootBindingForArchetype(archetypeId: string): EnemyLootBinding | null {
  return BINDING_BY_KEY.get(normaliseArchetypeKey(archetypeId)) ?? null;
}

/** The real loot-tables entity id for a bestiary archetype ('melee-grunt' → 'lt-MeleeGrunt'), or null. */
export function lootTableIdForArchetype(archetypeId: string): string | null {
  const binding = lootBindingForArchetype(archetypeId);
  return binding ? lootTableEntityId(binding) : null;
}

/** The bestiary archetype id a loot-tables entity belongs to ('lt-MandalorianWarrior' → 'mandalorian-warrior'), or null. */
export function archetypeIdForLootTable(lootTableId: string): string | null {
  if (!lootTableId.startsWith(LOOT_TABLE_PREFIX)) return null;
  const binding = BINDING_BY_KEY.get(normaliseArchetypeKey(lootTableId.slice(LOOT_TABLE_PREFIX.length)));
  if (!binding) return null;
  return ARCHETYPE_ID_BY_KEY.get(normaliseArchetypeKey(binding.archetypeId)) ?? null;
}

/**
 * The loot half of a bestiary 'wire' instruction: names the resolved id, or
 * states plainly that no table is bound so the CLI never invents one.
 */
export function lootWireClause(archetypeId: string): string {
  const id = lootTableIdForArchetype(archetypeId);
  return id
    ? `bind the loot table (${id})`
    : 'bind no loot table: no loot-tables entry is bound to this archetype, so do not invent a loot-table id';
}

export interface EnemyLootCoverage {
  /** Bestiary archetypes that resolve to a loot table. */
  linked: number;
  /** Bestiary archetypes with no loot table. */
  archetypesWithoutTable: number;
  /** Loot-tables ids no bestiary archetype resolves to (binding order). */
  tablesWithoutArchetype: string[];
}

/** How much of the bestiary and the loot-tables catalog the join actually connects. */
export function enemyLootCoverage(): EnemyLootCoverage {
  const linked = ARCHETYPES.filter((a) => lootBindingForArchetype(a.id) !== null).length;
  return {
    linked,
    archetypesWithoutTable: ARCHETYPES.length - linked,
    tablesWithoutArchetype: DEFAULT_ENEMY_LOOT_BINDINGS
      .filter((b) => !ARCHETYPE_ID_BY_KEY.has(normaliseArchetypeKey(b.archetypeId)))
      .map(lootTableEntityId),
  };
}
