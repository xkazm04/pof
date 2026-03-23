import {
  Flame, Snowflake, Shield, Zap, Skull, Crown,
  Swords, Wrench, Coins, Wand2, BarChart3, Grid3X3, Code,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  STATUS_INFO, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { TraitAxis } from '@/types/item-genome';
import type { Rarity, AffixPoolEntry } from '@/lib/loot-designer/drop-simulator';
import type { SubTab } from '../_shared';

export const ACCENT = MODULE_COLORS.core;

/* -- Axis color / icon / label maps ---------------------------------------- */

export const AXIS_COLORS: Record<TraitAxis, string> = {
  offensive: STATUS_ERROR,
  defensive: ACCENT_CYAN,
  utility: ACCENT_EMERALD,
  economic: ACCENT_ORANGE,
};

export const AXIS_ICONS: Record<TraitAxis, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  offensive: Swords,
  defensive: Shield,
  utility: Wrench,
  economic: Coins,
};

export const AXIS_LABELS: Record<TraitAxis, string> = {
  offensive: 'OFF', defensive: 'DEF', utility: 'UTL', economic: 'ECO',
};

/* -- Rarity colors --------------------------------------------------------- */

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: STATUS_NEUTRAL,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

export const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/* -- Item concept presets -------------------------------------------------- */

export interface ItemConcept {
  name: string;
  displayName: string;
  type: string;
  rarity: Rarity;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  weightOverrides: Record<string, number>;
}

export const ITEM_PRESETS: ItemConcept[] = [
  {
    name: 'FireSword', displayName: 'Blazing Greatsword', type: 'Weapon',
    rarity: 'Legendary', description: 'Endgame fire-aspected melee weapon with critical devastation',
    icon: Flame, color: ACCENT_ORANGE,
    weightOverrides: {
      'aff-str': 2.5, 'aff-atk': 3.0, 'aff-crit': 2.0, 'aff-cdmg': 2.5,
      'aff-aspd': 1.5, 'aff-arm': 0.3, 'aff-hp': 0.3, 'aff-gold': 0.1,
    },
  },
  {
    name: 'FrostStaff', displayName: 'Glacial Focus', type: 'Weapon',
    rarity: 'Epic', description: 'Mid-tier caster staff with mana efficiency and cooldown reduction',
    icon: Snowflake, color: ACCENT_CYAN,
    weightOverrides: {
      'aff-mana': 3.0, 'aff-mregen': 2.5, 'aff-cdr': 2.5, 'aff-crit': 1.5,
      'aff-str': 0.2, 'aff-atk': 0.3, 'aff-arm': 0.5,
    },
  },
  {
    name: 'TankPlate', displayName: 'Bulwark Plate', type: 'Armor',
    rarity: 'Legendary', description: 'Heavy endgame plate armor maximizing survivability',
    icon: Shield, color: ACCENT_CYAN,
    weightOverrides: {
      'aff-arm': 3.5, 'aff-hp': 3.0, 'aff-regen': 2.5, 'aff-dodge': 1.0,
      'aff-str': 0.5, 'aff-atk': 0.2, 'aff-crit': 0.1,
    },
  },
  {
    name: 'AssassinDagger', displayName: 'Viper Fang', type: 'Weapon',
    rarity: 'Rare', description: 'Fast crit-focused dagger for agile builds',
    icon: Zap, color: ACCENT_EMERALD,
    weightOverrides: {
      'aff-crit': 3.0, 'aff-cdmg': 2.5, 'aff-aspd': 3.0, 'aff-spd': 2.0,
      'aff-str': 1.0, 'aff-arm': 0.2, 'aff-hp': 0.3,
    },
  },
  {
    name: 'NecroRing', displayName: 'Ring of the Lich', type: 'Accessory',
    rarity: 'Legendary', description: 'Dark magic ring -- mana, cooldown, and economic bonuses',
    icon: Skull, color: ACCENT_VIOLET,
    weightOverrides: {
      'aff-mana': 2.5, 'aff-cdr': 3.0, 'aff-mregen': 2.5, 'aff-mf': 2.0,
      'aff-gold': 1.5, 'aff-xp': 1.5, 'aff-str': 0.1,
    },
  },
  {
    name: 'MerchantAmulet', displayName: 'Trader\'s Signet', type: 'Accessory',
    rarity: 'Epic', description: 'Gold and magic find focused amulet for farming builds',
    icon: Crown, color: STATUS_WARNING,
    weightOverrides: {
      'aff-gold': 4.0, 'aff-mf': 3.5, 'aff-xp': 2.5, 'aff-spd': 1.5,
      'aff-str': 0.1, 'aff-atk': 0.1, 'aff-arm': 0.1,
    },
  },
];

