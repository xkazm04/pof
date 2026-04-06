import { ACCENT_EMERALD, ACCENT_ORANGE, STATUS_MUTED, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';
import type { GaugeMetric, DiffEntry, HeatmapCell } from '@/types/unique-tab-improvements';
import type { EntityMetadata } from '@/types/game-metadata';
import { Layers, FlaskConical, Dices, Shield, DollarSign } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ACCENT = ACCENT_ORANGE;

/* ── Subtab definitions with narrative flow ──────────────────────────── */

export type LootSubtab = 'features' | 'core' | 'simulation' | 'affix' | 'pity' | 'economy';

export interface LootSubtabDef {
  key: LootSubtab;
  label: string;
  icon: LucideIcon;
  narrative: string;
  subtitle: string;
}

export const LOOT_SUBTABS: LootSubtabDef[] = [
  { key: 'core', label: 'Core', icon: Layers, narrative: 'Define Drops', subtitle: 'Loot tables, weight distribution, world items & enemy bindings' },
  { key: 'simulation', label: 'Simulation', icon: FlaskConical, narrative: 'Simulate', subtitle: 'Drop treemaps, Monte Carlo runs, diff analysis & drops-per-hour' },
  { key: 'affix', label: 'Affix', icon: Dices, narrative: 'Roll Affixes', subtitle: 'Affix roll simulator & loot table editor' },
  { key: 'pity', label: 'Pity', icon: Shield, narrative: 'Ensure Fairness', subtitle: 'Pity timer thresholds & drought probability calculator' },
  { key: 'economy', label: 'Economy', icon: DollarSign, narrative: 'Economy', subtitle: 'Beacon visualizer, economy impact & smart loot tuning' },
];

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

export interface AffixDef {
  id: string;
  name: string;
  category: 'Offensive' | 'Defensive' | 'Utility';
  tier: number; // 1-3
  weight: number;
  description: string;
  [key: string]: unknown;
}

export const AFFIX_DEFS: AffixDef[] = [
  // Offensive (12)
  { id: 'blazing', name: 'Blazing', category: 'Offensive', tier: 2, weight: 15, description: '+Fire damage on hit' },
  { id: 'frozen', name: 'Frozen', category: 'Offensive', tier: 2, weight: 12, description: '+Ice damage, chance to slow' },
  { id: 'keen', name: 'Keen', category: 'Offensive', tier: 1, weight: 20, description: '+Critical hit chance' },
  { id: 'berserker', name: 'Berserker', category: 'Offensive', tier: 3, weight: 5, description: '+Damage at low HP' },
  { id: 'empowered', name: 'Empowered', category: 'Offensive', tier: 2, weight: 14, description: '+Ability damage %' },
  { id: 'vicious', name: 'Vicious', category: 'Offensive', tier: 2, weight: 13, description: '+Critical damage multiplier' },
  { id: 'devastating', name: 'Devastating', category: 'Offensive', tier: 3, weight: 4, description: '+Armor penetration' },
  { id: 'electrified', name: 'Electrified', category: 'Offensive', tier: 2, weight: 11, description: '+Lightning damage, chain hits' },
  { id: 'venomous', name: 'Venomous', category: 'Offensive', tier: 1, weight: 18, description: '+Poison DOT on hit' },
  { id: 'savage', name: 'Savage', category: 'Offensive', tier: 1, weight: 22, description: '+Base attack damage' },
  { id: 'executioner', name: 'Executioner', category: 'Offensive', tier: 3, weight: 3, description: '+Damage vs low-HP targets' },
  { id: 'arcane', name: 'Arcane', category: 'Offensive', tier: 2, weight: 10, description: '+Magic damage scaling' },
  // Defensive (11)
  { id: 'sturdy', name: 'Sturdy', category: 'Defensive', tier: 1, weight: 20, description: '+Armor rating' },
  { id: 'thorned', name: 'Thorned', category: 'Defensive', tier: 2, weight: 12, description: 'Reflects damage on hit' },
  { id: 'vampiric', name: 'Vampiric', category: 'Defensive', tier: 2, weight: 14, description: 'Life steal on hit' },
  { id: 'warding', name: 'Warding', category: 'Defensive', tier: 2, weight: 13, description: '+Magic resistance' },
  { id: 'fortified', name: 'Fortified', category: 'Defensive', tier: 3, weight: 5, description: '+Max HP %' },
  { id: 'regenerating', name: 'Regenerating', category: 'Defensive', tier: 1, weight: 18, description: '+HP regen per second' },
  { id: 'shielded', name: 'Shielded', category: 'Defensive', tier: 2, weight: 11, description: 'Absorb shield on hit taken' },
  { id: 'resilient', name: 'Resilient', category: 'Defensive', tier: 1, weight: 16, description: '+Crowd control resistance' },
  { id: 'adaptive', name: 'Adaptive', category: 'Defensive', tier: 3, weight: 4, description: 'Resist last damage type taken' },
  { id: 'bulwark', name: 'Bulwark', category: 'Defensive', tier: 3, weight: 3, description: '+Block chance and value' },
  { id: 'enduring', name: 'Enduring', category: 'Defensive', tier: 1, weight: 19, description: '+Stamina efficiency' },
  // Utility (12)
  { id: 'swift', name: 'Swift', category: 'Utility', tier: 1, weight: 20, description: '+Movement speed' },
  { id: 'lucky', name: 'Lucky', category: 'Utility', tier: 2, weight: 14, description: '+Magic find %' },
  { id: 'celestial', name: 'Celestial', category: 'Utility', tier: 3, weight: 3, description: '+XP gain %' },
  { id: 'void-touched', name: 'Void-touched', category: 'Utility', tier: 3, weight: 2, description: 'Chance to phase through attacks' },
  { id: 'prosperous', name: 'Prosperous', category: 'Utility', tier: 1, weight: 18, description: '+Gold find %' },
  { id: 'efficient', name: 'Efficient', category: 'Utility', tier: 1, weight: 17, description: '-Cooldown reduction' },
  { id: 'bountiful', name: 'Bountiful', category: 'Utility', tier: 2, weight: 12, description: '+Area of effect radius' },
  { id: 'whispering', name: 'Whispering', category: 'Utility', tier: 2, weight: 11, description: '+Threat reduction' },
  { id: 'rallying', name: 'Rallying', category: 'Utility', tier: 2, weight: 13, description: '+Ally buff radius' },
  { id: 'harvesting', name: 'Harvesting', category: 'Utility', tier: 1, weight: 15, description: '+Material drop chance' },
  { id: 'wayfarers', name: 'Wayfarers', category: 'Utility', tier: 2, weight: 10, description: '+Dodge distance' },
  { id: 'visionary', name: 'Visionary', category: 'Utility', tier: 3, weight: 4, description: '+Detection radius for secrets' },
];

export const AFFIX_POOL = AFFIX_DEFS.map(a => a.name);

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

export type LootSource = 'enemy' | 'chest' | 'quest' | 'crafting';

export interface LootEditorEntryExpanded extends LootEditorEntry {
  source: LootSource;
  [key: string]: unknown;
}

const RARITY_TO_COLOR: Record<string, string> = {
  Common: STATUS_MUTED,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

const rc = (r: string) => RARITY_TO_COLOR[r] ?? STATUS_MUTED;

interface LootEntryRaw {
  id: string;
  name: string;
  weight: number;
  rarity: string;
  source: LootSource;
  minQuantity?: number;
  maxQuantity?: number;
  minRarity?: string;
  maxRarity?: string;
}

const LOOT_ENTRIES_RAW: LootEntryRaw[] = [
  // ── Weapons: Enemy drops ──────────────────────────────────
  { id: 'e1', name: 'Iron Sword', weight: 35, rarity: 'Common', source: 'enemy' },
  { id: 'e2', name: 'Forest Bow', weight: 25, rarity: 'Uncommon', source: 'enemy' },
  { id: 'e3', name: 'Azure Staff', weight: 20, rarity: 'Rare', source: 'enemy' },
  { id: 'e4', name: 'Shadow Dagger', weight: 15, rarity: 'Epic', source: 'enemy' },
  { id: 'e5', name: 'Sunfire Blade', weight: 5, rarity: 'Legendary', source: 'enemy' },
  { id: 'e6', name: 'Rusty Axe', weight: 30, rarity: 'Common', source: 'enemy' },
  { id: 'e7', name: 'Bone Club', weight: 28, rarity: 'Common', source: 'enemy' },
  { id: 'e8', name: 'Hunting Spear', weight: 22, rarity: 'Uncommon', source: 'enemy' },
  { id: 'e9', name: 'Elven Longbow', weight: 12, rarity: 'Rare', source: 'enemy' },
  { id: 'e10', name: 'Wrath Hammer', weight: 8, rarity: 'Epic', source: 'enemy' },
  { id: 'e11', name: 'Void Scythe', weight: 2, rarity: 'Legendary', source: 'enemy' },
  { id: 'e12', name: 'Copper Mace', weight: 32, rarity: 'Common', source: 'enemy' },
  { id: 'e13', name: 'Flame Whip', weight: 10, rarity: 'Rare', source: 'enemy' },
  // ── Armor: Enemy drops ────────────────────────────────────
  { id: 'a1', name: 'Leather Helm', weight: 28, rarity: 'Common', source: 'enemy' },
  { id: 'a2', name: 'Chain Mail', weight: 20, rarity: 'Uncommon', source: 'enemy' },
  { id: 'a3', name: 'Dragonscale Armor', weight: 6, rarity: 'Epic', source: 'enemy' },
  { id: 'a4', name: 'Ghostweave Cloak', weight: 14, rarity: 'Rare', source: 'enemy' },
  { id: 'a5', name: 'Iron Shield', weight: 24, rarity: 'Common', source: 'enemy' },
  { id: 'a6', name: 'Plate Greaves', weight: 18, rarity: 'Uncommon', source: 'enemy' },
  { id: 'a7', name: 'Celestial Vestments', weight: 2, rarity: 'Legendary', source: 'enemy' },
  // ── Consumables: Chest drops ──────────────────────────────
  { id: 'c1', name: 'Minor Health Potion', weight: 40, rarity: 'Common', source: 'chest', minQuantity: 1, maxQuantity: 5 },
  { id: 'c2', name: 'Major Health Potion', weight: 15, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 3 },
  { id: 'c3', name: 'Elixir of Fortitude', weight: 10, rarity: 'Rare', source: 'chest', minQuantity: 1, maxQuantity: 2 },
  { id: 'c4', name: 'Mana Crystal', weight: 22, rarity: 'Common', source: 'chest', minQuantity: 1, maxQuantity: 4 },
  { id: 'c5', name: 'Antidote Vial', weight: 18, rarity: 'Common', source: 'chest', minQuantity: 1, maxQuantity: 3 },
  { id: 'c6', name: 'Speed Potion', weight: 12, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 2 },
  { id: 'c7', name: 'Divine Ambrosia', weight: 3, rarity: 'Legendary', source: 'chest', minQuantity: 1, maxQuantity: 1 },
  { id: 'c8', name: 'Fire Bomb', weight: 16, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 3 },
  { id: 'c9', name: 'Smoke Grenade', weight: 20, rarity: 'Common', source: 'chest', minQuantity: 1, maxQuantity: 4 },
  // ── Accessories: Quest rewards ────────────────────────────
  { id: 'q1', name: 'Ruby Ring', weight: 12, rarity: 'Rare', source: 'quest' },
  { id: 'q2', name: 'Signet of the Wilds', weight: 8, rarity: 'Epic', source: 'quest' },
  { id: 'q3', name: 'Sunfire Amulet', weight: 5, rarity: 'Legendary', source: 'quest' },
  { id: 'q4', name: 'Silver Charm', weight: 18, rarity: 'Uncommon', source: 'quest' },
  { id: 'q5', name: 'Bone Talisman', weight: 25, rarity: 'Common', source: 'quest' },
  { id: 'q6', name: 'Emerald Pendant', weight: 10, rarity: 'Rare', source: 'quest' },
  { id: 'q7', name: 'Crown of Whispers', weight: 3, rarity: 'Legendary', source: 'quest' },
  { id: 'q8', name: 'Ward Bracelet', weight: 14, rarity: 'Uncommon', source: 'quest' },
  // ── Crafting materials ────────────────────────────────────
  { id: 'cr1', name: 'Iron Ore', weight: 35, rarity: 'Common', source: 'crafting', minQuantity: 1, maxQuantity: 5 },
  { id: 'cr2', name: 'Star Metal Ingot', weight: 5, rarity: 'Epic', source: 'crafting', minQuantity: 1, maxQuantity: 1 },
  { id: 'cr3', name: 'Enchanted Thread', weight: 15, rarity: 'Rare', source: 'crafting', minQuantity: 1, maxQuantity: 3 },
  { id: 'cr4', name: 'Beast Hide', weight: 28, rarity: 'Common', source: 'crafting', minQuantity: 1, maxQuantity: 4 },
  { id: 'cr5', name: 'Moonstone Dust', weight: 10, rarity: 'Rare', source: 'crafting', minQuantity: 1, maxQuantity: 2 },
  { id: 'cr6', name: 'Dragon Scale', weight: 3, rarity: 'Legendary', source: 'crafting', minQuantity: 1, maxQuantity: 1 },
  { id: 'cr7', name: 'Crystal Shard', weight: 20, rarity: 'Uncommon', source: 'crafting', minQuantity: 1, maxQuantity: 3 },
  { id: 'cr8', name: 'Shadow Essence', weight: 8, rarity: 'Epic', source: 'crafting', minQuantity: 1, maxQuantity: 1 },
  { id: 'cr9', name: 'Timber Plank', weight: 32, rarity: 'Common', source: 'crafting', minQuantity: 1, maxQuantity: 6 },
  { id: 'cr10', name: 'Arcane Flux', weight: 12, rarity: 'Uncommon', source: 'crafting', minQuantity: 1, maxQuantity: 2 },
  // ── KOTOR Loot Entries ────────────────────────────────────
  { id: 'kotor-vibroblade', name: 'Vibroblade', weight: 15, rarity: 'Common', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-vibrosword', name: 'Vibrosword', weight: 10, rarity: 'Uncommon', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-stun-baton', name: 'Stun Baton', weight: 12, rarity: 'Common', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-echani-foil', name: 'Echani Foil', weight: 3, rarity: 'Rare', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-sith-tremor', name: 'Sith Tremor Sword', weight: 2, rarity: 'Epic', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-baccas-blade', name: "Bacca's Blade", weight: 1, rarity: 'Legendary', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-ajunta-pall', name: "Ajunta Pall's Blade", weight: 1, rarity: 'Legendary', source: 'enemy', minQuantity: 1, maxQuantity: 1 },
  { id: 'kotor-medpac', name: 'Medpac', weight: 25, rarity: 'Common', source: 'chest', minQuantity: 1, maxQuantity: 3 },
  { id: 'kotor-stim-pack', name: 'Adrenal Stim', weight: 10, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 2 },
  { id: 'kotor-repair-kit', name: 'Repair Kit', weight: 8, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 2 },
  // ── Additional chest drops ────────────────────────────────
  { id: 'ch1', name: 'Gold Coin Pouch', weight: 30, rarity: 'Common', source: 'chest', minQuantity: 50, maxQuantity: 200 },
  { id: 'ch2', name: 'Mimic Tooth', weight: 6, rarity: 'Epic', source: 'chest', minQuantity: 1, maxQuantity: 1 },
  { id: 'ch3', name: 'Skeleton Key', weight: 4, rarity: 'Epic', source: 'chest', minQuantity: 1, maxQuantity: 1 },
  { id: 'ch4', name: 'Scroll of Teleport', weight: 14, rarity: 'Rare', source: 'chest', minQuantity: 1, maxQuantity: 2 },
  { id: 'ch5', name: 'Trap Kit', weight: 16, rarity: 'Uncommon', source: 'chest', minQuantity: 1, maxQuantity: 3 },
  // ── Quest unique weapons ──────────────────────────────────
  { id: 'qu1', name: 'Frostbane Greatsword', weight: 4, rarity: 'Epic', source: 'quest' },
  { id: 'qu2', name: 'Staff of the Archmage', weight: 2, rarity: 'Legendary', source: 'quest' },
  { id: 'qu3', name: 'Thunderfury Bow', weight: 6, rarity: 'Epic', source: 'quest' },
];

export const EXPANDED_ENTRIES: LootEditorEntryExpanded[] = LOOT_ENTRIES_RAW.map(e => ({
  ...e,
  color: rc(e.rarity),
} as LootEditorEntryExpanded));

/** Backwards-compat flat list (LootEditorEntry without source). */
export const DEFAULT_EDITOR_ENTRIES: LootEditorEntry[] = EXPANDED_ENTRIES;

/** All unique sources for grouping. */
export const LOOT_SOURCES: LootSource[] = ['enemy', 'chest', 'quest', 'crafting'];

export const RARITY_COLOR_MAP: Record<string, string> = {
  Common: STATUS_MUTED,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

export const RARITY_ENUM_VALUES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/* -- Entity Metadata ------------------------------------------------------ */

function lootCategory(e: LootEditorEntry): string {
  const n = e.name.toLowerCase();
  if (/sword|blade|bow|staff|foil|dagger|baton|axe|vibro/.test(n)) return 'Weapon';
  if (/medpac|stim|potion|repair|kit/.test(n)) return 'Consumable';
  if (/cloak|armor|helm|shield/.test(n)) return 'Armor';
  if (/amulet|ring|charm/.test(n)) return 'Accessory';
  return 'Misc';
}

function lootSubcategory(e: LootEditorEntry): string | undefined {
  const n = e.name.toLowerCase();
  if (/sword|blade|foil/.test(n)) return 'Sword';
  if (/bow/.test(n)) return 'Bow';
  if (/staff/.test(n)) return 'Staff';
  if (/dagger/.test(n)) return 'Dagger';
  if (/baton/.test(n)) return 'Baton';
  if (/axe/.test(n)) return 'Axe';
  if (/vibro/.test(n)) return 'Vibroblade';
  if (/medpac|potion/.test(n)) return 'Healing';
  if (/stim/.test(n)) return 'Buff';
  if (/repair|kit/.test(n)) return 'Utility';
  if (/cloak/.test(n)) return 'Light Armor';
  if (/amulet/.test(n)) return 'Amulet';
  return undefined;
}

export const LOOT_ENTRY_METADATA: EntityMetadata[] = EXPANDED_ENTRIES.map(e => {
  const cat = lootCategory(e);
  const sub = lootSubcategory(e);
  return {
    id: e.id,
    name: e.name,
    category: cat,
    subcategory: sub,
    tags: [
      e.rarity.toLowerCase(),
      cat.toLowerCase(),
      ...(sub ? [sub.toLowerCase().replace(/\s+/g, '-')] : []),
      ...(e.maxQuantity && e.maxQuantity > 1 ? ['stackable'] : []),
      ...(e.id.startsWith('kotor-') ? ['kotor'] : []),
      e.source,
    ],
    tier: e.rarity,
  };
});

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
