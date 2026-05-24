import type { SpellbookAbility } from '@/components/modules/core-engine/sub_ability/_shared/data';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { EnemyLootBinding } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import type { ArchetypeConfig } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import type { ComboSequence } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import type { GraphNode } from '@/types/unique-tab-improvements';
import type { ZoneRecord } from '@/components/modules/core-engine/sub_world/_shared/data';
import type { MontageEntry } from '@/components/modules/core-engine/sub_animation/_shared/data';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** Functional-test verdict from the verify step. */
export type TestResult = 'pass' | 'fail';

/** A typed cross-catalog reference (e.g. a Bestiary entry → its abilities/loot). */
export interface CatalogLink {
  catalogId: string;
  entityId: string;
  role: string;
}

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
  /** Cross-catalog references (e.g. Bestiary → Abilities + Loot). */
  links?: CatalogLink[];
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

/** Bestiary catalog entity — composes abilities + loot via `links` (resolved at seed time). */
export interface BestiaryEntry extends CatalogEntityBase {
  catalogId: 'bestiary';
  data: ArchetypeConfig;
}

/** Combat Map catalog entity — combo/interaction shape from CombatActionMap. */
export interface CombatInteractionEntry extends CatalogEntityBase {
  catalogId: 'combat-map';
  data: ComboSequence;
}

/** Screen Flow catalog entity — one screen node from FLOW_NODES. */
export interface ScreenEntry extends CatalogEntityBase {
  catalogId: 'screen-flow';
  data: GraphNode;
}

/** Zone Map catalog entity — one zone from ZoneMap. */
export interface ZoneEntry extends CatalogEntityBase {
  catalogId: 'zone-map';
  data: ZoneRecord;
}

/** State Graph catalog entity — one montage from ALL_MONTAGES (AnimBP graph stays manual). */
export interface AnimationEntry extends CatalogEntityBase {
  catalogId: 'state-graph';
  data: MontageEntry;
}

/** Materials catalog entity (Phase 8 — substrate only; data lift in Phase 8b). */
export interface MaterialCatalogEntry extends CatalogEntityBase {
  catalogId: 'materials';
  data: {
    displayName: string;
    baseColor?: string;
  };
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
