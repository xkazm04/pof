/**
 * Predictive Balance Simulation Engine
 *
 * Client-side Monte Carlo engine that sweeps player levels × enemy compositions
 * to produce survival heatmaps, DPS breakdowns, and sensitivity analysis.
 * Uses the same combat formulas as simulation-engine.ts but optimized for
 * batch parameter sweeps.
 */

import type { AttributeSet, AttributeKey, CombatAbility, EnemyArchetype, TuningOverrides } from '@/types/combat-simulator';
import {
  BASE_PLAYER_ATTRIBUTES,
  PLAYER_LEVEL_SCALING,
  PLAYER_ABILITIES,
  ENEMY_ARCHETYPE_BY_ID,
  GEAR_LOADOUTS,
  DEFAULT_TUNING,
} from '@/lib/combat/definitions';
import {
  checkOneShot,
  checkResistCap,
  readCanonThresholds,
  type CanonThresholds,
  type CanonViolation,
} from '@/lib/balance/canon-conformance';
import {
  HARDCODED_ENEMY_SOURCE,
  type ArchetypeRegistry,
  type EnemySourceReport,
} from '@/lib/combat/simulation-engine';
import { createXorShift32RNG } from '@/lib/seeded-rng';
import { calculateDamage } from '@/lib/combat/damage';
import { armourEffectiveHpMultiplier } from '@/lib/combat/canon-kernel';

// ── RNG ─────────────────────────────────────────────────────────────────────
// Shared xorshift32 helper (see `@/lib/seeded-rng`); each cell/step derives its
// own stream from a key so results are order-independent.

/** Base seed for the sweep — every cell/step derives a stream from this. */
const BASE_SEED = 42;

/**
 * Derive a stable 32-bit seed from a key string (FNV-1a style). Each heatmap
 * cell and sensitivity step seeds its OWN rng from its parameters, so a cell's
 * result is reproducible regardless of the order cells are evaluated in.
 * Previously one shared createRNG(42) was threaded through every cell, making
 * each cell consume an order-dependent slice of the stream — so the numbers for
 * a given level-vs-enemy cell changed if the sweep order changed.
 */
function seedFromKey(key: string, base: number): number {
  let h = base | 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  }
  return (h | 0) || 1;
}

// ── Attribute builders ─────────────────────────────────────────────────────

function buildPlayerAttrs(level: number, gearId: string, tuning: TuningOverrides): AttributeSet {
  const attrs = { ...BASE_PLAYER_ATTRIBUTES };
  for (const [key, perLevel] of Object.entries(PLAYER_LEVEL_SCALING)) {
    const k = key as AttributeKey;
    attrs[k] += (perLevel as number) * (level - 1);
  }
  const gear = GEAR_LOADOUTS.find(g => g.id === gearId);
  if (gear) {
    for (const [key, bonus] of Object.entries(gear.bonuses)) {
      attrs[key as AttributeKey] += bonus as number;
    }
  }
  attrs.health *= tuning.playerHealthMul;
  attrs.maxHealth *= tuning.playerHealthMul;
  // NOTE: playerDamageMul is NOT pre-baked into attackPower here. The shared
  // calculateDamage applies it per-hit (scaling the whole hit incl. baseDamage),
  // matching the canonical simulation-engine behavior. Baking it in here used to
  // double-count it relative to the main engine.
  attrs.armor *= tuning.playerArmorMul;
  return attrs;
}

function buildEnemyAttrs(archetype: EnemyArchetype, level: number, tuning: TuningOverrides): AttributeSet {
  const attrs = { ...archetype.baseAttributes };
  for (const [key, perLevel] of Object.entries(archetype.levelScaling)) {
    const k = key as AttributeKey;
    attrs[k] += (perLevel as number) * (level - 1);
  }
  attrs.health *= tuning.enemyHealthMul;
  attrs.maxHealth *= tuning.enemyHealthMul;
  // enemyDamageMul is applied per-hit by the shared calculateDamage, not baked in here.
  return attrs;
}

// ── Damage formula ─────────────────────────────────────────────────────────
// Now delegated to the shared canonical calculateDamage (see ./damage). The
// previous local `calcDamage` had drifted: it clamped at Math.max(0,…) un-rounded
// and pre-baked the damage multiplier into attackPower — both reconciled here.

