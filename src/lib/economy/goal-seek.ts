/**
 * Economy goal-seek lever — "auto-balance the economy to a target".
 *
 * Generalizes the closed-form loot auto-balancer to a lever with no closed form:
 * a faucet/sink `baseAmount` → the seeded engine's net-flow (or Gini). Bisects via
 * the shared `solveFor` over the sweep's deterministic re-run primitive
 * (`runWithFlowOverride`), so it chases the true metric, not Monte-Carlo noise.
 */

import type { SimulationConfig } from '@/types/economy-simulator';
import { runWithFlowOverride, type SweepOutput } from './sensitivity-sweep';
import { getAllFlows } from './definitions';
import { solveFor, type SolveOptions, type SolveResult } from '@/lib/balance/goal-seek';

export interface EconomyGoalSeekResult extends SolveResult {
  flowId: string;
  output: SweepOutput;
  /** The flow's shipped baseAmount, for reference. */
  baseValue: number;
  /** The lever range searched, [min, max] of baseAmount. */
  leverRange: [number, number];
}

/**
 * Solve for the `baseAmount` of one faucet/sink that drives `output` to `target`.
 * The lever searches [0, baseValue × maxMultiplier] (default 6×). Net-flow is
 * monotonic in a single flow's amount (a faucet raises it, a sink lowers it), so
 * bisection is well-posed.
 */
export function solveEconomyFlowForTarget(
  config: SimulationConfig,
  flowId: string,
  target: number,
  output: SweepOutput = 'netFlow',
  opts: SolveOptions & { maxMultiplier?: number } = {},
): EconomyGoalSeekResult {
  const flow = getAllFlows().find((f) => f.id === flowId);
  if (!flow) {
    return {
      target, solvedValue: 0, achievedMetric: 0, iterations: 0, converged: false,
      reason: `Unknown flow "${flowId}".`, flowId, output, baseValue: 0, leverRange: [0, 0],
    };
  }
  const baseValue = flow.baseAmount;
  const maxMultiplier = opts.maxMultiplier ?? 6;
  const leverRange: [number, number] = [0, Math.max(baseValue * maxMultiplier, 1)];

  const result = solveFor(
    target,
    { min: leverRange[0], max: leverRange[1] },
    (amount) => runWithFlowOverride(config, flowId, amount, output),
    opts,
  );

  return { ...result, flowId, output, baseValue, leverRange };
}
