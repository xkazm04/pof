/**
 * Combat goal-seek lever — "auto-balance combat to a target".
 *
 * Generalizes the analytic combo-tuner to a lever with no closed form: a
 * `TuningOverrides` multiplier → the seeded Monte-Carlo sim's survival rate (or
 * average TTK). The sim averages over `config.iterations` from a FIXED seed, so
 * `metric(v)` is deterministic — bisection via the shared `solveFor` converges on
 * the real curve, not the noise.
 */

import type { CombatScenario, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';
import { runCombatSimulation } from './simulation-engine';
import { solveFor, type SolveOptions, type SolveResult } from '@/lib/balance/goal-seek';

/** Tuning knobs that are continuous multipliers (the slider levers). */
export type CombatLever = Extract<
  keyof TuningOverrides,
  'playerHealthMul' | 'playerDamageMul' | 'playerArmorMul' | 'enemyHealthMul' | 'enemyDamageMul' | 'critMultiplierMul' | 'armorEffectivenessWeight' | 'healingMul'
>;

export type CombatGoalMetric = 'survival' | 'ttk';

export interface CombatGoalSeekResult extends SolveResult {
  lever: CombatLever;
  metricKind: CombatGoalMetric;
  leverRange: [number, number];
}

/**
 * Solve for the tuning multiplier `lever` that drives the chosen metric to
 * `target`. `survival` is a 0–1 rate; `ttk` is average fight seconds. The lever
 * searches [min, max] (default the slider band 0.5–2.0). Survival/TTK are
 * monotonic in each single multiplier over that band, so bisection is well-posed.
 */
export function solveCombatTuningForTarget(
  scenario: CombatScenario,
  baseTuning: TuningOverrides,
  config: CombatSimConfig,
  lever: CombatLever,
  target: number,
  metricKind: CombatGoalMetric = 'survival',
  opts: SolveOptions & { leverRange?: [number, number] } = {},
): CombatGoalSeekResult {
  const leverRange = opts.leverRange ?? [0.5, 2.0];

  const metric = (value: number): number => {
    const tuning: TuningOverrides = { ...baseTuning, [lever]: value };
    const result = runCombatSimulation(scenario, tuning, config);
    return metricKind === 'survival' ? result.summary.survivalRate : result.summary.avgFightDurationSec;
  };

  const result = solveFor(target, { min: leverRange[0], max: leverRange[1] }, metric, opts);
  return { ...result, lever, metricKind, leverRange };
}