// ── Single fight simulation (lightweight) ──────────────────────────────────

interface QuickFightResult {
  won: boolean;
  durationSec: number;
  damageDealt: number;
  damageTaken: number;
  healthRemaining: number;
}

function simulateFight(
  playerAttrs: AttributeSet,
  abilities: CombatAbility[],
  enemies: { attrs: AttributeSet; ability: CombatAbility; intervalSec: number }[],
  tuning: TuningOverrides,
  rng: () => number,
  maxDuration: number,
): QuickFightResult {
  const TICK = 0.1;
  let playerHP = playerAttrs.health;
  let playerMana = playerAttrs.mana;
  const enemyHPs = enemies.map(e => e.attrs.health);
  let time = 0;
  let totalDealt = 0;
  let totalTaken = 0;

  const cooldowns = new Map<string, number>();
  let invulnUntil = 0;

  while (time < maxDuration) {
    // Player turn: pick best ability
    const alive = enemies.map((_, i) => i).filter(i => enemyHPs[i] > 0);
    if (alive.length === 0) break;

    let bestAbility: CombatAbility | null = null;
    let bestPriority = -1;
    for (const ab of abilities) {
      const cd = cooldowns.get(ab.id) ?? 0;
      if (cd > time) continue;
      if (ab.manaCost > playerMana) continue;

      let priority = 0;
      if (ab.type === 'dodge' && playerHP < playerAttrs.maxHealth * 0.3) priority = 10;
      else if (ab.type === 'buff') priority = 5;
      else if (ab.type === 'aoe' && alive.length >= 2) priority = 4;
      else priority = ab.baseDamage + playerAttrs.attackPower * ab.attackPowerScaling;

      if (priority > bestPriority) { bestPriority = priority; bestAbility = ab; }
    }

    if (bestAbility) {
      cooldowns.set(bestAbility.id, time + bestAbility.cooldownSec);
      playerMana -= bestAbility.manaCost;

      if (bestAbility.appliesInvulnerable) {
        invulnUntil = time + bestAbility.appliesInvulnerable;
      }

      if (bestAbility.baseDamage > 0) {
        const targets = bestAbility.aoeRadius > 0 ? alive : [alive[0]];
        for (const ti of targets) {
          const { damage: dmg } = calculateDamage(bestAbility, playerAttrs, enemies[ti].attrs, tuning, rng, true);
          enemyHPs[ti] -= dmg;
          totalDealt += dmg;
        }
      }
    }

    // Check enemies alive
    const stillAlive = enemies.map((_, i) => i).filter(i => enemyHPs[i] > 0);
    if (stillAlive.length === 0) break;

    // Enemy turns
    for (const ei of stillAlive) {
      const enemy = enemies[ei];
      const attacksPerTick = TICK / enemy.intervalSec;
      if (rng() < attacksPerTick) {
        if (time < invulnUntil) continue;
        const { damage: dmg } = calculateDamage(enemy.ability, enemy.attrs, playerAttrs, tuning, rng, false);
        playerHP -= dmg;
        totalTaken += dmg;
        if (playerHP <= 0) break;
      }
    }

    if (playerHP <= 0) break;

    // Mana regen
    playerMana = Math.min(playerAttrs.maxMana, playerMana + 2 * TICK);
    time += TICK;
  }

  return {
    won: playerHP > 0 && enemies.every((_, i) => enemyHPs[i] <= 0),
    durationSec: Math.round(time * 10) / 10,
    damageDealt: totalDealt,
    damageTaken: totalTaken,
    healthRemaining: Math.max(0, playerHP),
  };
}

// ── Public types ───────────────────────────────────────────────────────────

export interface HeatmapCell {
  playerLevel: number;
  enemyLabel: string;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
  avgEHP: number;
  /**
   * Largest single un-crit enemy hit available in this cell (raw, pre-mitigation:
   * `baseDamage + attackPower x scaling`, times `enemyDamageMul`, max over the
   * archetype's abilities). Observation only — nothing in the fight loop reads it;
   * it exists so the canon one-shot law (arpg-defenses) can be policed against
   * `avgEHP`, which already folds the armour soft-cap in.
   */
  biggestHit: number;
}

export interface SurvivalCurvePoint {
  level: number;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
}

export interface DPSBreakdown {
  abilityName: string;
  avgDamage: number;
  color: string;
}

