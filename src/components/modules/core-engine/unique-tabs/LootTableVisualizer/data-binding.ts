import {
  ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_MUTED, STATUS_INFO, STATUS_WARNING,
} from '@/lib/chart-colors';

/* -- 7.8 Beacon config data ----------------------------------------------- */

export interface BeaconConfig {
  rarity: string;
  color: string;
  beamHeight: number;
  pulseSpeed: number;
  pickupRadius: number;
}

export const BEACON_CONFIGS: BeaconConfig[] = [
  { rarity: 'Common', color: STATUS_MUTED, beamHeight: 20, pulseSpeed: 0, pickupRadius: 50 },
  { rarity: 'Uncommon', color: ACCENT_EMERALD, beamHeight: 40, pulseSpeed: 1, pickupRadius: 80 },
  { rarity: 'Rare', color: STATUS_INFO, beamHeight: 60, pulseSpeed: 2, pickupRadius: 120 },
  { rarity: 'Epic', color: ACCENT_VIOLET, beamHeight: 80, pulseSpeed: 3, pickupRadius: 160 },
  { rarity: 'Legendary', color: STATUS_WARNING, beamHeight: 100, pulseSpeed: 4, pickupRadius: 200 },
];

/* -- 7.9 Economy Impact data ---------------------------------------------- */

export const ECONOMY_SURPLUS = [
  { type: 'Weapons', delta: +5, color: STATUS_SUCCESS },
  { type: 'Armor', delta: +3, color: STATUS_SUCCESS },
  { type: 'Consumables', delta: -2, color: STATUS_ERROR },
  { type: 'Materials', delta: +1, color: STATUS_SUCCESS },
  { type: 'Gems', delta: -1, color: STATUS_ERROR },
];

/* -- 7.10 Smart Loot data ------------------------------------------------- */

export interface SmartLootSlot {
  slot: string;
  rawPct: number;
  smartPct: number;
  gearScoreGap: number;
}

export const SMART_LOOT_DATA: SmartLootSlot[] = [
  { slot: 'Helmet', rawPct: 12, smartPct: 18, gearScoreGap: 15 },
  { slot: 'Chest', rawPct: 12, smartPct: 8, gearScoreGap: 3 },
  { slot: 'Legs', rawPct: 12, smartPct: 16, gearScoreGap: 12 },
  { slot: 'Boots', rawPct: 12, smartPct: 14, gearScoreGap: 8 },
  { slot: 'Weapon', rawPct: 16, smartPct: 22, gearScoreGap: 20 },
  { slot: 'Shield', rawPct: 12, smartPct: 6, gearScoreGap: 2 },
  { slot: 'Ring', rawPct: 12, smartPct: 10, gearScoreGap: 5 },
  { slot: 'Amulet', rawPct: 12, smartPct: 6, gearScoreGap: 1 },
];

/* -- 7.11 Enemy-to-LootTable Binding Data --------------------------------- */

export interface EnemyLootBinding {
  archetypeId: string;
  archetypeName: string;
  color: string;
  icon: string;
  lootTableName: string;
  dropChance: number;
  rarityWeights: number[];
  bonusGold: number;
}

export const DEFAULT_ENEMY_LOOT_BINDINGS: EnemyLootBinding[] = [
  {
    archetypeId: 'MeleeGrunt', archetypeName: 'Melee Grunt', color: ACCENT_EMERALD, icon: 'FG',
    lootTableName: 'LT_Grunt', dropChance: 0.3,
    rarityWeights: [60, 25, 10, 4, 1], bonusGold: 15,
  },
  {
    archetypeId: 'RangedCaster', archetypeName: 'Ranged Caster', color: STATUS_INFO, icon: 'DM',
    lootTableName: 'LT_Caster', dropChance: 0.35,
    rarityWeights: [40, 30, 18, 9, 3], bonusGold: 20,
  },
  {
    archetypeId: 'Brute', archetypeName: 'Brute', color: ACCENT_ORANGE, icon: 'SB',
    lootTableName: 'LT_Brute', dropChance: 0.5,
    rarityWeights: [30, 25, 25, 15, 5], bonusGold: 40,
  },
];

/* -- 7.12 EV Calculator data ---------------------------------------------- */

export const DEFAULT_RARITY_GOLD: Record<string, number> = {
  Common: 5,
  Uncommon: 15,
  Rare: 50,
  Epic: 200,
  Legendary: 1000,
};

export interface EVResult {
  archetypeId: string;
  archetypeName: string;
  color: string;
  evPerKill: number;
  goldFromItems: number;
  goldFromBonus: number;
  evPerHour: number;
  evPerSession: number;
}

/* -- UE5 Import/Export interfaces ----------------------------------------- */

/** Shape of a single FLootEntry when exported from UE5 as JSON */
export interface UE5LootEntry {
  Item?: string | { Name?: string; ObjectName?: string; AssetName?: string };
  DropWeight?: number;
  MinQuantity?: number;
  MaxQuantity?: number;
  MinRarity?: string | number;
  MaxRarity?: string | number;
}

/** Shape of a full UARPGLootTable JSON export */
export interface UE5LootTableJson {
  Entries?: UE5LootEntry[];
  NothingWeight?: number;
  /** UE5 JSON export sometimes nests under a "Properties" key */
  Properties?: { Entries?: UE5LootEntry[]; NothingWeight?: number };
}

export interface SimulatedDrop {
  rarityIndex: number;
  count: number;
}
