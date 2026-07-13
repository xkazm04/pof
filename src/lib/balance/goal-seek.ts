/**
 * Generalized goal-seek solver — the "Excel Goal Seek" for any simulator lever.
 *
 * Given a target metric value and a lever range, bisect for the lever value whose
 * metric hits the target within tolerance. Two solvers already existed but were
 * WIRED TO NOTHING (loot/auto-balancer.solveWeightsForTargetEV closed-form;
 * combat/combo-tuner.tuneComboToTargetDps analytic); this is the shared numeric
 * engine that generalizes them to levers with NO closed form (an economy
 * faucet/sink amount → net-flow, a combat tuning multiplier → survival/TTK).
 *
 * Contract:
 *  - `metric` MUST be (approximately) MONOTONIC in the lever over [min, max].
 *  - Bisect on a SEEDED/AVERAGED metric — Monte-Carlo noise makes an unseeded
 *    metric non-monotonic and bisection chases the noise. Callers pass a fixed
 *    seed so `metric(v)` is a deterministic function of `v`.
 *  - Out-of-range targets return gracefully (converged:false, nearest endpoint +
 *    the reason) rather than throwing.
 */

export interface SolveOptions {
  /** Absolute tolerance on the metric. Default: max(1e-6, |target|·0.005). */
  tolerance?: number;
  /** Max bisection iterations. Default 48. */
  maxIterations?: number;
}

export interface SolveResult {
  target: number;
  /** The lever value found (or the nearest reachable endpoint if out of range). */
  solvedValue: number;
  /** The metric produced by `solvedValue`. */
  achievedMetric: number;
  /** Number of metric evaluations performed. */
  iterations: number;
  converged: boolean;
  reason: string;
}

export function solveFor(
  target: number,
  lever: { min: number; max: number },
  metric: (leverValue: number) => number,
  opts: SolveOptions = {},
): SolveResult {
  const tol = opts.tolerance ?? Math.max(1e-6, Math.abs(target) * 0.005);
  const maxIterations = opts.maxIterations ?? 48;

  let { min, max } = lever;
  if (min > max) [min, max] = [max, min];

  let evals = 0;
  const evalAt = (v: number) => { evals++; return metric(v); };

  const fMin = evalAt(min);
  const fMax = evalAt(max);

  // Nearest-endpoint fallback used by every non-bracketed exit.
  const nearest = (): SolveResult => {
    const dMin = Math.abs(fMin - target);
    const dMax = Math.abs(fMax - target);
    const useMin = dMin <= dMax;
    const solvedValue = useMin ? min : max;
    const achievedMetric = useMin ? fMin : fMax;
    const converged = Math.min(dMin, dMax) <= tol;
    return {
      target, solvedValue, achievedMetric, iterations: evals, converged,
      reason: converged
        ? 'Target reachable only at a lever bound; returned that bound.'
        : `Target ${target} is outside the achievable range [${Math.min(fMin, fMax)}, ${Math.max(fMin, fMax)}] over lever [${min}, ${max}] — clamped to the nearest reachable value.`,
    };
  };

  // Degenerate: flat metric across the range.
  if (fMin === fMax) {
    return Math.abs(fMin - target) <= tol
      ? { target, solvedValue: min, achievedMetric: fMin, iterations: evals, converged: true, reason: 'Metric is flat across the lever range and already meets the target.' }
      : nearest();
  }

  const increasing = fMax > fMin;
  // Bracketing check (respecting direction).
  const lowVal = increasing ? fMin : fMax;
  const highVal = increasing ? fMax : fMin;
  if (target < lowVal - tol || target > highVal + tol) return nearest();

  // Bisection.
  let lo = min, hi = max;
  let mid = (lo + hi) / 2;
  let fMid = target; // placeholder
  for (let i = 0; i < maxIterations; i++) {
    mid = (lo + hi) / 2;
    fMid = evalAt(mid);
    if (Math.abs(fMid - target) <= tol) {
      return { target, solvedValue: mid, achievedMetric: fMid, iterations: evals, converged: true, reason: `Converged in ${evals} evaluations.` };
    }
    // Move the bound so the target stays bracketed.
    const below = fMid < target;
    if (increasing ? below : !below) lo = mid; else hi = mid;
  }

  return {
    target, solvedValue: mid, achievedMetric: fMid, iterations: evals, converged: false,
    reason: `Did not reach tolerance ${tol} within ${maxIterations} iterations; best lever ${mid} → ${fMid}.`,
  };
}
