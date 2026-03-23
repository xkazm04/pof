import {
  STATUS_ERROR, ACCENT_EMERALD, ACCENT_PURPLE, RARITY_COLORS,
} from '@/lib/chart-colors';
import type { LoadoutSlot } from '@/types/unique-tab-improvements';

/* ── Re-exports from split data files ─────────────────────────────────── */

export { RARITY_COLORS };
export { COMPARABLE_ITEMS, computeEffectiveDPS } from './data-comparison';
export type { ComparableItem, ComparisonStat } from './data-comparison';
export {
  SAMPLE_RECIPE, CRYSTAL_STAFF_SOURCES,
  INVENTORY_GROUPS, INVENTORY_TOTAL, INVENTORY_USED, INVENTORY_GOLD_VALUE,
  INVENTORY_BY_RARITY, CLEANUP_SUGGESTIONS,
  RARITY_DIST, LUCK_SCORE,
} from './data-economy';
export type { CraftMaterial, CraftRecipe, DropSource, InventorySlotGroup, RarityDistEntry } from './data-economy';
export {
  POWER_BUDGET_AXES, IRON_LONGSWORD_RADAR, VOID_DAGGERS_RADAR,
  AFFIX_PROB_TREE, SCALING_LINES,
} from './data-mechanics';
export type { ScalingLine } from './data-mechanics';

/* ── Accent ────────────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_EMERALD;

/* ── Equipment slot layout ─────────────────────────────────────────────── */

export interface SlotConfig { id: string; label: string; featureName: string }

export const EQUIPMENT_SLOTS: SlotConfig[] = [
  { id: 'Head', label: 'Head', featureName: 'Equipment slot system' },
  { id: 'Chest', label: 'Chest', featureName: 'Equipment slot system' },
  { id: 'Legs', label: 'Legs', featureName: 'Equipment slot system' },
  { id: 'Feet', label: 'Feet', featureName: 'Equipment slot system' },
  { id: 'MainHand', label: 'Main Hand', featureName: 'Equipment slot system' },
  { id: 'OffHand', label: 'Off Hand', featureName: 'Equipment slot system' },
];

/* ── Affix examples ────────────────────────────────────────────────────── */

export const AFFIX_EXAMPLES = [
  { name: 'of Power', stat: '+15% Atk Power', tier: 'Prefix', rarity: 'Uncommon' },
  { name: 'of Fortitude', stat: '+200 Max HP', tier: 'Prefix', rarity: 'Rare' },
  { name: 'Blazing', stat: '+Fire Damage', tier: 'Suffix', rarity: 'Rare' },
  { name: 'Vampiric', stat: '+8% Life Steal', tier: 'Prefix', rarity: 'Epic' },
  { name: 'of Legends', stat: '+2 All Skills', tier: 'Suffix', rarity: 'Legendary' },
];

/* ── System pipeline nodes ─────────────────────────────────────────────── */

export const SYSTEM_PIPELINE = [
  { label: 'ItemDefinition', featureName: 'UARPGItemDefinition' },
  { label: 'ItemInstance', featureName: 'UARPGItemInstance' },
  { label: 'InventoryComponent', featureName: 'UARPGInventoryComponent' },
  { label: 'EquipmentSlot', featureName: 'Equipment slot system' },
  { label: 'GAS Effect', featureName: 'Equip/unequip GAS flow' },
];

/* ── Item types ────────────────────────────────────────────────────────── */

export interface ItemAffix { name: string; stat: string; category: 'offensive' | 'defensive' | 'utility' }

export interface ItemData {
  id: string;
  name: string;
  type: 'Weapon' | 'Armor' | 'Consumable';
  subtype: string;
  rarity: string;
  stats: { label: string; value: string; numericValue?: number; maxValue?: number }[];
  description: string;
  effect?: string;
  imagePath?: string;
  affixes?: ItemAffix[];
}

/* ── Dummy Items ───────────────────────────────────────────────────────── */

