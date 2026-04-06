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
  // ── Minions ──────────────────────────────────
  { archetypeId: 'MeleeGrunt', archetypeName: 'Melee Grunt', color: ACCENT_EMERALD, icon: 'FG', lootTableName: 'LT_Grunt', dropChance: 0.30, rarityWeights: [60, 25, 10, 4, 1], bonusGold: 15 },
  { archetypeId: 'Rakghoul', archetypeName: 'Rakghoul', color: ACCENT_EMERALD, icon: 'RK', lootTableName: 'LT_Swarm', dropChance: 0.20, rarityWeights: [70, 20, 7, 2, 1], bonusGold: 8 },
  { archetypeId: 'KathHound', archetypeName: 'Kath Hound', color: ACCENT_EMERALD, icon: 'KH', lootTableName: 'LT_Beast', dropChance: 0.25, rarityWeights: [65, 22, 9, 3, 1], bonusGold: 10 },
  { archetypeId: 'Kinrath', archetypeName: 'Kinrath', color: ACCENT_EMERALD, icon: 'KR', lootTableName: 'LT_Insect', dropChance: 0.22, rarityWeights: [68, 20, 8, 3, 1], bonusGold: 9 },
  { archetypeId: 'SkeletonWarrior', archetypeName: 'Skeleton Warrior', color: STATUS_MUTED, icon: 'SK', lootTableName: 'LT_Undead', dropChance: 0.28, rarityWeights: [62, 23, 10, 4, 1], bonusGold: 12 },
  // ── Standard ─────────────────────────────────
  { archetypeId: 'RangedCaster', archetypeName: 'Ranged Caster', color: STATUS_INFO, icon: 'DM', lootTableName: 'LT_Caster', dropChance: 0.35, rarityWeights: [40, 30, 18, 9, 3], bonusGold: 20 },
  { archetypeId: 'MandalorianWarrior', archetypeName: 'Mandalorian', color: STATUS_INFO, icon: 'MW', lootTableName: 'LT_Mando', dropChance: 0.40, rarityWeights: [35, 30, 20, 12, 3], bonusGold: 30 },
  { archetypeId: 'SithAssassin', archetypeName: 'Sith Assassin', color: ACCENT_VIOLET, icon: 'SA', lootTableName: 'LT_Sith', dropChance: 0.45, rarityWeights: [30, 28, 22, 15, 5], bonusGold: 35 },
  { archetypeId: 'WookieeBerserker', archetypeName: 'Wookiee Berserker', color: ACCENT_ORANGE, icon: 'WB', lootTableName: 'LT_Wookiee', dropChance: 0.38, rarityWeights: [38, 28, 20, 10, 4], bonusGold: 25 },
  { archetypeId: 'WarDroid', archetypeName: 'War Droid', color: STATUS_MUTED, icon: 'WD', lootTableName: 'LT_Droid', dropChance: 0.32, rarityWeights: [45, 28, 16, 8, 3], bonusGold: 22 },
  { archetypeId: 'DarkAcolyte', archetypeName: 'Dark Acolyte', color: ACCENT_VIOLET, icon: 'DA', lootTableName: 'LT_Acolyte', dropChance: 0.35, rarityWeights: [42, 28, 18, 9, 3], bonusGold: 20 },
  { archetypeId: 'BanditArcher', archetypeName: 'Bandit Archer', color: ACCENT_EMERALD, icon: 'BA', lootTableName: 'LT_Bandit', dropChance: 0.30, rarityWeights: [50, 28, 14, 6, 2], bonusGold: 16 },
  // ── Elites ───────────────────────────────────
  { archetypeId: 'Brute', archetypeName: 'Stone Brute', color: ACCENT_ORANGE, icon: 'SB', lootTableName: 'LT_Brute', dropChance: 0.50, rarityWeights: [30, 25, 25, 15, 5], bonusGold: 40 },
  { archetypeId: 'EliteKnight', archetypeName: 'Hollow Knight', color: ACCENT_ORANGE, icon: 'HK', lootTableName: 'LT_Knight', dropChance: 0.55, rarityWeights: [25, 25, 25, 18, 7], bonusGold: 50 },
  { archetypeId: 'Hssiss', archetypeName: 'Hssiss Drake', color: ACCENT_ORANGE, icon: 'HS', lootTableName: 'LT_Drake', dropChance: 0.50, rarityWeights: [28, 24, 24, 16, 8], bonusGold: 45 },
  { archetypeId: 'Terentatek', archetypeName: 'Terentatek', color: STATUS_ERROR, icon: 'TT', lootTableName: 'LT_Teren', dropChance: 0.60, rarityWeights: [20, 22, 26, 20, 12], bonusGold: 60 },
  { archetypeId: 'Enraged', archetypeName: 'Enraged Elite', color: STATUS_ERROR, icon: 'EE', lootTableName: 'LT_Enraged', dropChance: 0.55, rarityWeights: [22, 23, 25, 20, 10], bonusGold: 55 },
  { archetypeId: 'Commander', archetypeName: 'Field Commander', color: STATUS_WARNING, icon: 'FC', lootTableName: 'LT_Commander', dropChance: 0.52, rarityWeights: [25, 25, 24, 18, 8], bonusGold: 48 },
  // ── Bosses ───────────────────────────────────
  { archetypeId: 'DarthMalak', archetypeName: 'Darth Malak', color: STATUS_WARNING, icon: 'DM', lootTableName: 'LT_Malak', dropChance: 1.00, rarityWeights: [5, 10, 25, 35, 25], bonusGold: 500 },
  { archetypeId: 'AncientDragon', archetypeName: 'Ancient Dragon', color: STATUS_WARNING, icon: 'AD', lootTableName: 'LT_Dragon', dropChance: 1.00, rarityWeights: [5, 10, 20, 35, 30], bonusGold: 750 },
  { archetypeId: 'LichKing', archetypeName: 'Lich King', color: STATUS_WARNING, icon: 'LK', lootTableName: 'LT_Lich', dropChance: 1.00, rarityWeights: [0, 5, 25, 40, 30], bonusGold: 600 },
  { archetypeId: 'VoidHerald', archetypeName: 'Void Herald', color: STATUS_WARNING, icon: 'VH', lootTableName: 'LT_Void', dropChance: 1.00, rarityWeights: [0, 5, 20, 40, 35], bonusGold: 1000 },
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