export interface SensitivityPoint {
  value: number;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
}

export interface SensitivityCurve {
  attribute: string;
  points: SensitivityPoint[];
  diminishingAt: number | null;
}

/** One alert line in a balance report. */
export interface BalanceReportAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  /**
   * `canon-violation` marks an ARPG-LAWS breach found by the canon linter
   * (`@/lib/balance/canon-conformance`), mirroring the economy sim's alert
   * idiom. Absent/`heuristic` = the sweep's own tuning heuristics.
   */
  type?: 'heuristic' | 'canon-violation';
  /** For `canon-violation`: the canon rule id (canon-seed) that was breached. */
  lawId?: string;
}

/**
 * The outcome of ONE canon law check over this sweep. Every law the combat sim
 * is responsible for gets a row — including the ones that could not run, so a
 * law is never silently "passing" because nothing fed it.
 */
export interface CanonCheckStatus {
  /** Canon rule id in canon-seed. */
  lawId: string;
  law: string;
  status: 'pass' | 'violation' | 'not-evaluated';
  /** The canon envelope, human-readable (read from the seed, never hardcoded). */
  allowed: string;
  /** What was measured, when the check ran. */
  metric?: string;
  /** Worst observed value, when the check ran. */
  observed?: number;
  /** Where the worst value came from (heatmap cell), when the check ran. */
  observedAt?: string;
  /** Why the check could NOT run — required whenever status is `not-evaluated`. */
  reason?: string;
}

export interface BalanceReport {
  summary: string;
  heatmap: HeatmapCell[];
  survivalCurves: Record<string, SurvivalCurvePoint[]>;
  dpsBreakdowns: Record<string, DPSBreakdown[]>;
  sensitivity: SensitivityCurve[];
  alerts: BalanceReportAlert[];
  /**
   * WHERE the enemies in this sweep came from — catalog bestiary rows, the
   * hardcoded fixtures, or a mix — plus every bestiary row that could not be
   * hydrated, named with its reason. A survival number is meaningless without
   * it: fixture enemies and authored enemies produce identical-looking numbers.
   */
  enemySource: EnemySourceReport;
  /** Per-law canon conformance outcome for this sweep (incl. laws that could not run). */
  canonChecks: CanonCheckStatus[];
  durationMs: number;
}

export interface PredictiveBalanceConfig {
  levelRange: [number, number];
  levelStep: number;
  iterations: number;
  gearId: string;
  enemyConfigs: { archetypeId: string; count: number; levelOffset: number }[];
  tuning: TuningOverrides;
  sensitivityAttributes: AttributeKey[];
  /**
   * OPTIONAL per-type resist profile (0–1) of the simulated defender, for canon
   * policing ONLY — the fight loop does not read it (the sim's damage model has
   * no resist layer; see RESIST_FACET_MISSING_REASON). Left unset by the shipped
   * config, so `arpg-resists` reports as not-evaluated rather than falsely passing.
   */
  defenderResists?: { type: string; value: number }[];
}

export const DEFAULT_PREDICTIVE_CONFIG: PredictiveBalanceConfig = {
  levelRange: [1, 30],
  levelStep: 3,
  iterations: 200,
  gearId: 'mid-tier',
  enemyConfigs: [
    { archetypeId: 'melee-grunt', count: 3, levelOffset: 0 },
    { archetypeId: 'ranged-caster', count: 1, levelOffset: 0 },
    { archetypeId: 'brute', count: 1, levelOffset: 0 },
    { archetypeId: 'elite-knight', count: 1, levelOffset: 0 },
  ],
  tuning: DEFAULT_TUNING,
  sensitivityAttributes: ['attackPower', 'armor', 'maxHealth', 'critChance'],
};

const ABILITY_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── Canon policing (ARPG-LAWS) ─────────────────────────────────────────────
// The canon-conformance linter (`@/lib/balance/canon-conformance`) already owns
// the laws and reads every threshold out of the canon seed. The economy sim has
// been policed by it since July; the two COMBAT-facing laws had no caller at all,
// so the arena sweep could publish a canon-violating build and nothing said so.
// This wires them, using the same `canon-violation` alert idiom the economy sim
// uses (`src/lib/economy/simulation-engine.ts`).
//
// `checkPricePower` (proj-balance, law 5) is deliberately NOT wired here: it
// polices item price vs power, and the combat sweep carries no item prices — it
// has no `price` anywhere in `AttributeSet` / `GearLoadout` / `CombatAbility`.
// Its home is the item/economy side, not this engine. Left unwired, on purpose.

