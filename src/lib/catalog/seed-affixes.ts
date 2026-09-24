import type { CatalogEntityBase } from '@/lib/catalog/types';

export interface AffixTierSeed {
  tier: string;
  minItemLevel: number;
  valueMin: number;
  valueMax: number;
  weight: number;
}

export interface AffixSeedData {
  affixTag: string;
  displayName: string;
  isPrefix: boolean;
  group: string;
  statTarget: string;
  minRarity: string;
  weight: number;
  effect: string;
  itemTypes: string[];
  tiers: AffixTierSeed[];
}

export interface AffixEntry extends CatalogEntityBase {
  catalogId: 'affixes';
  data: AffixSeedData;
}

export const ADDED_PHYSICAL_DAMAGE_AFFIX: AffixSeedData = {
  affixTag: 'Affix.Prefix.AddedPhysicalDamage',
  displayName: 'Added Physical Damage',
  isPrefix: true,
  group: 'added-phys-damage',
  statTarget: 'UARPGAttributeSet.BonusPhysicalDamage',
  minRarity: 'Magic',
  weight: 900,
  effect: 'GE_Affix_AddedPhysicalDamage',
  itemTypes: ['Weapon'],
  // PoF-authored values lifted from items.ts / Affixes / AddedPhysicalDamage.
  tiers: [
    { tier: 'T5', minItemLevel: 1, valueMin: 3, valueMax: 5, weight: 900 },
    { tier: 'T4', minItemLevel: 20, valueMin: 7, valueMax: 11, weight: 600 },
    { tier: 'T3', minItemLevel: 35, valueMin: 14, valueMax: 20, weight: 350 },
    { tier: 'T2', minItemLevel: 55, valueMin: 22, valueMax: 30, weight: 180 },
    { tier: 'T1', minItemLevel: 75, valueMin: 33, valueMax: 45, weight: 70 },
  ],
};

/** The first affix entity stays stable because the generic e2e walker opens entities[0]. */
export function seedAffixEntries(): AffixEntry[] {
  return [{
    id: 'affix-added-physical-damage',
    catalogId: 'affixes',
    name: ADDED_PHYSICAL_DAMAGE_AFFIX.displayName,
    categoryPath: ['Prefixes', 'Damage'],
    tags: ['prefix', 'physical', 'weapon'],
    lifecycle: 'planned',
    data: ADDED_PHYSICAL_DAMAGE_AFFIX,
  }];
}
