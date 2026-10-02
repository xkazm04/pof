/**
 * Predictive Balance Simulation — the level x encounter sweep.
 *
 * Sweeps player levels × enemy compositions to produce survival heatmaps, DPS
 * breakdowns, and sensitivity analysis. It owns NO fight loop: every heatmap
 * cell and sensitivity step is one `runCombatSimulation` call into the combat
 * engine (./simulation-engine), so the numbers on this tab describe the same
 * fight the Combat Simulator, goal-seek and feedback comparison resolve
 * (game-production/encounter-balance-simulation#one-kernel).
 *
 * The sweep is planned once (`planPredictiveSweep`) and drained two ways:
 * `runPredictiveBalance` (sync — tests, headless) and
 * `runPredictiveBalanceAsync` (a cancellable job that yields between AND inside
 * cells, so the UI thread is never pinned by the engine's cost).
 */

import type {
  AttributeSet, AttributeKey, CombatSimConfig, CombatSummary, EnemyArchetype, GearLoadout, TuningOverrides,
} from '@/types/combat-simulator';
import {
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
  runCombatSimulation,
  runCombatSimulationBatched,
  buildPlayerAttributes,
  buildEnemyAttributes,
  yieldToEventLoop,
  type ArchetypeRegistry,
  type EnemySourceReport,
  type OverrideCombatScenario,
} from '@/lib/combat/simulation-engine';
import { armourEffectiveHpMultiplier } from '@/lib/combat/canon-kernel';

// ── Seeds ───────────────────────────────────────────────────────────────────
// Each cell/step seeds its OWN engine run from a key, so results are
// order-independent (#per-cell-seed-derivation-for-order-independence).

/** Base seed for the sweep — every cell/step derives a stream from this. */
const BASE_SEED = 42;

/**
 * Derive a stable 32-bit seed from a key string (FNV-1a style). Each heatmap
 * cell and sensitivity step seeds its OWN engine run from its parameters, so a
 * cell's result is reproducible regardless of the order cells are evaluated in.
 */
function seedFromKey(key: string, base: number): number {
  let h = base | 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  }
  return (h | 0) || 1;
}

/** The engine seed of the heatmap cell (archetype, player level). */
export function sweepCellSeed(archetypeId: string, playerLevel: number): number {
  return seedFromKey(`cell|${archetypeId}|${playerLevel}`, BASE_SEED);
}

/** Longest fight a sweep cell simulates before calling it a draw. */
const SWEEP_MAX_FIGHT_SEC = 120;

/**
 * Fights per batch inside one cell of the async job. A 1000-iteration cell can
 * cost 35–166 ms, so the job yields every batch (and checks its AbortSignal).
 */
export const SWEEP_BATCH_SIZE = 200;

// ── Public types ───────────────────────────────────────────────────────────

