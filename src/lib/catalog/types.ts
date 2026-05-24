import type { SpellbookAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';
import type { ItemData } from '@/components/modules/core-engine/unique-tabs/ItemCatalog/data';
import type { EnemyLootBinding } from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** Functional-test verdict from the verify step. */
export type TestResult = 'pass' | 'fail';

/** The shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  id: string;
  catalogId: string;        // 'spellbook' (more catalogs added by later 09 steps)
  name: string;
  categoryPath: string[];   // e.g. ['Offensive','Fire'] — the future L4 hierarchy
  tags: string[];           // e.g. ['basic']
  lifecycle: LifecycleState;
  // ── Generation outputs (added by the Round-1 generation engine). Optional so
  //    statically-seeded entities remain valid without them. ──
  /** UE asset paths this entity owns once generated. */
  ueAssets?: string[];
  /** Last functional-test verdict from the verify step. */
  lastTestResult?: TestResult;
  /** ISO timestamp of the last passing verify. */
  lastVerifiedAt?: string;
}

/** Ability catalog entity — payload reuses the existing UI shape, rendered unchanged. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: SpellbookAbility;
}

/** Items catalog entity — payload reuses the existing ItemCatalog UI shape. */
export interface ItemEntry extends CatalogEntityBase {
  catalogId: 'items';
  data: ItemData;
}

/** Loot-table catalog entity — payload reuses the existing enemy→loot binding shape. */
export interface LootTableEntry extends CatalogEntityBase {
  catalogId: 'loot-tables';
  data: EnemyLootBinding;
}

/**
 * Generic stored shape used by the entity-generic dispatch path: any catalog
 * entity carries a `data` blob opaque to the dispatch (each section's recipe
 * knows how to interpret its own `data`).
 */
export type StoredCatalogEntity = CatalogEntityBase & { data?: unknown };

/**
 * A lifecycle/generation record persisted server-side (DB) and merged over the
 * statically-seeded entities at load time. The DB owns lifecycle/ueAssets/test
 * results; the static seed owns the design `data`.
 */
export interface LifecycleRecord {
  catalogId: string;
  entityId: string;
  lifecycle: LifecycleState;
  ueAssets: string[];
  lastTestResult?: TestResult;
  lastVerifiedAt?: string;
}
