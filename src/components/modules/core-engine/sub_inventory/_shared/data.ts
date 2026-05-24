import {
  STATUS_ERROR, ACCENT_EMERALD, ACCENT_PURPLE, RARITY_COLORS,
} from '@/lib/chart-colors';
import { Package, FlaskConical, TrendingUp } from 'lucide-react';
import type { LoadoutSlot } from '@/types/unique-tab-improvements';
import type { EntityMetadata } from '@/types/game-metadata';
import { EXPANDED_ITEMS } from './data-items';

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
export { RARITY_ORDER } from './data-items';

/* ── Accent ────────────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_EMERALD;

/* ── Subtab types & definitions ──────────────────────────────────────── */

export type ItemCatalogSubtab = 'features' | 'catalog-gear' | 'economy-sourcing' | 'mechanics-scaling';

export interface ItemCatalogSubtabDef {
  key: ItemCatalogSubtab;
  label: string;
  icon: typeof Package;
  narrative: string;
  subtitle: string;
}

export const SUBTABS: ItemCatalogSubtabDef[] = [
  { key: 'catalog-gear', label: 'Catalog & Gear', icon: Package, narrative: 'Browse Items', subtitle: 'Item grid, gear loadout, affix slots & trading card preview' },
  { key: 'economy-sourcing', label: 'Economy & Sourcing', icon: FlaskConical, narrative: 'Track Economy', subtitle: 'Crafting recipes, drop sources, inventory breakdown & rarity distribution' },
  { key: 'mechanics-scaling', label: 'Mechanics & Scaling', icon: TrendingUp, narrative: 'Understand Scaling', subtitle: 'Power budgets, affix probability trees & stat scaling curves' },
];

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
  type: 'Weapon' | 'Armor' | 'Accessory' | 'Consumable' | 'Quest' | 'Material';
  subtype: string;
  rarity: string;
  stats: { label: string; value: string; numericValue?: number; maxValue?: number }[];
  description: string;
  effect?: string;
  imagePath?: string;
  affixes?: ItemAffix[];
}

/* ── Dummy Items ───────────────────────────────────────────────────────── */