export const DUMMY_ITEMS: ItemData[] = [
  { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [{ label: 'Damage', value: '12-18', numericValue: 15, maxValue: 50 }, { label: 'Speed', value: '1.2s', numericValue: 48, maxValue: 100 }], description: 'A standard issue longsword.' },
  { id: '2', name: 'Ranger\'s Bow', type: 'Weapon', subtype: 'Bow', rarity: 'Uncommon', stats: [{ label: 'Damage', value: '15-22', numericValue: 18, maxValue: 50 }, { label: 'Range', value: '25m', numericValue: 62, maxValue: 100 }], description: 'A sturdy bow made of yew.', affixes: [{ name: 'of Precision', stat: '+3% Crit Chance', category: 'offensive' }] },
  { id: '3', name: 'Crystal Staff', type: 'Weapon', subtype: 'Staff', rarity: 'Rare', stats: [{ label: 'M. Atk', value: '25-35', numericValue: 30, maxValue: 50 }, { label: 'Mana Regen', value: '+5/s', numericValue: 50, maxValue: 100 }], description: 'Pulsing with arcane energy.', effect: 'Spells cost 10% less mana.', affixes: [{ name: 'Blazing', stat: '+Fire Damage', category: 'offensive' }, { name: 'of Fortitude', stat: '+200 Max HP', category: 'defensive' }] },
  { id: '4', name: 'Steel Chestplate', type: 'Armor', subtype: 'Chestplate', rarity: 'Uncommon', stats: [{ label: 'Armor', value: '45', numericValue: 45, maxValue: 100 }, { label: 'Weight', value: 'Heavy', numericValue: 80, maxValue: 100 }], description: 'Solid protection for the frontline.', affixes: [{ name: 'of the Bear', stat: '+5% Max HP', category: 'defensive' }] },
  { id: '5', name: 'Assassin\'s Cowl', type: 'Armor', subtype: 'Helm', rarity: 'Epic', stats: [{ label: 'Armor', value: '15', numericValue: 15, maxValue: 100 }, { label: 'Crit Chance', value: '+5%', numericValue: 50, maxValue: 100 }], description: 'Cloaks the wearer in shadows.', effect: 'Stealth detection reduced by 20%.', affixes: [{ name: 'Vampiric', stat: '+8% Life Steal', category: 'offensive' }, { name: 'of Evasion', stat: '+12% Dodge', category: 'defensive' }, { name: 'Swift', stat: '+5% Move Speed', category: 'utility' }] },
  { id: '6', name: 'Sunfire Amulet', type: 'Consumable', subtype: 'Elixir', rarity: 'Legendary', stats: [{ label: 'Uses', value: '1', numericValue: 100, maxValue: 100 }], description: 'Contains the essence of a dying star.', effect: 'Grants immunity to Fire damage for 60s.', affixes: [{ name: 'of Legends', stat: '+2 All Skills', category: 'utility' }] },
  { id: '7', name: 'Minor Health Potion', type: 'Consumable', subtype: 'Potion', rarity: 'Common', stats: [{ label: 'Heal', value: '50 HP', numericValue: 25, maxValue: 100 }], description: 'A basic healing draft.' },
  { id: '8', name: 'Void Daggers', type: 'Weapon', subtype: 'Dagger', rarity: 'Legendary', stats: [{ label: 'Damage', value: '35-45', numericValue: 40, maxValue: 50 }, { label: 'Speed', value: '0.8s', numericValue: 80, maxValue: 100 }], description: 'Forged in the abyss.', effect: 'Attacks tear reality, ignoring 20% armor.', affixes: [{ name: 'Vampiric', stat: '+8% Life Steal', category: 'offensive' }, { name: 'of Power', stat: '+15% Atk Power', category: 'offensive' }, { name: 'of Legends', stat: '+2 All Skills', category: 'utility' }] },
];

/* ── 6.3 Equipment Loadout Data ──────────────────────────────────────── */

export const LOADOUT_SLOTS: LoadoutSlot[] = [
  { slotId: 'Head', slotName: 'Head', item: { name: "Assassin's Cowl", rarity: 'Epic', stats: { Armor: 15, CritChance: 5 } }, isEmpty: false },
  { slotId: 'Chest', slotName: 'Chest', item: { name: 'Steel Chestplate', rarity: 'Uncommon', stats: { Armor: 45 } }, isEmpty: false },
  { slotId: 'Legs', slotName: 'Legs', isEmpty: true },
  { slotId: 'Feet', slotName: 'Feet', isEmpty: true },
  { slotId: 'MainHand', slotName: 'Main Hand', item: { name: 'Void Daggers', rarity: 'Legendary', stats: { Damage: 40, Speed: 8 } }, isEmpty: false },
  { slotId: 'OffHand', slotName: 'Off Hand', isEmpty: true },
];

export const LOADOUT_SLOT_POSITIONS: Record<string, { x: number; y: number }> = {
  Head: { x: 85, y: 10 },
  Chest: { x: 85, y: 60 },
  Legs: { x: 85, y: 110 },
  Feet: { x: 85, y: 155 },
  MainHand: { x: 15, y: 80 },
  OffHand: { x: 155, y: 80 },
};

/* ── 6.8 Set Bonus Data ──────────────────────────────────────────────── */

export interface SetBonus { pieces: number; description: string }
export interface ItemSet {
  name: string;
  color: string;
  pieces: { slot: string; name: string; owned: boolean }[];
  bonuses: SetBonus[];
}

export const ITEM_SETS: ItemSet[] = [
  {
    name: "Warrior's Resolve",
    color: STATUS_ERROR,
    pieces: [
      { slot: 'Chest', name: 'Resolve Chestplate', owned: true },
      { slot: 'Head', name: 'Resolve Helm', owned: true },
      { slot: 'Legs', name: 'Resolve Greaves', owned: false },
    ],
    bonuses: [
      { pieces: 2, description: '+10% Armor' },
      { pieces: 3, description: '+25% Max HP' },
    ],
  },
  {
    name: 'Arcane Scholar',
    color: ACCENT_PURPLE,
    pieces: [
      { slot: 'MainHand', name: 'Scholar Staff', owned: true },
      { slot: 'Amulet', name: 'Scholar Amulet', owned: true },
    ],
    bonuses: [{ pieces: 2, description: '+20% Mana' }],
  },
];
