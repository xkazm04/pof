import { ACCENT_EMERALD, ACCENT_ORANGE, STATUS_MUTED, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';
import type { GaugeMetric, DiffEntry, HeatmapCell } from '@/types/unique-tab-improvements';

export const ACCENT = ACCENT_ORANGE;

/* -- Rarity tiers --------------------------------------------------------- */

export interface RarityTier {
  name: string;
  color: string;
  weight: number;
}

export const RARITY_TIERS: RarityTier[] = [
  { name: 'Common', color: STATUS_MUTED, weight: 50 },
  { name: 'Uncommon', color: ACCENT_EMERALD, weight: 25 },
  { name: 'Rare', color: STATUS_INFO, weight: 15 },
  { name: 'Epic', color: ACCENT_VIOLET, weight: 8 },
  { name: 'Legendary', color: STATUS_WARNING, weight: 2 },
];

export const TOTAL_WEIGHT = RARITY_TIERS.reduce((sum, t) => sum + t.weight, 0);

/* -- World item examples per rarity --------------------------------------- */

export const WORLD_ITEMS = [
  { name: 'Iron Sword', rarity: 'Common', beamColor: STATUS_MUTED, pickup: 'Auto-pickup on overlap' },
  { name: 'Forest Bow', rarity: 'Uncommon', beamColor: ACCENT_EMERALD, pickup: 'Prompt on interact' },
  { name: 'Azure Staff', rarity: 'Rare', beamColor: STATUS_INFO, pickup: 'Highlight + prompt' },
  { name: 'Shadow Cloak', rarity: 'Epic', beamColor: ACCENT_VIOLET, pickup: 'Prompt + SFX' },
  { name: 'Sunfire Amulet', rarity: 'Legendary', beamColor: STATUS_WARNING, pickup: 'Beam + VFX + fanfare' },
];

/* -- Feature names for this module ---------------------------------------- */

export const LOOT_FEATURES = [
  'UARPGLootTable',
  'Weighted random selection',
  'AARPGWorldItem',
  'Loot drop on death',
  'Item pickup',
  'Loot visual feedback',
  'Chest/container actors',
];

/* -- 7.1 Treemap static data --------------------------------------------- */

export interface TreemapRect {
  name: string;
  probability: number;
  color: string;
  affixes: string[];
}

export const TREEMAP_DATA: TreemapRect[] = [
  { name: 'Common', probability: 50, color: STATUS_MUTED, affixes: ['Sturdy', 'Worn', 'Basic', 'Plain'] },
  { name: 'Uncommon', probability: 25, color: ACCENT_EMERALD, affixes: ['Keen', 'Swift', 'Reinforced'] },
  { name: 'Rare', probability: 15, color: STATUS_INFO, affixes: ['Blazing', 'Frozen', 'Vampiric'] },
  { name: 'Epic', probability: 8, color: ACCENT_VIOLET, affixes: ['Celestial', 'Void-touched'] },
  { name: 'Legendary', probability: 2, color: STATUS_WARNING, affixes: ['Godslayer'] },
];

/* -- 7.3 Loot Table Diff data --------------------------------------------- */

export const LOOT_DIFF_ENTRIES: DiffEntry[] = [
  { field: 'Common weight', oldValue: 50, newValue: 35, changeType: 'changed' },
  { field: 'Uncommon weight', oldValue: 25, newValue: 25, changeType: 'unchanged' },
  { field: 'Rare weight', oldValue: 15, newValue: 20, changeType: 'changed' },
  { field: 'Epic weight', oldValue: 8, newValue: 15, changeType: 'changed' },
  { field: 'Legendary weight', oldValue: 2, newValue: 5, changeType: 'changed' },
];

/* -- 7.4 Expected Drops data ---------------------------------------------- */

export const DROPS_PER_HOUR_GAUGE: GaugeMetric = { label: 'Items/Hour', current: 45, target: 60, unit: '/hr' };
export const GOLD_PER_HOUR_GAUGE: GaugeMetric = { label: 'Gold/Hour', current: 2300, target: 3000, unit: 'g' };

export const DROP_SOURCE_BREAKDOWN = [
  { source: 'Grunt', pct: 40, color: STATUS_MUTED },
  { source: 'Caster', pct: 30, color: STATUS_INFO },
  { source: 'Boss', pct: 20, color: ACCENT_VIOLET },
  { source: 'Chest', pct: 10, color: STATUS_WARNING },
];

/* -- 7.5 Affix data ------------------------------------------------------- */

export const AFFIX_POOL = [
  'Blazing', 'Frozen', 'Vampiric', 'Swift', 'Sturdy', 'Keen', 'Celestial', 'Void-touched',
  'Thorned', 'Lucky', 'Empowered', 'Berserker',
];

export const AFFIX_COOCCURRENCE_ROWS = ['Blazing', 'Frozen', 'Vampiric', 'Swift'];
export const AFFIX_COOCCURRENCE_COLS = ['Keen', 'Sturdy', 'Lucky', 'Thorned'];

export const AFFIX_COOCCURRENCE_CELLS: HeatmapCell[] = [
  { row: 0, col: 0, value: 0.8, label: '80%' }, { row: 0, col: 1, value: 0.3, label: '30%' }, { row: 0, col: 2, value: 0.5, label: '50%' }, { row: 0, col: 3, value: 0.2, label: '20%' },
  { row: 1, col: 0, value: 0.4, label: '40%' }, { row: 1, col: 1, value: 0.6, label: '60%' }, { row: 1, col: 2, value: 0.3, label: '30%' }, { row: 1, col: 3, value: 0.7, label: '70%' },
  { row: 2, col: 0, value: 0.2, label: '20%' }, { row: 2, col: 1, value: 0.5, label: '50%' }, { row: 2, col: 2, value: 0.9, label: '90%' }, { row: 2, col: 3, value: 0.1, label: '10%' },
  { row: 3, col: 0, value: 0.6, label: '60%' }, { row: 3, col: 1, value: 0.4, label: '40%' }, { row: 3, col: 2, value: 0.7, label: '70%' }, { row: 3, col: 3, value: 0.5, label: '50%' },
];

/* -- 7.6 Loot Table Editor default entries -------------------------------- */

export interface LootEditorEntry {
  id: string;
  name: string;
  weight: number;
  rarity: string;
  color: string;
  /** UE5 round-trip fields -- preserved through import->edit->export */
  minQuantity?: number;
  maxQuantity?: number;
  minRarity?: string;
  maxRarity?: string;
}

export const DEFAULT_EDITOR_ENTRIES: LootEditorEntry[] = [
  { id: 'e1', name: 'Iron Sword', weight: 35, rarity: 'Common', color: STATUS_MUTED },
  { id: 'e2', name: 'Forest Bow', weight: 25, rarity: 'Uncommon', color: ACCENT_EMERALD },
  { id: 'e3', name: 'Azure Staff', weight: 20, rarity: 'Rare', color: STATUS_INFO },
  { id: 'e4', name: 'Shadow Cloak', weight: 15, rarity: 'Epic', color: ACCENT_VIOLET },
  { id: 'e5', name: 'Sunfire Amulet', weight: 5, rarity: 'Legendary', color: STATUS_WARNING },
];

export const RARITY_COLOR_MAP: Record<string, string> = {
  Common: STATUS_MUTED,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

export const RARITY_ENUM_VALUES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/* -- 7.7b Drought Streak data --------------------------------------------- */

export const DROUGHT_RARITY_OPTIONS = RARITY_TIERS.map(t => ({
  name: t.name,
  color: t.color,
  dropRate: t.weight / TOTAL_WEIGHT,
}));

/* -- Re-export binding/economy/UE5 data from split file ------------------- */

export {
  BEACON_CONFIGS, ECONOMY_SURPLUS, SMART_LOOT_DATA,
  DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD,
} from './data-binding';

export type {
  BeaconConfig, SmartLootSlot, EnemyLootBinding, EVResult,
  UE5LootEntry, UE5LootTableJson, SimulatedDrop,
} from './data-binding';