const _ORIGINAL_ITEMS: ItemData[] = [
  { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [{ label: 'Damage', value: '12-18', numericValue: 15, maxValue: 50 }, { label: 'Speed', value: '1.2s', numericValue: 48, maxValue: 100 }], description: 'A standard issue longsword.' },
  { id: '2', name: 'Ranger\'s Bow', type: 'Weapon', subtype: 'Bow', rarity: 'Uncommon', stats: [{ label: 'Damage', value: '15-22', numericValue: 18, maxValue: 50 }, { label: 'Range', value: '25m', numericValue: 62, maxValue: 100 }], description: 'A sturdy bow made of yew.', affixes: [{ name: 'of Precision', stat: '+3% Crit Chance', category: 'offensive' }] },
  { id: '3', name: 'Crystal Staff', type: 'Weapon', subtype: 'Staff', rarity: 'Rare', stats: [{ label: 'M. Atk', value: '25-35', numericValue: 30, maxValue: 50 }, { label: 'Mana Regen', value: '+5/s', numericValue: 50, maxValue: 100 }], description: 'Pulsing with arcane energy.', effect: 'Spells cost 10% less mana.', affixes: [{ name: 'Blazing', stat: '+Fire Damage', category: 'offensive' }, { name: 'of Fortitude', stat: '+200 Max HP', category: 'defensive' }] },
  { id: '4', name: 'Steel Chestplate', type: 'Armor', subtype: 'Chestplate', rarity: 'Uncommon', stats: [{ label: 'Armor', value: '45', numericValue: 45, maxValue: 100 }, { label: 'Weight', value: 'Heavy', numericValue: 80, maxValue: 100 }], description: 'Solid protection for the frontline.', affixes: [{ name: 'of the Bear', stat: '+5% Max HP', category: 'defensive' }] },
  { id: '5', name: 'Assassin\'s Cowl', type: 'Armor', subtype: 'Helm', rarity: 'Epic', stats: [{ label: 'Armor', value: '15', numericValue: 15, maxValue: 100 }, { label: 'Crit Chance', value: '+5%', numericValue: 50, maxValue: 100 }], description: 'Cloaks the wearer in shadows.', effect: 'Stealth detection reduced by 20%.', affixes: [{ name: 'Vampiric', stat: '+8% Life Steal', category: 'offensive' }, { name: 'of Evasion', stat: '+12% Dodge', category: 'defensive' }, { name: 'Swift', stat: '+5% Move Speed', category: 'utility' }] },
  { id: '6', name: 'Sunfire Amulet', type: 'Consumable', subtype: 'Elixir', rarity: 'Legendary', stats: [{ label: 'Uses', value: '1', numericValue: 100, maxValue: 100 }], description: 'Contains the essence of a dying star.', effect: 'Grants immunity to Fire damage for 60s.', affixes: [{ name: 'of Legends', stat: '+2 All Skills', category: 'utility' }] },
  { id: '7', name: 'Minor Health Potion', type: 'Consumable', subtype: 'Potion', rarity: 'Common', stats: [{ label: 'Heal', value: '50 HP', numericValue: 25, maxValue: 100 }], description: 'A basic healing draft.' },
  { id: '8', name: 'Void Daggers', type: 'Weapon', subtype: 'Dagger', rarity: 'Legendary', stats: [{ label: 'Damage', value: '35-45', numericValue: 40, maxValue: 50 }, { label: 'Speed', value: '0.8s', numericValue: 80, maxValue: 100 }], description: 'Forged in the abyss.', effect: 'Attacks tear reality, ignoring 20% armor.', affixes: [{ name: 'Vampiric', stat: '+8% Life Steal', category: 'offensive' }, { name: 'of Power', stat: '+15% Atk Power', category: 'offensive' }, { name: 'of Legends', stat: '+2 All Skills', category: 'utility' }] },
  /* ── KOTOR Melee Weapons ──────────────────────────────────────────────── */
  {
    id: 'kotor-vibroblade', name: 'Vibroblade', type: 'Weapon', subtype: 'Sword', rarity: 'Common',
    stats: [
      { label: 'Physical Damage', value: '8-14', numericValue: 11, maxValue: 50 },
      { label: 'Attack Speed', value: '1.4', numericValue: 14, maxValue: 20 },
      { label: 'Armor Penetration', value: '15%', numericValue: 15, maxValue: 100 },
    ],
    description: 'Standard melee weapon using ultrasonic vibrations to increase cutting power.',
    effect: '+15% armor penetration',
  },
  {
    id: 'kotor-vibrosword', name: 'Vibrosword', type: 'Weapon', subtype: 'Sword', rarity: 'Uncommon',
    stats: [
      { label: 'Physical Damage', value: '12-20', numericValue: 16, maxValue: 50 },
      { label: 'Attack Speed', value: '1.6', numericValue: 16, maxValue: 20 },
      { label: 'Critical Hit', value: '19-20', numericValue: 10, maxValue: 100 },
    ],
    description: 'A heavier vibration blade with increased damage output and threat range.',
    effect: 'Keen: expanded critical threat range 19-20',
  },
  {
    id: 'kotor-double-vibrosword', name: 'Double-Bladed Vibrosword', type: 'Weapon', subtype: 'Sword', rarity: 'Uncommon',
    stats: [
      { label: 'Physical Damage', value: '10-18', numericValue: 14, maxValue: 50 },
      { label: 'Attack Speed', value: '1.3', numericValue: 13, maxValue: 20 },
      { label: 'Off-Hand Bonus', value: '+4', numericValue: 20, maxValue: 100 },
    ],
    description: 'Double-ended vibroblade allowing rapid alternating strikes.',
    effect: 'Balanced: reduces two-weapon fighting penalty by 2',
  },
  {
    id: 'kotor-stun-baton', name: 'Stun Baton', type: 'Weapon', subtype: 'Baton', rarity: 'Common',
    stats: [
      { label: 'Physical Damage', value: '6-10', numericValue: 8, maxValue: 50 },
      { label: 'Attack Speed', value: '1.2', numericValue: 12, maxValue: 20 },
      { label: 'Stun Chance', value: '25%', numericValue: 25, maxValue: 100 },
    ],
    description: 'Electrified baton that delivers incapacitating shocks on contact.',
    effect: '25% chance to stun target for 6s on hit',
  },
  {
    id: 'kotor-gaderffii', name: 'Gaderffii Stick', type: 'Weapon', subtype: 'Polearm', rarity: 'Common',
    stats: [
      { label: 'Physical Damage', value: '10-16', numericValue: 13, maxValue: 50 },
      { label: 'Attack Speed', value: '1.8', numericValue: 18, maxValue: 20 },
      { label: 'Knockback', value: '10%', numericValue: 10, maxValue: 100 },
    ],
    description: 'Traditional weapon of the Tusken Raiders, tipped with a durasteel head.',
    effect: '10% chance to knock target back 3m',
  },
  {
    id: 'kotor-gamorrean-axe', name: 'Gamorrean Battleaxe', type: 'Weapon', subtype: 'Axe', rarity: 'Uncommon',
    stats: [
      { label: 'Physical Damage', value: '14-22', numericValue: 18, maxValue: 50 },
      { label: 'Attack Speed', value: '2.0', numericValue: 20, maxValue: 20 },
      { label: 'Armor Penetration', value: '20%', numericValue: 20, maxValue: 100 },
    ],
    description: 'Crude but devastatingly heavy axe favored by Gamorrean guards.',
    effect: '+20% armor penetration, -1 attack modifier',
  },
  {
    id: 'kotor-echani-foil', name: 'Echani Foil', type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
    stats: [
      { label: 'Physical Damage', value: '11-17', numericValue: 14, maxValue: 50 },
      { label: 'Attack Speed', value: '1.1', numericValue: 11, maxValue: 20 },
      { label: 'Critical Hit', value: '18-20', numericValue: 15, maxValue: 100 },
    ],
    description: 'Elegant weapon crafted by Echani martial artists for precision combat.',
    effect: 'Keen: expanded critical threat range 18-20, +2 Dexterity bonus to attack',
  },
  {
    id: 'kotor-baccas-blade', name: "Bacca's Ceremonial Blade", type: 'Weapon', subtype: 'Sword', rarity: 'Epic',
    stats: [
      { label: 'Physical Damage', value: '18-28', numericValue: 23, maxValue: 50 },
      { label: 'Attack Speed', value: '1.7', numericValue: 17, maxValue: 20 },
      { label: 'Bonus Damage vs Beasts', value: '+6', numericValue: 30, maxValue: 100 },
    ],
    description: 'Ancient Wookiee blade carried by Chieftain Bacca, revered on Kashyyyk.',
    effect: '+6 bonus damage vs beasts, grants Wookiee Fury passive',
    affixes: [{ name: 'of the Chieftain', stat: '+4 Strength', category: 'offensive' }],
  },
  {
    id: 'kotor-tremor-sword', name: 'Sith Tremor Sword', type: 'Weapon', subtype: 'Sword', rarity: 'Epic',
    stats: [
      { label: 'Physical Damage', value: '20-30', numericValue: 25, maxValue: 50 },
      { label: 'Attack Speed', value: '1.9', numericValue: 19, maxValue: 20 },
      { label: 'Dark Side Bonus', value: '+5', numericValue: 25, maxValue: 100 },
    ],
    description: 'Sith-forged blade that resonates with dark side energy, causing tremors on impact.',
    effect: 'Massive Criticals 2-12, +5 dark side damage bonus',
    affixes: [{ name: 'of the Sith', stat: '+3 Dark Side Damage', category: 'offensive' }, { name: 'Unstoppable', stat: '+2 Attack', category: 'offensive' }],
  },
  {
    id: 'kotor-ajunta-pall', name: "Ajunta Pall's Blade", type: 'Weapon', subtype: 'Sword', rarity: 'Legendary',
    stats: [
      { label: 'Physical Damage', value: '22-34', numericValue: 28, maxValue: 50 },
      { label: 'Attack Speed', value: '1.8', numericValue: 18, maxValue: 20 },
      { label: 'Force Damage', value: '+8', numericValue: 40, maxValue: 100 },
    ],
    description: 'Legendary blade of the first Dark Lord of the Sith, recovered from his tomb on Korriban.',
    effect: '+8 Force damage, Massive Criticals 2-20, immune to mind-affecting effects',
    affixes: [{ name: 'of the Dark Lord', stat: '+5 Dark Side Damage', category: 'offensive' }, { name: 'Vampiric', stat: '+3 HP on hit', category: 'offensive' }, { name: 'of Legends', stat: '+2 All Skills', category: 'utility' }],
  },
];

