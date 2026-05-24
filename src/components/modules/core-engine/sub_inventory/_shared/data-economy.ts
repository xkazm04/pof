import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_PURPLE, STATUS_BLOCKER, RARITY_COLORS,
} from '@/lib/chart-colors';

/* ── 6.5 Crafting Recipe Data ────────────────────────────────────────── */

export interface CraftMaterial { name: string; quantity: number; rarity: string }
export interface CraftRecipe {
  output: string;
  outputRarity: string;
  materials: CraftMaterial[];
  successRate: number;
  cost: number;
  affixChances: { affix: string; chance: number; color: string }[];
}

export const SAMPLE_RECIPE: CraftRecipe = {
  output: 'Crystal Staff',
  outputRarity: 'Rare',
  materials: [
    { name: 'Arcane Shard', quantity: 3, rarity: 'Uncommon' },
    { name: 'Mithril Rod', quantity: 1, rarity: 'Rare' },
    { name: 'Mana Crystal', quantity: 2, rarity: 'Common' },
  ],
  successRate: 0.85,
  cost: 500,
  affixChances: [
    { affix: 'Mana Regen +5/s', chance: 0.6, color: STATUS_INFO },
    { affix: 'Spell Cost -10%', chance: 0.35, color: ACCENT_PURPLE },
    { affix: 'of Power', chance: 0.15, color: STATUS_ERROR },
    { affix: 'Blazing', chance: 0.08, color: STATUS_BLOCKER },
  ],
};

/* ── 6.6 Item Drop Source Data ───────────────────────────────────────── */

export interface DropSource {
  name: string;
  type: 'enemy' | 'loot_table' | 'zone';
  dropRate: number;
  color: string;
}

export const CRYSTAL_STAFF_SOURCES: DropSource[] = [
  { name: 'Caster', type: 'enemy', dropRate: 0.05, color: STATUS_ERROR },
  { name: 'Rare_Weapons', type: 'loot_table', dropRate: 0.03, color: STATUS_WARNING },
  { name: 'Whispering Woods', type: 'zone', dropRate: 0.01, color: STATUS_SUCCESS },
];

/* ── 6.7 Inventory Capacity Data ─────────────────────────────────────── */

export interface InventorySlotGroup { type: string; count: number; color: string }

export const INVENTORY_GROUPS: InventorySlotGroup[] = [
  { type: 'Weapons', count: 4, color: STATUS_ERROR },
  { type: 'Armor', count: 5, color: STATUS_INFO },
  { type: 'Consumables', count: 3, color: STATUS_SUCCESS },
  { type: 'Materials', count: 5, color: STATUS_WARNING },
];

export const INVENTORY_TOTAL = 20;
export const INVENTORY_USED = INVENTORY_GROUPS.reduce((a, g) => a + g.count, 0);
export const INVENTORY_GOLD_VALUE = 2450;

export const INVENTORY_BY_RARITY = [
  { rarity: 'Common', count: 7, color: RARITY_COLORS.Common },
  { rarity: 'Uncommon', count: 5, color: RARITY_COLORS.Uncommon },
  { rarity: 'Rare', count: 3, color: RARITY_COLORS.Rare },
  { rarity: 'Epic', count: 1, color: RARITY_COLORS.Epic },
  { rarity: 'Legendary', count: 1, color: RARITY_COLORS.Legendary },
];

export const CLEANUP_SUGGESTIONS = [
  'Sell 3x Common potions (+45g)',
  'Salvage 2x Uncommon armor (+6 materials)',
  'Drop 1x Iron Longsword (lowest DPS weapon)',
];

/* ── 6.10 Rarity Distribution Data ───────────────────────────────────── */

export interface RarityDistEntry {
  rarity: string;
  expected: number;
  actual: number;
  color: string;
}

export const RARITY_DIST: RarityDistEntry[] = [
  { rarity: 'Common', expected: 0.40, actual: 0.55, color: RARITY_COLORS.Common },
  { rarity: 'Uncommon', expected: 0.30, actual: 0.25, color: RARITY_COLORS.Uncommon },
  { rarity: 'Rare', expected: 0.20, actual: 0.15, color: RARITY_COLORS.Rare },
  { rarity: 'Epic', expected: 0.08, actual: 0.05, color: RARITY_COLORS.Epic },
  { rarity: 'Legendary', expected: 0.02, actual: 0.0, color: RARITY_COLORS.Legendary },
];

export const LUCK_SCORE = 72;
