import { MODULE_COLORS } from '@/lib/chart-colors';

export const ACCENT = MODULE_COLORS.systems;

/* ── Simulation Data Model ────────────────────────────────────────────── */

export interface CombatantStats {
  name: string;
  level: number;
  maxHealth: number;
  maxMana: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  armor: number;
  attackPower: number;
  criticalChance: number;   // 0-1
  criticalDamage: number;   // multiplier e.g. 1.5
  baseDamage: number;
  attackSpeed: number;      // attacks per second
}

export interface EnemyConfig {
  id: string;
  stats: CombatantStats;
  count: number;
}

export interface SimScenario {
  id: string;
  name: string;
  player: CombatantStats;
  enemies: EnemyConfig[];
  iterations: number;
}

export interface SimIterationResult {
  ttk: number;
  totalDamage: number;
  totalHits: number;
  critHits: number;
  overkill: number;
  playerSurvived: boolean;
  playerHpRemaining: number;
}

export interface SimResults {
  scenarioId: string;
  iterations: SimIterationResult[];
  ttkStats: { mean: number; median: number; p10: number; p90: number; min: number; max: number; stdDev: number };
  dpsStats: { mean: number; median: number; min: number; max: number };
  critRate: number;
  survivalRate: number;
  effectiveHp: number;
  armorMitigation: number;
  timestamp: number;
}

export interface SensitivityPoint {
  value: number;
  dps: number;
  ttk: number;
  ehp: number;
}

export interface SensitivityResult {
  attribute: string;
  points: SensitivityPoint[];
  diminishingAt: number | null;
}

export interface LevelSweepPoint {
  level: number;
  ttk: number;
  dps: number;
  survivalRate: number;
  ehp: number;
}

export interface LevelSweepConfig {
  minLevel: number;
  maxLevel: number;
  enemyScaling: 'fixed' | 'match' | 'offset';
  enemyLevelOffset: number;
  iterationsPerLevel: number;
}

export const DEFAULT_SWEEP_CONFIG: LevelSweepConfig = {
  minLevel: 1,
  maxLevel: 50,
  enemyScaling: 'match',
  enemyLevelOffset: 0,
  iterationsPerLevel: 300,
};

/* ── Presets ───────────────────────────────────────────────────────────── */

export const DEFAULT_PLAYER: CombatantStats = {
  name: 'Player',
  level: 15,
  maxHealth: 500,
  maxMana: 200,
  strength: 30,
  dexterity: 20,
  intelligence: 15,
  armor: 20,
  attackPower: 70,
  criticalChance: 0.15,
  criticalDamage: 1.5,
  baseDamage: 50,
  attackSpeed: 1.2,
};

export const ENEMY_PRESETS: Record<string, CombatantStats> = {
  skeleton: {
    name: 'Skeleton Warrior', level: 12, maxHealth: 150, maxMana: 0,
    strength: 15, dexterity: 10, intelligence: 5, armor: 10,
    attackPower: 30, criticalChance: 0.05, criticalDamage: 1.5,
    baseDamage: 25, attackSpeed: 0.8,
  },
  golem: {
    name: 'Stone Golem', level: 18, maxHealth: 800, maxMana: 0,
    strength: 40, dexterity: 5, intelligence: 3, armor: 60,
    attackPower: 50, criticalChance: 0, criticalDamage: 1.0,
    baseDamage: 45, attackSpeed: 0.5,
  },
  mage: {
    name: 'Dark Mage', level: 16, maxHealth: 200, maxMana: 300,
    strength: 8, dexterity: 12, intelligence: 35, armor: 5,
    attackPower: 80, criticalChance: 0.2, criticalDamage: 2.0,
    baseDamage: 60, attackSpeed: 0.7,
  },
  boss: {
    name: 'Dungeon Boss', level: 20, maxHealth: 2500, maxMana: 500,
    strength: 50, dexterity: 25, intelligence: 30, armor: 40,
    attackPower: 100, criticalChance: 0.15, criticalDamage: 2.0,
    baseDamage: 80, attackSpeed: 0.6,
  },
};

export const SCENARIO_PRESETS: SimScenario[] = [
  {
    id: 'trash-pack',
    name: 'Trash Pack (3x Skeletons)',
    player: { ...DEFAULT_PLAYER },
    enemies: [{ id: 'e1', stats: { ...ENEMY_PRESETS.skeleton }, count: 3 }],
    iterations: 2000,
  },
  {
    id: 'mixed-pack',
    name: 'Mixed Pack (2x Skeleton + 1x Mage)',
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

/* ── Scenario Export / Import (base64 JSON, PoB-style) ────────────────── */

const COMBATANT_STAT_KEYS: (keyof CombatantStats)[] = [
  'name', 'level', 'maxHealth', 'maxMana', 'strength', 'dexterity',
  'intelligence', 'armor', 'attackPower', 'criticalChance', 'criticalDamage',
  'baseDamage', 'attackSpeed',
];

function isValidCombatantStats(obj: unknown): obj is CombatantStats {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.name !== 'string') return false;
  for (const key of COMBATANT_STAT_KEYS) {
    if (key === 'name') continue;
    if (typeof o[key] !== 'number' || !isFinite(o[key] as number)) return false;
  }
  return true;
}

function isValidEnemyConfig(obj: unknown): obj is EnemyConfig {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.count === 'number' && isValidCombatantStats(o.stats);
}

function isValidSimScenario(obj: unknown): obj is SimScenario {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return false;
  if (typeof o.iterations !== 'number' || o.iterations < 1) return false;
  if (!isValidCombatantStats(o.player)) return false;
  if (!Array.isArray(o.enemies) || !o.enemies.every(isValidEnemyConfig)) return false;
  return true;
}

export function encodeScenario(scenario: SimScenario): string {
  return btoa(JSON.stringify(scenario));
}

export function decodeScenario(encoded: string): { ok: true; scenario: SimScenario } | { ok: false; error: string } {
  try {
    const json = atob(encoded.trim());
    const parsed: unknown = JSON.parse(json);
    if (!isValidSimScenario(parsed)) {
      return { ok: false, error: 'Invalid scenario shape -- missing or malformed fields.' };
    }
    return { ok: true, scenario: parsed };
  } catch {
    return { ok: false, error: 'Failed to decode -- invalid base64 or JSON.' };
  }
}