/* -- Base affix pool ------------------------------------------------------- */

export const BASE_AFFIX_POOL: AffixPoolEntry[] = [
  { id: 'aff-str', name: 'of Strength', isPrefix: false, axis: 'offensive', tags: ['Stat.Strength'], minValue: 3, maxValue: 15, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-atk', name: 'Fierce', isPrefix: true, axis: 'offensive', tags: ['Stat.AttackPower'], minValue: 5, maxValue: 25, baseWeight: 1.2, minRarity: 'Common' },
  { id: 'aff-crit', name: 'of Precision', isPrefix: false, axis: 'offensive', tags: ['Stat.CritChance'], minValue: 2, maxValue: 12, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-cdmg', name: 'Devastating', isPrefix: true, axis: 'offensive', tags: ['Stat.CritDamage'], minValue: 10, maxValue: 50, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-aspd', name: 'of Haste', isPrefix: false, axis: 'offensive', tags: ['Stat.AttackSpeed'], minValue: 3, maxValue: 15, baseWeight: 0.7, minRarity: 'Rare' },
  { id: 'aff-arm', name: 'Fortified', isPrefix: true, axis: 'defensive', tags: ['Stat.Armor'], minValue: 5, maxValue: 30, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-hp', name: 'of Vitality', isPrefix: false, axis: 'defensive', tags: ['Stat.MaxHealth'], minValue: 10, maxValue: 80, baseWeight: 1.3, minRarity: 'Common' },
  { id: 'aff-regen', name: 'Regenerating', isPrefix: true, axis: 'defensive', tags: ['Stat.HealthRegen'], minValue: 1, maxValue: 8, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-dodge', name: 'of Evasion', isPrefix: false, axis: 'defensive', tags: ['Stat.DodgeChance'], minValue: 2, maxValue: 10, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-spd', name: 'of Swiftness', isPrefix: false, axis: 'utility', tags: ['Stat.MoveSpeed'], minValue: 3, maxValue: 12, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-cdr', name: 'Quickened', isPrefix: true, axis: 'utility', tags: ['Stat.CooldownReduction'], minValue: 2, maxValue: 10, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-mana', name: 'of Intellect', isPrefix: false, axis: 'utility', tags: ['Stat.MaxMana'], minValue: 10, maxValue: 60, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-mregen', name: 'Flowing', isPrefix: true, axis: 'utility', tags: ['Stat.ManaRegen'], minValue: 1, maxValue: 8, baseWeight: 0.7, minRarity: 'Rare' },
  { id: 'aff-gold', name: 'Prosperous', isPrefix: true, axis: 'economic', tags: ['Stat.GoldFind'], minValue: 5, maxValue: 30, baseWeight: 0.8, minRarity: 'Uncommon' },
  { id: 'aff-mf', name: 'of Fortune', isPrefix: false, axis: 'economic', tags: ['Stat.MagicFind'], minValue: 3, maxValue: 20, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-xp', name: 'of the Scholar', isPrefix: false, axis: 'economic', tags: ['Stat.XPBonus'], minValue: 3, maxValue: 15, baseWeight: 0.5, minRarity: 'Epic' },
];

/* -- Sub-tabs -------------------------------------------------------------- */

export const SUB_TABS: SubTab[] = [
  { id: 'designer', label: 'Item Designer', icon: Wand2 },
  { id: 'distributions', label: 'Distributions', icon: BarChart3 },
  { id: 'heatmap', label: 'Co-Occurrence', icon: Grid3X3 },
  { id: 'code', label: 'UE5 Code', icon: Code },
];

export { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET };
