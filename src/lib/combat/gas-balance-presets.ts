import type { CombatantStats, SimScenario, LevelSweepConfig } from '@/types/gas-balance-simulator';

// ── Player Preset ───────────────────────────────────────────────────────────

export const DEFAULT_PLAYER: CombatantStats = {
  name: 'Player',
  level: 15,
  maxHealth: 500,
  maxMana: 200,
  strength: 30,
  dexterity: 20,
  intelligence: 15,
  armor: 20,
  attackPower: 70,       // base 10 + Str*2 = 70
  criticalChance: 0.15,
  criticalDamage: 1.5,
  baseDamage: 50,
  attackSpeed: 1.2,
};

// ── Enemy Presets ───────────────────────────────────────────────────────────

export const ENEMY_PRESETS: Record<string, CombatantStats> = {
  skeleton: {
    name: 'Skeleton Warrior',
    level: 12,
    maxHealth: 150,
    maxMana: 0,
    strength: 15,
    dexterity: 10,
    intelligence: 5,
    armor: 10,
    attackPower: 30,
    criticalChance: 0.05,
    criticalDamage: 1.5,
    baseDamage: 25,
    attackSpeed: 0.8,
  },
  golem: {
    name: 'Stone Golem',
    level: 18,
    maxHealth: 800,
    maxMana: 0,
    strength: 40,
    dexterity: 5,
    intelligence: 3,
    armor: 60,
    attackPower: 50,
    criticalChance: 0,
    criticalDamage: 1.0,
    baseDamage: 45,
    attackSpeed: 0.5,
  },
  mage: {
    name: 'Dark Mage',
    level: 16,
    maxHealth: 200,
    maxMana: 300,
    strength: 8,
    dexterity: 12,
    intelligence: 35,
    armor: 5,
    attackPower: 80,
    criticalChance: 0.2,
    criticalDamage: 2.0,
    baseDamage: 60,
    attackSpeed: 0.7,
  },
  boss: {
    name: 'Dungeon Boss',
    level: 20,
    maxHealth: 2500,
    maxMana: 500,
    strength: 50,
    dexterity: 25,
    intelligence: 30,
    armor: 40,
    attackPower: 100,
    criticalChance: 0.15,
    criticalDamage: 2.0,
    baseDamage: 80,
    attackSpeed: 0.6,
  },
};

// ── Scenario Presets ────────────────────────────────────────────────────────

export const SCENARIO_PRESETS: SimScenario[] = [
  {
    id: 'trash-pack',
    name: 'Trash Pack (3× Skeletons)',
    player: { ...DEFAULT_PLAYER },
    enemies: [{ id: 'e1', stats: { ...ENEMY_PRESETS.skeleton }, count: 3 }],
    iterations: 2000,
  },
  {
    id: 'mixed-pack',
    name: 'Mixed Pack (2× Skeleton + 1× Mage)',
    player: { ...DEFAULT_PLAYER },
    enemies: [
      { id: 'e1', stats: { ...ENEMY_PRESETS.skeleton }, count: 2 },
      { id: 'e2', stats: { ...ENEMY_PRESETS.mage }, count: 1 },
    ],
    iterations: 2000,
  },
  {
    id: 'boss-fight',
    name: 'Boss Encounter',
    player: { ...DEFAULT_PLAYER },
    enemies: [{ id: 'e1', stats: { ...ENEMY_PRESETS.boss }, count: 1 }],
    iterations: 2000,
  },
];

// ── Level Sweep Default ─────────────────────────────────────────────────────

export const DEFAULT_SWEEP_CONFIG: LevelSweepConfig = {
  minLevel: 1,
  maxLevel: 50,
  enemyScaling: 'match',
  enemyLevelOffset: 0,
  iterationsPerLevel: 300,
};
