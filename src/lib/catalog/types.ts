import type { SpellbookAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** The shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  id: string;
  catalogId: string;        // 'spellbook' (more catalogs added by later 09 steps)
  name: string;
  categoryPath: string[];   // e.g. ['Offensive','Fire'] — the future L4 hierarchy
  tags: string[];           // e.g. ['basic']
  lifecycle: LifecycleState;
}

/** Ability catalog entity — payload reuses the existing UI shape, rendered unchanged. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: SpellbookAbility;
}
