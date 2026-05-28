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

/** A single (enemy, ability) damage source observed in a fight */
export interface DamageSource {
  /** Enemy archetype name (no "#N" suffix) */
  enemy: string;
  /** Ability display name */
  ability: string;
  /** Ability id */
  abilityId: string;
  /** Total damage from this source in this fight */
  damage: number;
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
  /** If player died, archetype name of the killer (e.g. "Stone Brute") */
  killedBy?: string;
  /** If player died, name of the killing ability (e.g. "Charge Attack") */
  killedByAbility?: string;
  /** If player died, id of the killing ability */
  killedByAbilityId?: string;
  /** Per-source damage taken during this fight */
  damageBySource: DamageSource[];
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
  /** Death recap: who and what killed the player most */
  threatBreakdown: ThreatBreakdown;
}

/** A single (enemy, ability) threat row in the death recap */
export interface ThreatEntry {
  enemy: string;
  ability: string;
  abilityId: string;
  /** Total damage from this source across all fights */
  totalDamage: number;
  /** Share of all damage taken (0-1) */
  damageShare: number;
  /** Number of fights where this source landed the killing blow */
  killCount: number;
  /** Share of total deaths (0-1) */
  killShare: number;
  /** Designer-facing nerf suggestion */
  nerfSuggestion: string;
}

/** Aggregated rank for an enemy archetype across all fights */
export interface EnemyThreatEntry {
  enemy: string;
  totalDamage: number;
  damageShare: number;
  killCount: number;
  killShare: number;
  nerfSuggestion: string;
}

/** Death recap data: who is killing the player and which abilities to nerf */
export interface ThreatBreakdown {
  /** Per (enemy, ability) source, sorted by damageShare desc */
  bySource: ThreatEntry[];
  /** Per enemy archetype, sorted by killShare desc */
  byEnemy: EnemyThreatEntry[];
  /** Total fights ending in player death */
  totalDeaths: number;
  /** Total damage taken across all fights */
  totalDamageTaken: number;
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

// ── Feedback Balance Types ───────────────────────────────────────────────────

/** Severity levels for feedback-specific balance insights */
export type FeedbackInsightSeverity = 'positive' | 'warning' | 'critical';

/** Configuration for feedback-aware combat simulation */
export interface FeedbackConfig {
  /** Hitstop freeze duration in seconds (0 = disabled) */
  hitstopDurationSec: number;
  /** Camera shake intensity multiplier (0 = disabled) */
  cameraShakeScale: number;
  /** Base player reaction time in seconds */
  baseReactionTimeSec: number;
  /** Accuracy penalty from camera shake (0-1) */
  shakeAccuracyPenalty: number;
  /** Hit recovery window in seconds */
  hitRecoveryWindowSec: number;
  /** Whether recovery window grants invulnerability frames */
  hitRecoveryIFrames: boolean;
}

/** Summary stats from a feedback-aware simulation run */
export interface FeedbackSimSummary {
  survivalRate: number;
  avgDurationSec: number;
  avgDPS: number;
  avgDamageTaken: number;
  avgDodgesFromHitstop: number;
  avgMissesFromShake: number;
  avgTotalHitstopSec: number;
  avgEffectiveReactionSec: number;
}

/** Deltas between feedback-on and feedback-off runs */
export interface FeedbackDeltas {
  survivalRateDelta: number;
  durationDelta: number;
  dpsDelta: number;
  damageTakenDelta: number;
}

/** A single feedback balance insight */
export interface FeedbackInsight {
  severity: FeedbackInsightSeverity;
  category: string;
  message: string;
}

/** Full comparison result from runFeedbackComparison */
export interface FeedbackComparisonResult {
  withFeedback: FeedbackSimSummary;
  withoutFeedback: FeedbackSimSummary;
  deltas: FeedbackDeltas;
  insights: FeedbackInsight[];
}

/** Preset for feedback configuration */
export interface FeedbackPreset {
  id: string;
  name: string;
  description: string;
  config: FeedbackConfig;
}

// ── A/B Run Comparison Types ─────────────────────────────────────────────────

/** Headline metric deltas between two full simulation runs (candidate − baseline) */
export interface RunMetricDeltas {
  /** Δ survival rate (0-1 scale, candidate − baseline) */
  survivalRateDelta: number;
  /** Δ average player DPS */
  avgDPSDelta: number;
  /** Δ average fight duration (seconds) */
  avgDurationDelta: number;
  /** Δ one-shot death rate (0-1 scale) */
  oneShotRateDelta: number;
}

/** How a balance alert changed between the baseline and candidate runs */
export type AlertDiffStatus = 'appeared' | 'disappeared' | 'persisted';

/** A single balance-alert entry in an A/B diff */
export interface AlertDiffEntry {
  /** appeared = new in candidate, disappeared = gone in candidate, persisted = in both */
  status: AlertDiffStatus;
  /** Alert type (shared identity for single-instance alert kinds) */
  type: BalanceAlert['type'];
  /** Representative alert (candidate's copy when present, else the baseline's) */
  alert: BalanceAlert;
  /** Metric value in the baseline run (undefined when the alert was absent there) */
  baselineValue?: number;
  /** Metric value in the candidate run (undefined when the alert is absent there) */
  candidateValue?: number;
}

/** A labeled, lightweight snapshot of one run used in an A/B comparison */
export interface RunSnapshot {
  /** User-facing label, e.g. "Baseline" or "Candidate" */
  label: string;
  summary: CombatSummary;
  alerts: BalanceAlert[];
  scenario: CombatScenario;
  tuning: TuningOverrides;
  config: CombatSimConfig;
  completedAt: string;
}

/** Full A/B comparison between a pinned baseline run and a candidate run */
export interface ABComparisonResult {
  baseline: RunSnapshot;
  candidate: RunSnapshot;
  deltas: RunMetricDeltas;
  /** Alerts that appeared, disappeared, or persisted between the two runs */
  alertDiff: AlertDiffEntry[];
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