/**
 * The facets of a sweep the canon linter can police. `null` means the sim holds
 * no such data — which is REPORTED as `not-evaluated`, never silently passed.
 */
export interface CombatCanonFacets {
  /** Defender per-type resist fractions (0–1), or null when the model carries none. */
  resists: { type: string; value: number }[] | null;
  /** Worst (biggest raw hit vs EHP) pairing across the sweep, or null when nothing ran. */
  defense: { ehp: number; biggestHit: number; label: string } | null;
  /** How many heatmap cells breached the one-shot fraction (context for the alert). */
  oneShotBreachCells?: number;
  /** How many heatmap cells were evaluable at all. */
  evaluatedCells?: number;
}

/**
 * Why the resist-cap law cannot be evaluated from an arena sweep today. This is
 * a finding, not a shrug: the sim's damage model (`@/types/combat-simulator`)
 * has ONE flat `armor` stat and no Fire/Cold/Lightning/Chaos resists, and
 * `GearLoadout.bonuses` is keyed by `AttributeKey`, so no resist value exists.
 * Reading the armour soft-cap as if it were a resist would police a DIFFERENT
 * law and report a number canon never meant. The wiring is live regardless —
 * pass resists into `collectCanonFacets` and the check runs.
 */
export const RESIST_FACET_MISSING_REASON =
  'the combat sim models a single flat `armor` stat and no per-type resists ' +
  '(AttributeSet has no Fire/Cold/Lightning/Chaos fields, GearLoadout.bonuses is ' +
  'keyed by AttributeKey) — there is no resist value in the sweep to police';

/**
 * Collect what this sweep can offer the canon linter. Pure.
 *
 * The one-shot facet is the WORST cell in the sweep (highest biggestHit/EHP), so
 * the law is judged on the harshest encounter a designer configured rather than
 * on an average that could hide it. `resists` is passed through — the sweep has
 * none today (see RESIST_FACET_MISSING_REASON), but a caller that has them gets
 * the law policed with no other change.
 */
export function collectCanonFacets(
  heatmap: readonly HeatmapCell[],
  thresholds: CanonThresholds,
  resists: { type: string; value: number }[] | null = null,
): CombatCanonFacets {
  const evaluable = heatmap.filter((c) => c.avgEHP > 0 && c.biggestHit > 0);
  if (evaluable.length === 0) return { resists, defense: null };

  let worst = evaluable[0];
  let worstRatio = worst.biggestHit / worst.avgEHP;
  let breaching = 0;
  for (const c of evaluable) {
    const ratio = c.biggestHit / c.avgEHP;
    if (ratio >= thresholds.oneShotEhpFraction) breaching++;
    if (ratio > worstRatio) { worst = c; worstRatio = ratio; }
  }

  return {
    resists,
    defense: {
      ehp: Math.round(worst.avgEHP),
      biggestHit: Math.round(worst.biggestHit),
      label: `Lv.${worst.playerLevel} vs ${worst.enemyLabel}`,
    },
    oneShotBreachCells: breaching,
    evaluatedCells: evaluable.length,
  };
}

/**
 * Run the combat-facing canon laws over a sweep. Returns one `CanonCheckStatus`
 * per law — including laws that could not run — plus the alert lines for any
 * violation. Pure; the checkers themselves are untouched.
 */