export interface HeatmapCell {
  playerLevel: number;
  enemyLabel: string;
  /** Index of this cell's encounter in `config.enemyConfigs` (= `BalanceReport.encounters[].index`). */
  encounterIndex: number;
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

/** One swept encounter: its `config.enemyConfigs` index and its (unique) label. */
export interface SweepEncounter {
  index: number;
  label: string;
  archetypeId: string;
}

export interface BalanceReport {
  summary: string;
  /**
   * The sweep's own axes. Surfaces render the heatmap from these, never from the
   * live config (which may have been edited since the run).
   */
  levels: number[];
  /** Encounters that resolved against the registry, in report order. */
  encounters: SweepEncounter[];
  /**
   * The swept level the headline, DPS breakdown and sensitivity steps use: the
   * level on the grid nearest the middle of `levelRange` (always one of `levels`
   * when any level was swept).
   */
  midLevel: number;
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

// ── The sweep plan ─────────────────────────────────────────────────────────

/** One engine run of the sweep: a heatmap cell or a sensitivity step. */
export interface SweepUnit {
  scenario: OverrideCombatScenario;
  sim: CombatSimConfig;
}

/**
 * A planned sweep: the engine runs to make, in report order, and how to fold
 * their summaries into a `BalanceReport`. Pure — planning runs no fights.
 */
export interface SweepPlan {
  registry: ArchetypeRegistry;
  units: SweepUnit[];
  assemble(summaries: readonly CombatSummary[], durationMs: number): BalanceReport;
}

type EncounterConfig = PredictiveBalanceConfig['enemyConfigs'][number];

/**
 * Plan the level x encounter sweep (+ sensitivity steps) against `enemies`.
 *
 * `enemies` supplies the archetype registry the sweep resolves `archetypeId`
 * against — build it from real bestiary artifacts with
 * `hydrateEnemyRegistryFromBestiary` (see ./simulation-engine) and pass its
 * provenance through, so the report can say which source it used. Omitted =>
 * the hardcoded fixtures, and the report SAYS so rather than implying the
 * numbers describe creatures someone authored.
 */
export function planPredictiveSweep(
  config: PredictiveBalanceConfig,
  enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport },
): SweepPlan {
  const registry: ArchetypeRegistry = enemies?.registry ?? ENEMY_ARCHETYPE_BY_ID;
  const enemySource: EnemySourceReport = enemies
    ? enemies.provenance ?? HARDCODED_ENEMY_SOURCE
    : HARDCODED_ENEMY_SOURCE;
  const { tuning } = config;
  const gear: GearLoadout = GEAR_LOADOUTS.find(g => g.id === config.gearId)
    ?? { id: config.gearId, name: config.gearId, bonuses: {} };

  const levels: number[] = [];
  for (let l = config.levelRange[0]; l <= config.levelRange[1]; l += config.levelStep) {
    levels.push(l);
  }
  const midLevel = sweptMidLevel(levels, config.levelRange);

  const scenarioFor = (level: number, ec: EncounterConfig, label: string): OverrideCombatScenario => ({
    name: `Lv.${level} vs ${label}`,
    playerLevel: level,
    playerGear: gear,
    playerAbilities: PLAYER_ABILITIES,
    enemies: [{ archetypeId: ec.archetypeId, count: ec.count, level: level + ec.levelOffset }],
  });
  const simFor = (seed: number): CombatSimConfig => ({
    iterations: config.iterations, seed, maxFightDurationSec: SWEEP_MAX_FIGHT_SEC,
  });

  // Heatmap cells: encounter-major, level-minor (the report's order).
  const encounters: { ec: EncounterConfig; archetype: EnemyArchetype; label: string; index: number }[] = [];
  for (const [index, ec] of config.enemyConfigs.entries()) {
    const archetype = registry.get(ec.archetypeId);
    if (archetype) encounters.push({ ec, archetype, label: `${ec.count}x ${archetype.name}`, index });
  }
  uniquifyLabels(encounters);
  const units: SweepUnit[] = [];
  for (const { ec, label } of encounters) {
    for (const level of levels) {
      units.push({ scenario: scenarioFor(level, ec, label), sim: simFor(sweepCellSeed(ec.archetypeId, level)) });
    }
  }

  // Sensitivity steps: the mid-level player vs the FIRST encounter, one attribute
  // pinned per step (applied after scaling, through the engine's own override).
  const firstEnemy = config.enemyConfigs[0];
  const sensArchetype = firstEnemy ? registry.get(firstEnemy.archetypeId) : undefined;
  const sensAttrs: AttributeKey[] = firstEnemy && sensArchetype ? config.sensitivityAttributes : [];
  const sensBase = buildPlayerAttributes(midLevel, gear.bonuses, tuning);
  const SENS_STEPS = 12;
  const sensValues = new Map<AttributeKey, number[]>();
  for (const attr of sensAttrs) {
    const baseVal = sensBase[attr];
    const range = attr === 'critChance' ? { min: 0.01, max: 0.4 } : { min: baseVal * 0.3, max: baseVal * 2.5 };
    const values: number[] = [];
    for (let s = 0; s <= SENS_STEPS; s++) {
      const value = range.min + (range.max - range.min) * (s / SENS_STEPS);
      values.push(value);
      const overrides: Partial<AttributeSet> = { [attr]: value };
      if (attr === 'health') overrides.maxHealth = value;
      if (attr === 'maxHealth') overrides.health = value;
      units.push({
        scenario: {
          ...scenarioFor(midLevel, firstEnemy, `${firstEnemy.count}x ${sensArchetype!.name}`),
          playerAttributeOverrides: overrides,
        },
        sim: simFor(seedFromKey(`sens|${attr}|${s}`, BASE_SEED)),
      });
    }
    sensValues.set(attr, values);
  }

  const assemble = (summaries: readonly CombatSummary[], durationMs: number): BalanceReport => {
    // Each unit's engine summary, in plan order: survival, TTK (= the engine's
    // average fight duration) and DPS read straight from the one kernel.
    let next = 0;
    const take = () => {
      const s = summaries[next++];
      return { survivalRate: s.survivalRate, avgTTK: s.avgFightDurationSec, avgDPS: s.avgDPS };
    };
    const heatmap: HeatmapCell[] = [];
    const survivalCurves: Record<string, SurvivalCurvePoint[]> = {};
    const dpsBreakdowns: Record<string, DPSBreakdown[]> = {};
    const alerts: BalanceReportAlert[] = [];
    const midAttrs = buildPlayerAttributes(midLevel, gear.bonuses, tuning);

    for (const { ec, archetype, label, index: encounterIndex } of encounters) {
      const curvePoints: SurvivalCurvePoint[] = [];
      for (const playerLevel of levels) {
        const { survivalRate, avgTTK, avgDPS } = take();
        // Observed from the engine's OWN builders — the rounded attributes the
        // fight used. EHP goes through the canon armour soft-cap (ARPG-LAWS §8)
        // against a representative incoming hit for this cell.
        const playerAttrs = buildPlayerAttributes(playerLevel, gear.bonuses, tuning);
        const refAttrs = buildEnemyAttributes(archetype, playerLevel + ec.levelOffset, tuning);
        const refAbility = archetype.abilities[0];
        const hasRef = ec.count > 0 && refAbility !== undefined;
        const refHit = hasRef ? refAbility.baseDamage + refAttrs.attackPower * refAbility.attackPowerScaling : 0;
        const avgEHP = playerAttrs.maxHealth * armourEffectiveHpMultiplier(
          playerAttrs.armor, refHit, tuning.armorEffectivenessWeight,
        );
        // Biggest single raw hit this encounter can land (no crit, pre-mitigation) —
        // observation only, for the canon one-shot law.
        const biggestHit = ec.count > 0
          ? Math.max(0, ...archetype.abilities.map(
              (ab) => (ab.baseDamage + refAttrs.attackPower * ab.attackPowerScaling) * tuning.enemyDamageMul,
            ))
          : 0;

        heatmap.push({ playerLevel, enemyLabel: label, encounterIndex, survivalRate, avgTTK, avgDPS, avgEHP, biggestHit });
        curvePoints.push({ level: playerLevel, survivalRate, avgTTK, avgDPS });

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

      // DPS breakdown for mid-level (static per-ability rate, not a fight).
      dpsBreakdowns[label] = PLAYER_ABILITIES
        .filter(ab => ab.baseDamage > 0)
        .map((ab, i) => {
          const raw = ab.baseDamage + midAttrs.attackPower * ab.attackPowerScaling;
          const effectiveDPS = raw / Math.max(ab.cooldownSec, ab.castTimeSec);
          return { abilityName: ab.name, avgDamage: effectiveDPS, color: ABILITY_COLORS[i % ABILITY_COLORS.length] };
        })
        .sort((a, b) => b.avgDamage - a.avgDamage);
    }

    const sensitivity: SensitivityCurve[] = [];
    for (const attr of sensAttrs) {
      const points: SensitivityPoint[] = [];
      let prevSurvival = 0;
      let diminishingAt: number | null = null;
      for (const [s, value] of (sensValues.get(attr) ?? []).entries()) {
        const { survivalRate, avgTTK, avgDPS } = take();
        points.push({ value, survivalRate, avgTTK, avgDPS });
        // Detect diminishing returns
        if (s > 1 && diminishingAt === null) {
          const delta = survivalRate - prevSurvival;
          const prevDelta = points.length >= 3 ? points[points.length - 2].survivalRate - points[points.length - 3].survivalRate : delta;
          if (prevDelta > 0.01 && delta < prevDelta * 0.4) diminishingAt = value;
        }
        prevSurvival = survivalRate;
      }
      sensitivity.push({ attribute: attr, points, diminishingAt });
    }

    // Canon conformance: police the COMBAT-facing ARPG-LAWS over this sweep and
    // surface breaches through the same alert channel, tagged `canon-violation`
    // with the law id. Thresholds come from the canon seed; laws that cannot be
    // evaluated are recorded as such.
    const thresholds = readCanonThresholds();
    const { alerts: canonAlerts, checks: canonChecks } = lintCombatCanon(
      collectCanonFacets(heatmap, thresholds, config.defenderResists ?? null),
      thresholds,
    );
    alerts.push(...canonAlerts);

    const midCells = heatmap.filter(c => c.playerLevel === midLevel);
    const avgSurvival = midCells.length > 0 ? midCells.reduce((s, c) => s + c.survivalRate, 0) / midCells.length : 0;
    const avgTTK = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgTTK, 0) / midCells.length : 0;
    const summary = `Player Lv.${config.levelRange[0]}-${config.levelRange[1]} across ${config.enemyConfigs.length} encounter types: ` +
      `${(avgSurvival * 100).toFixed(0)}% avg survival at mid-level Lv.${midLevel}, ${avgTTK.toFixed(1)}s avg fight duration. ` +
      `${alerts.filter(a => a.severity === 'critical').length} critical, ${alerts.filter(a => a.severity === 'warning').length} warnings, ` +
      `${canonChecks.filter(c => c.status === 'violation').length} canon violation(s).`;

    return {
      summary,
      levels: [...levels],
      encounters: encounters.map(({ index, label, ec }) => ({ index, label, archetypeId: ec.archetypeId })),
      midLevel,
      heatmap, survivalCurves, dpsBreakdowns, sensitivity, alerts, enemySource, canonChecks, durationMs,
    };
  };

  return { registry, units, assemble };
}

/** The swept level nearest the middle of the range (ties → the lower level). */
function sweptMidLevel(levels: readonly number[], range: readonly [number, number]): number {
  const middle = Math.floor((range[0] + range[1]) / 2);
  let best = levels[0] ?? middle;
  for (const l of levels) if (Math.abs(l - middle) < Math.abs(best - middle)) best = l;
  return best;
}

/**
 * Make encounter labels unique — the label keys curves, breakdowns and alerts.
 * A collision is told apart by level offset (`(Lv+5)`), then by position (`#2`).
 */
function uniquifyLabels(encounters: { ec: EncounterConfig; label: string; index: number }[]): void {
  const count = (label: string) => encounters.filter(e => e.label === label).length;
  for (const e of encounters.filter(x => count(x.label) > 1)) {
    const off = e.ec.levelOffset;
    e.label = `${e.label} (Lv${off >= 0 ? '+' : ''}${off})`;
  }
  for (const e of encounters.filter(x => count(x.label) > 1)) e.label = `${e.label} #${e.index + 1}`;
}

// ── Runners: one plan, two drains ──────────────────────────────────────────

/** Run the whole sweep synchronously (tests, headless callers). */
export function runPredictiveBalance(
  config: PredictiveBalanceConfig,
  enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport },
): BalanceReport {
  const start = performance.now();
  const plan = planPredictiveSweep(config, enemies);
  const summaries = plan.units.map(u => runCombatSimulation(u.scenario, config.tuning, u.sim, plan.registry).summary);
  return plan.assemble(summaries, Math.round(performance.now() - start));
}