export const DUMMY_ITEMS: ItemData[] = [..._ORIGINAL_ITEMS, ...EXPANDED_ITEMS];

/* ── Slot-to-subtype mapping ───────────────────────────────────────────── */

export const SLOT_SUBTYPES: Record<string, string[]> = {
  Head: ['Helm'], Chest: ['Chestplate'], Legs: ['Greaves'], Feet: ['Boots'],
  Hands: ['Gauntlets'], MainHand: ['Sword', 'Bow', 'Staff', 'Dagger', 'Axe', 'Mace', 'Polearm', 'Baton'],
  OffHand: ['Shield', 'Dagger'], Ring: ['Ring'], Amulet: ['Amulet'], Belt: ['Belt'],
};

/* ── All item types (for dynamic filters) ────────────────────────────────── */

export const ALL_ITEM_TYPES: ItemData['type'][] = ['Weapon', 'Armor', 'Accessory', 'Consumable', 'Quest', 'Material'];

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
  {
    name: 'Mandalorian Arsenal',
    color: STATUS_ERROR,
    pieces: [
      { slot: 'MainHand', name: 'Mandalorian War Sword', owned: true },
      { slot: 'Chest', name: 'Mandalorian Breastplate', owned: true },
      { slot: 'Head', name: 'Mandalorian Helmet', owned: true },
      { slot: 'Feet', name: 'Mandalorian Boots', owned: false },
    ],
    bonuses: [
      { pieces: 2, description: '+10% Armor Penetration' },
      { pieces: 3, description: '+15% Physical Damage' },
      { pieces: 4, description: 'Beskar Resilience: -25% incoming damage' },
    ],
  },
  {
    name: 'Shadow Walker',
    color: ACCENT_PURPLE,
    pieces: [
      { slot: 'MainHand', name: 'Shadow Fang', owned: true },
      { slot: 'Head', name: 'Sith Lord Mask', owned: false },
      { slot: 'Legs', name: 'Shadowweave Trousers', owned: false },
      { slot: 'Feet', name: 'Swiftstrider Boots', owned: true },
    ],
    bonuses: [
      { pieces: 2, description: '+10% Stealth Damage' },
      { pieces: 3, description: '+20% Critical Chance' },
      { pieces: 4, description: 'Shadow Step: teleport behind target on crit' },
    ],
  },
  {
    name: 'Force Master Regalia',
    color: ACCENT_EMERALD,
    pieces: [
      { slot: 'MainHand', name: 'Staff of the Ancients', owned: false },
      { slot: 'Head', name: 'Crown of the Force', owned: false },
      { slot: 'Chest', name: 'Star Forge Cuirass', owned: true },
    ],
    bonuses: [
      { pieces: 2, description: '+25% Force Regen' },
      { pieces: 3, description: 'All Force abilities cost 0 for 5s after a kill' },
    ],
  },
  {
    name: 'Echani Duelist',
    color: RARITY_COLORS.Rare,
    pieces: [
      { slot: 'MainHand', name: 'Echani Ritual Dagger', owned: true },
      { slot: 'Chest', name: 'Echani Light Plate', owned: true },
      { slot: 'Feet', name: 'Swiftstrider Boots', owned: false },
    ],
    bonuses: [
      { pieces: 2, description: '+8% Attack Speed' },
      { pieces: 3, description: 'Echani Flow: each consecutive hit +3% damage' },
    ],
  },
];

/* ── Entity Metadata ─────────────────────────────────────────────────────── */

export const ITEM_METADATA: EntityMetadata[] = DUMMY_ITEMS.map(item => ({
  id: item.id,
  name: item.name,
  category: item.type,
  subcategory: item.subtype,
  tags: [...new Set([
    item.rarity.toLowerCase(),
    item.type.toLowerCase(),
    item.subtype.toLowerCase().replace(/\s+/g, '-'),
    ...(item.affixes?.map(a => a.category) ?? []),
    ...(item.effect ? ['has-effect'] : []),
    ...(item.rarity === 'Legendary' || item.rarity === 'Epic' ? ['high-value'] : []),
  ])],
  tier: item.rarity,
}));
