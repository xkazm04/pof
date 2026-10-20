/**
 * Pure, rng-injected cohort simulation for the Pity tab: N players each kill until
 * their first drop (probability `rate` per kill), with an optional hard pity
 * threshold that forces the drop at kill T. Mirrors the model behind
 * findPercentileKill/cumulativeProbCurve so the two can be cross-checked.
 */
import { findPercentileKill } from '../_shared/math';

export type Rng = () => number;

export const DEFAULT_COHORT_PLAYERS = 5000;
/** Same horizon findPercentileKill gives up at. */
export const DEFAULT_COHORT_CAP = 2000;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CohortInput {
  rate: number;
  threshold: number | null;
  players: number;
  rng: Rng;
  cap?: number;
}

export interface CohortResult {
  /** Kills-to-first-drop per player, ascending. */
  kills: number[];
  threshold: number | null;
  rate: number;
  /** True when at least one player hit the cap without a drop or a pity force. */
  capped: boolean;
}

export function simulateCohort({ rate, threshold, players, rng, cap = DEFAULT_COHORT_CAP }: CohortInput): CohortResult {
  const n = Math.max(0, Math.floor(players));
  const pity = threshold && threshold > 0 ? Math.floor(threshold) : null;
  const limit = pity !== null ? Math.min(pity, cap) : cap;
  const kills: number[] = new Array(n);
  let capped = false;
  // Geometric sample by inversion: kills = ceil(ln(1-u) / ln(1-rate)).
  const lnMiss = rate >= 1 || rate <= 0 ? 0 : Math.log(1 - rate);
  for (let i = 0; i < n; i++) {
    const u = rng();
    let k: number;
    if (rate >= 1) k = 1;
    else if (rate <= 0) k = Infinity;
    else k = Math.max(1, Math.ceil(Math.log(1 - u) / lnMiss));
    if (k > limit) {
      k = limit;
      if (pity === null || limit < pity) capped = true;
    }
    kills[i] = k;
  }
  kills.sort((a, b) => a - b);
  return { kills, threshold: pity, rate, capped };
}

/** Nearest-rank percentiles; an empty sample yields nulls. */
export function cohortPercentiles(kills: readonly number[], percentiles: readonly number[]): (number | null)[] {
  if (kills.length === 0) return percentiles.map(() => null);
  return percentiles.map((p) => {
    const rank = Math.min(kills.length, Math.max(1, Math.ceil((p / 100) * kills.length)));
    return kills[rank - 1];
  });
}

export interface AnalyticComparison {
  observedP95: number | null;
  analyticP95: number;
  tolerance: number;
  ok: boolean;
}

/** Drift check of the simulated p95 against the analytic findPercentileKill. */
export function compareToAnalytic(cohort: CohortResult, rate: number, threshold: number | null): AnalyticComparison {
  const analyticP95 = findPercentileKill(rate, 95, threshold);
  const [observedP95] = cohortPercentiles(cohort.kills, [95]);
  // Quantile sampling error shrinks with sqrt(players); keep a floor of 2 kills.
  const tolerance = Math.max(2, Math.ceil(analyticP95 * (20 / Math.sqrt(Math.max(cohort.kills.length, 1)))));
  return {
    observedP95, analyticP95, tolerance,
    ok: observedP95 !== null && Math.abs(observedP95 - analyticP95) <= tolerance,
  };
}

export interface PityBenefit {
  p99Saved: number;
  worstCaseSaved: number;
  /** Percent (0-100) of no-pity players who would have waited past the pity threshold. */
  playersHelpedPct: number;
}

export function pityBenefit(noPity: CohortResult, withPity: CohortResult): PityBenefit {
  const [p99No] = cohortPercentiles(noPity.kills, [99]);
  const [p99Pity] = cohortPercentiles(withPity.kills, [99]);
  const worstNo = noPity.kills.length ? noPity.kills[noPity.kills.length - 1] : 0;
  const worstPity = withPity.kills.length ? withPity.kills[withPity.kills.length - 1] : 0;
  const t = withPity.threshold;
  const helped = t === null ? 0 : noPity.kills.filter((k) => k > t).length;
  return {
    p99Saved: Math.max(0, (p99No ?? 0) - (p99Pity ?? 0)),
    worstCaseSaved: Math.max(0, worstNo - worstPity),
    playersHelpedPct: noPity.kills.length ? (helped / noPity.kills.length) * 100 : 0,
  };
}
