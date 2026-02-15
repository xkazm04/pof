// ── Combat Simulator Types ──────────────────────────────────────────────────

/** GAS-compatible attribute set */
export interface AttributeSet {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  armor: number;
  attackPower: number;
  critChance: number;   // 0-1
  critDamage: number;   // multiplier, e.g. 1.5 = 150%
}

export type AttributeKey = keyof AttributeSet;

/** A combat ability (maps to GA_ GameplayAbilities) */
export interface CombatAbility {
  id: string;
  name: string;
  type: 'melee' | 'ranged' | 'aoe' | 'buff' | 'dodge';
  /** Base damage before scaling */
  baseDamage: number;
  /** AttackPower scaling coefficient */
  attackPowerScaling: number;
  /** Mana cost */
  manaCost: number;
  /** Cooldown in seconds */
  cooldownSec: number;
  /** Cast/animation time in seconds */
  castTimeSec: number;
  /** Range in units (0 = melee) */
  range: number;
  /** AoE radius (0 = single target) */
  aoeRadius: number;
  /** Additional effects */
  appliesStun?: number;     // stun duration sec
  appliesBuff?: { attribute: AttributeKey; amount: number; durationSec: number };
  appliesInvulnerable?: number; // invulnerable duration sec
}

/** An enemy archetype */
export interface EnemyArchetype {
  id: string;
  name: string;
  baseAttributes: AttributeSet;
  /** Level scaling per level above 1 */
  levelScaling: Partial<Record<AttributeKey, number>>;
  abilities: CombatAbility[];
  /** Attack interval in seconds (how often enemy acts) */
  attackIntervalSec: number;
  /** Aggro range in units */
  aggroRange: number;
  /** XP reward on kill */
  xpReward: number;
}

/** Player gear loadout affecting attributes */
export interface GearLoadout {
  id: string;
  name: string;
  /** Flat attribute bonuses from gear */
  bonuses: Partial<Record<AttributeKey, number>>;
}

/** Scenario configuration */
export interface CombatScenario {
  name: string;
  playerLevel: number;
  playerGear: GearLoadout;
  /** Player abilities available */
  playerAbilities: CombatAbility[];
  /** Enemies in the encounter: archetype + count + level */
  enemies: { archetypeId: string; count: number; level: number }[];
}

/** Tuning overrides — slider values that modify base parameters */
export interface TuningOverrides {
  playerHealthMul: number;      // 0.5-2.0
  playerDamageMul: number;      // 0.5-2.0
  playerArmorMul: number;       // 0.5-2.0
  enemyHealthMul: number;       // 0.5-2.0
  enemyDamageMul: number;       // 0.5-2.0
  critMultiplierMul: number;    // 0.5-2.0
  armorEffectivenessWeight: number; // 0.5-2.0
  healingMul: number;           // 0.5-2.0
}

/** Result of a single simulated fight */
export interface FightResult {
  won: boolean;
  durationSec: number;
  playerHealthRemaining: number;
  playerManaRemaining: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  abilitiesUsed: Record<string, number>;
  critCount: number;
  totalHits: number;
  enemiesKilled: number;
  /** If player died, what killed them */
  killedBy?: string;
  /** Was it a one-shot death? */
  oneShot: boolean;
}

/** Aggregated results from Monte Carlo simulation */
export interface SimulationResult {
  config: CombatSimConfig;
  scenario: CombatScenario;
  tuning: TuningOverrides;
  /** Individual fight results */
  fights: FightResult[];
  /** Summary statistics */
  summary: CombatSummary;
  /** Balance alerts */
  alerts: BalanceAlert[];
  durationMs: number;
  completedAt: string;
}

export interface CombatSummary {
  survivalRate: number;          // 0-1
  avgFightDurationSec: number;
  medianFightDurationSec: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgPlayerHealthRemaining: number;
  /** DPS stats */
  avgDPS: number;
  avgEnemyDPS: number;
  /** Crit statistics */
  avgCritRate: number;
  /** Ability usage heatmap: ability name → avg uses per fight */
  abilityHeatmap: Record<string, number>;
  /** Damage dealt distribution buckets */
  damageDealtBuckets: { min: number; max: number; count: number }[];
  /** Damage taken distribution buckets */
  damageTakenBuckets: { min: number; max: number; count: number }[];
  /** Fight duration distribution */
  durationBuckets: { min: number; max: number; count: number }[];
  /** One-shot death percentage */
  oneShotRate: number;
}

export type BalanceAlertSeverity = 'info' | 'warning' | 'critical';

export interface BalanceAlert {
  severity: BalanceAlertSeverity;
  type: 'one-shot' | 'too-long' | 'too-short' | 'ability-unused' | 'dps-bottleneck' | 'overkill' | 'survival-low' | 'survival-high';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

/** Simulation run config */
export interface CombatSimConfig {
  iterations: number;
  seed: number;
  /** Max fight duration before declaring a draw */
  maxFightDurationSec: number;
}

// ── API Types ───────────────────────────────────────────────────────────────

export interface RunCombatSimRequest {
  scenario: CombatScenario;
  tuning: TuningOverrides;
  config: CombatSimConfig;
}

export interface GetCombatDefaultsResponse {
  enemies: EnemyArchetype[];
  abilities: CombatAbility[];
  gearLoadouts: GearLoadout[];
  defaultTuning: TuningOverrides;
  defaultConfig: CombatSimConfig;
}