export function lintCombatCanon(
  facets: CombatCanonFacets,
  thresholds: CanonThresholds,
): { alerts: BalanceReportAlert[]; checks: CanonCheckStatus[] } {
  const alerts: BalanceReportAlert[] = [];
  const checks: CanonCheckStatus[] = [];
  const toAlert = (v: CanonViolation, suffix = ''): BalanceReportAlert => ({
    severity: v.severity,
    type: 'canon-violation',
    lawId: v.lawId,
    message: `Canon (${v.law}): ${v.message}${suffix}`,
  });

  // Law 2 — per-type resist cap (arpg-resists).
  const resistAllowed = `≤${(thresholds.resistCap * 100).toFixed(1)}%`;
  if (facets.resists === null) {
    checks.push({
      lawId: 'arpg-resists',
      law: 'Resist cap',
      status: 'not-evaluated',
      allowed: resistAllowed,
      reason: RESIST_FACET_MISSING_REASON,
    });
  } else {
    const violations = checkResistCap(facets.resists, thresholds);
    const worst = facets.resists.reduce(
      (m, r) => (r.value > m.value ? r : m),
      facets.resists[0] ?? { type: 'none', value: 0 },
    );
    for (const v of violations) alerts.push(toAlert(v));
    checks.push({
      lawId: 'arpg-resists',
      law: 'Resist cap',
      status: violations.length > 0 ? 'violation' : 'pass',
      allowed: resistAllowed,
      metric: `${worst.type} resist (highest of ${facets.resists.length})`,
      observed: worst.value,
    });
  }

  // Law 3 — no one-shot at/above the EHP fraction (arpg-defenses).
  const oneShotAllowed = `<${(thresholds.oneShotEhpFraction * 100).toFixed(1)}% of EHP`;
  if (!facets.defense) {
    checks.push({
      lawId: 'arpg-defenses',
      law: 'No one-shots below the EHP floor',
      status: 'not-evaluated',
      allowed: oneShotAllowed,
      reason:
        'the sweep produced no heatmap cell with a positive EHP and a resolvable ' +
        'enemy hit (empty level range, or every encounter archetype unresolved)',
    });
  } else {
    const { ehp, biggestHit, label } = facets.defense;
    const violations = checkOneShot({ ehp, biggestHit }, thresholds);
    const breadth =
      facets.oneShotBreachCells !== undefined && facets.evaluatedCells !== undefined
        ? ` — worst of ${facets.oneShotBreachCells}/${facets.evaluatedCells} sweep cells breaching, at ${label}`
        : ` — at ${label}`;
    for (const v of violations) alerts.push(toAlert(v, breadth));
    checks.push({
      lawId: 'arpg-defenses',
      law: 'No one-shots below the EHP floor',
      status: violations.length > 0 ? 'violation' : 'pass',
      allowed: oneShotAllowed,
      metric: 'biggest raw enemy hit / EHP',
      observed: ehp > 0 ? biggestHit / ehp : 0,
      observedAt: label,
    });
  }

  return { alerts, checks };
}

// ── Main simulation runner ─────────────────────────────────────────────────

/**
 * Run the level x encounter sweep.
 *
 * `enemies` supplies the archetype registry the sweep resolves `archetypeId`
 * against — build it from real bestiary artifacts with
 * `hydrateEnemyRegistryFromBestiary` (see ./simulation-engine) and pass its
 * provenance through, so the report can say which source it used. Omitted =>
 * the hardcoded fixtures, and the report SAYS so rather than implying the
 * numbers describe creatures someone authored.
 */