export interface PredictiveSweepJobOptions {
  /** Aborting resolves the job `{ aborted: true }` at its next yield. */
  signal?: AbortSignal;
  /** `(0, total)` before the first cell, then `(k, total)` after each cell. */
  onProgress?: (done: number, total: number) => void;
}

/** A job's outcome: the report (same as the sync runner's), or aborted — never partial. */
export type PredictiveSweepResult = (BalanceReport & { aborted?: undefined }) | { aborted: true };

/**
 * Run the sweep as a cancellable job. Same plan, same engine runs, same report
 * as `runPredictiveBalance` — but each cell drains through
 * `runCombatSimulationBatched` in `SWEEP_BATCH_SIZE` batches, yielding to the
 * event loop between batches and between cells, with `signal` checked at every
 * yield. An abort resolves `{ aborted: true }`; no partial report is produced.
 */
export async function runPredictiveBalanceAsync(
  config: PredictiveBalanceConfig,
  enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport },
  opts: PredictiveSweepJobOptions = {},
): Promise<PredictiveSweepResult> {
  const { signal, onProgress } = opts;
  const start = performance.now();
  const plan = planPredictiveSweep(config, enemies);
  const total = plan.units.length;
  const summaries: CombatSummary[] = [];
  onProgress?.(0, total);
  try {
    // Hand the caller's frame back before the first fight.
    await yieldToEventLoop();
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) return { aborted: true };
      const u = plan.units[i];
      const result = await runCombatSimulationBatched(u.scenario, config.tuning, u.sim, {
        batchSize: SWEEP_BATCH_SIZE, archetypes: plan.registry, signal,
      });
      if (signal?.aborted) return { aborted: true };
      summaries.push(result.summary);
      onProgress?.(i + 1, total);
      if (i + 1 < total) await yieldToEventLoop();
    }
  } catch (err) {
    if (signal?.aborted) return { aborted: true };
    throw err;
  }
  if (signal?.aborted) return { aborted: true };
  return plan.assemble(summaries, Math.round(performance.now() - start));
}
