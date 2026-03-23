// ── GAS Balance Simulator Types ─────────────────────────────────────────────
// Extracted from GASBalanceSimulator.tsx for reuse and clarity.

/** Stats for a combatant (player or enemy) in the balance simulator */
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
  criticalChance: number;   // 0–1
  criticalDamage: number;   // multiplier e.g. 1.5
  baseDamage: number;
  attackSpeed: number;      // attacks per second
}

/** Enemy entry within a scenario */
export interface EnemyConfig {
  id: string;
  stats: CombatantStats;
  count: number;
}

/** A complete simulation scenario */
export interface SimScenario {
  id: string;
  name: string;
  player: CombatantStats;
  enemies: EnemyConfig[];
  iterations: number;
  seed?: number;
}

/** Result of a single Monte Carlo iteration */
export interface SimIterationResult {
  ttk: number;           // time-to-kill in seconds
  totalDamage: number;
  totalHits: number;
  critHits: number;
  overkill: number;
  playerSurvived: boolean;
  playerHpRemaining: number;
}

/** Aggregated results for a scenario */
export interface SimResults {
  scenarioId: string;
  iterations: SimIterationResult[];
  ttkStats: { mean: number; median: number; p10: number; p90: number; min: number; max: number; stdDev: number };
  dpsStats: { mean: number; median: number; min: number; max: number };
  critRate: number;       // actual crit rate observed
  survivalRate: number;
  effectiveHp: number;    // player EHP considering armor
  armorMitigation: number; // % damage reduced by armor
  timestamp: number;
}

/** Single point in a sensitivity analysis */
export interface SensitivityPoint {
  value: number;
  dps: number;
  ttk: number;
  ehp: number;
}

/** Result of sweeping one attribute for sensitivity */
export interface SensitivityResult {
  attribute: string;
  points: SensitivityPoint[];
  diminishingAt: number | null; // value where returns start diminishing
}

/** Single data point from a level sweep */
export interface LevelSweepPoint {
  level: number;
  ttk: number;
  dps: number;
  survivalRate: number;
  ehp: number;
}

/** Configuration for the level sweep engine */
export interface LevelSweepConfig {
  minLevel: number;
  maxLevel: number;
  enemyScaling: 'fixed' | 'match' | 'offset';
  enemyLevelOffset: number;
  iterationsPerLevel: number;
}