export function runPredictiveBalance(
  config: PredictiveBalanceConfig,
  enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport },
): BalanceReport {
  const start = performance.now();
  const registry: ArchetypeRegistry = enemies?.registry ?? ENEMY_ARCHETYPE_BY_ID;
  const enemySource: EnemySourceReport = enemies
    ? enemies.provenance ?? HARDCODED_ENEMY_SOURCE
    : HARDCODED_ENEMY_SOURCE;

  const levels: number[] = [];
  for (let l = config.levelRange[0]; l <= config.levelRange[1]; l += config.levelStep) {
    levels.push(l);
  }

  const heatmap: HeatmapCell[] = [];
  const survivalCurves: Record<string, SurvivalCurvePoint[]> = {};
  const dpsBreakdowns: Record<string, DPSBreakdown[]> = {};
  const alerts: BalanceReportAlert[] = [];

  // For each enemy config, sweep across player levels
  for (const ec of config.enemyConfigs) {
    const archetype = registry.get(ec.archetypeId);
    if (!archetype) continue;

    const label = `${ec.count}x ${archetype.name}`;
    const curvePoints: SurvivalCurvePoint[] = [];

    for (const playerLevel of levels) {
      const playerAttrs = buildPlayerAttrs(playerLevel, config.gearId, config.tuning);
      const enemyLevel = playerLevel + ec.levelOffset;

      const enemyInstances = Array.from({ length: ec.count }, () => {
        const attrs = buildEnemyAttrs(archetype, enemyLevel, config.tuning);
        const ability = archetype.abilities[0];
        return { attrs, ability, intervalSec: archetype.attackIntervalSec };
      });

      let wins = 0;
      let totalTTK = 0;
      let totalDPS = 0;
      let totalDealt = 0;
      const abilityDamage: Record<string, number> = {};

      // Fresh, deterministic stream per cell — keyed by (enemy, level) so this
      // cell reproduces identically no matter where it falls in the sweep.
      const cellRng = createXorShift32RNG(seedFromKey(`cell|${ec.archetypeId}|${playerLevel}`, BASE_SEED));
      for (let i = 0; i < config.iterations; i++) {
        const result = simulateFight(playerAttrs, PLAYER_ABILITIES, enemyInstances, config.tuning, cellRng, 120);
        if (result.won) wins++;
        totalTTK += result.durationSec;
        totalDealt += result.damageDealt;
        const dps = result.durationSec > 0 ? result.damageDealt / result.durationSec : 0;
        totalDPS += dps;
      }

      const survivalRate = wins / config.iterations;
      const avgTTK = totalTTK / config.iterations;
      const avgDPS = totalDPS / config.iterations;
      // EHP is derived through the canon armour soft-cap (ARPG-LAWS §8), not the
      // old flat `1 + armour·weight/100`. Armour is soft-capped against hit size,
      // so EHP is measured against a representative incoming hit for this cell.
      const refEnemy = enemyInstances[0];
      const refHit = refEnemy
        ? refEnemy.ability.baseDamage + refEnemy.attrs.attackPower * refEnemy.ability.attackPowerScaling
        : 0;
      const avgEHP = playerAttrs.maxHealth * armourEffectiveHpMultiplier(
        playerAttrs.armor, refHit, config.tuning.armorEffectivenessWeight,
      );

      // Biggest single raw hit this encounter can land (no crit, pre-mitigation) —
      // observation only, for the canon one-shot law. The fight loop is untouched.
      const biggestHit = refEnemy
        ? Math.max(
            0,
            ...archetype.abilities.map(
              (ab) => (ab.baseDamage + refEnemy.attrs.attackPower * ab.attackPowerScaling)
                * config.tuning.enemyDamageMul,
            ),
          )
        : 0;

      heatmap.push({ playerLevel, enemyLabel: label, survivalRate, avgTTK, avgDPS, avgEHP, biggestHit });
      curvePoints.push({ level: playerLevel, survivalRate, avgTTK, avgDPS });

      // Alerts for specific levels
      if (playerLevel === config.levelRange[0] + config.levelStep && survivalRate < 0.3) {
        alerts.push({ severity: 'critical', message: `Lv.${playerLevel} vs ${label}: ${(survivalRate * 100).toFixed(0)}% survival — early game too hard` });
      }
      if (survivalRate > 0.98 && playerLevel < 20) {
        alerts.push({ severity: 'warning', message: `Lv.${playerLevel} vs ${label}: ${(survivalRate * 100).toFixed(0)}% survival — trivially easy` });
      }
      if (avgTTK > 60) {
        alerts.push({ severity: 'info', message: `Lv.${playerLevel} vs ${label}: ${avgTTK.toFixed(1)}s avg fight — consider lowering enemy HP` });
      }
    }

    survivalCurves[label] = curvePoints;

    // DPS breakdown for mid-level
    const midLevel = Math.floor((config.levelRange[0] + config.levelRange[1]) / 2);
    const midAttrs = buildPlayerAttrs(midLevel, config.gearId, config.tuning);
    const dpsItems: DPSBreakdown[] = PLAYER_ABILITIES
      .filter(ab => ab.baseDamage > 0)
      .map((ab, i) => {
        const raw = ab.baseDamage + midAttrs.attackPower * ab.attackPowerScaling;
        const effectiveDPS = raw / Math.max(ab.cooldownSec, ab.castTimeSec);
        return { abilityName: ab.name, avgDamage: effectiveDPS, color: ABILITY_COLORS[i % ABILITY_COLORS.length] };
      })
      .sort((a, b) => b.avgDamage - a.avgDamage);
    dpsBreakdowns[label] = dpsItems;
  }

  // Sensitivity analysis
  const sensitivity: SensitivityCurve[] = [];
  const sensLevel = Math.floor((config.levelRange[0] + config.levelRange[1]) / 2);
  const firstEnemy = config.enemyConfigs[0];
  const sensArchetype = firstEnemy ? registry.get(firstEnemy.archetypeId) : undefined;

  if (sensArchetype && firstEnemy) {
    for (const attr of config.sensitivityAttributes) {
      const baseAttrs = buildPlayerAttrs(sensLevel, config.gearId, config.tuning);
      const baseVal = baseAttrs[attr];
      const range = attr === 'critChance' ? { min: 0.01, max: 0.4, steps: 12 } : { min: baseVal * 0.3, max: baseVal * 2.5, steps: 12 };

      const points: SensitivityPoint[] = [];
      let prevSurvival = 0;
      let diminishingAt: number | null = null;

      for (let s = 0; s <= range.steps; s++) {
        const value = range.min + (range.max - range.min) * (s / range.steps);
        const testAttrs = { ...baseAttrs, [attr]: value };
        if (attr === 'health') testAttrs.maxHealth = value;
        if (attr === 'maxHealth') testAttrs.health = value;

        const enemies = Array.from({ length: firstEnemy.count }, () => ({
          attrs: buildEnemyAttrs(sensArchetype, sensLevel + firstEnemy.levelOffset, config.tuning),
          ability: sensArchetype.abilities[0],
          intervalSec: sensArchetype.attackIntervalSec,
        }));

        let wins = 0;
        let totalTTK = 0;
        let totalDPS = 0;

        // Per-step deterministic stream — keyed by (attribute, step index).
        const stepRng = createXorShift32RNG(seedFromKey(`sens|${attr}|${s}`, BASE_SEED));
        for (let i = 0; i < config.iterations; i++) {
          const r = simulateFight(testAttrs, PLAYER_ABILITIES, enemies, config.tuning, stepRng, 120);
          if (r.won) wins++;
          totalTTK += r.durationSec;
          totalDPS += r.durationSec > 0 ? r.damageDealt / r.durationSec : 0;
        }

        const survivalRate = wins / config.iterations;
        const avgTTK = totalTTK / config.iterations;
        const avgDPS = totalDPS / config.iterations;
        points.push({ value, survivalRate, avgTTK, avgDPS });

        // Detect diminishing returns
        if (s > 1 && diminishingAt === null) {
          const delta = survivalRate - prevSurvival;
          const prevDelta = points.length >= 3 ? points[points.length - 2].survivalRate - points[points.length - 3].survivalRate : delta;
          if (prevDelta > 0.01 && delta < prevDelta * 0.4) {
            diminishingAt = value;
          }
        }
        prevSurvival = survivalRate;
      }

      sensitivity.push({ attribute: attr, points, diminishingAt });
    }
  }

  // Canon conformance: police the COMBAT-facing ARPG-LAWS over this sweep and
  // surface breaches through the same alert channel, tagged `canon-violation`
  // with the law id — the idiom the economy sim already uses. Thresholds come
  // from the canon seed. Laws that cannot be evaluated are recorded as such.
  const thresholds = readCanonThresholds();
  const { alerts: canonAlerts, checks: canonChecks } = lintCombatCanon(
    collectCanonFacets(heatmap, thresholds, config.defenderResists ?? null),
    thresholds,
  );
  alerts.push(...canonAlerts);

  // Build summary
  const midCells = heatmap.filter(c => c.playerLevel === Math.floor((config.levelRange[0] + config.levelRange[1]) / 2));
  const avgSurvival = midCells.length > 0 ? midCells.reduce((s, c) => s + c.survivalRate, 0) / midCells.length : 0;
  const avgTTK = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgTTK, 0) / midCells.length : 0;

  const summary = `Player Lv.${config.levelRange[0]}-${config.levelRange[1]} across ${config.enemyConfigs.length} encounter types: ` +
    `${(avgSurvival * 100).toFixed(0)}% avg mid-level survival, ${avgTTK.toFixed(1)}s avg fight duration. ` +
    `${alerts.filter(a => a.severity === 'critical').length} critical, ${alerts.filter(a => a.severity === 'warning').length} warnings, ` +
    `${canonChecks.filter(c => c.status === 'violation').length} canon violation(s).`;

  return {
    summary,
    heatmap,
    survivalCurves,
    dpsBreakdowns,
    sensitivity,
    alerts,
    enemySource,
    canonChecks,
    durationMs: Math.round(performance.now() - start),
  };
}
