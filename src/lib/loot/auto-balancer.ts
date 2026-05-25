/**
 * Loot goal-seek auto-balancer (ECW Phase 10-L round 2 — consolidates ideas
 * 0b7d17a0/1aa2d0a2/1d82300f/eed3b9d2). The "Excel Goal Seek" pattern applied to
 * a loot binding: given a target gold-per-kill, solve for the rarity-weight
 * distribution that hits it. Pure.
 *
 * Math: hold dropChance + bonusGold fixed and lerp the (sum-100) weight vector
 * between the current distribution and an extreme (all-Legendary to raise EV,
 * all-Common to lower it). Because the weights sum stays 100, EV is LINEAR in
 * the lerp parameter α, so α solves in closed form — no iterative search.
 */

import { RARITY_ORDER, computeExpectedValue, type LootBindingLike } from './economy';
import { DEFAULT_RARITY_GOLD } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

type RarityGold = Record<string, number>;

export interface BalanceProposal {
  targetEV: number;
  currentEV: number;
  /** EV produced by the proposed (integer, sum-100) weights. */
  achievedEV: number;
  /** Proposed rarityWeights, integers summing to 100. */
  weights: number[];
  /** True when reweighting alone reaches the target (α landed within [0,1]). */
  reachable: boolean;
  note: string;
}

function goldAt(i: number, rarityGold: RarityGold): number {
  const rarity = RARITY_ORDER[i];
  return rarity ? rarityGold[rarity] ?? 0 : 0;
}

/** Normalise a weight vector to sum 100 (returns zeros if the input sums to 0). */
function toSum100(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  return weights.map((w) => (w / sum) * 100);
}

/** Round to integers and force the sum to exactly 100 by adjusting the largest. */
function roundToSum100(weights: number[]): number[] {
  const rounded = weights.map((w) => Math.round(w));
  const drift = 100 - rounded.reduce((s, w) => s + w, 0);
  if (drift !== 0 && rounded.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    rounded[maxIdx] += drift;
  }
  return rounded;
}

export function solveWeightsForTargetEV(
  binding: LootBindingLike,
  targetEV: number,
  rarityGold: RarityGold = DEFAULT_RARITY_GOLD,
): BalanceProposal {
  const currentEV = computeExpectedValue(binding, rarityGold);
  const d = binding.dropChance;
  const g = binding.bonusGold;
  const cw = toSum100(binding.rarityWeights);

  const hi = RARITY_ORDER.reduce((best, _, i) => (goldAt(i, rarityGold) > goldAt(best, rarityGold) ? i : best), 0);
  const lo = RARITY_ORDER.reduce((best, _, i) => (goldAt(i, rarityGold) < goldAt(best, rarityGold) ? i : best), 0);
  const extremeIdx = targetEV >= currentEV ? hi : lo;
  const extreme: number[] = RARITY_ORDER.map((_, i) => (i === extremeIdx ? 100 : 0));

  // Sum-weighted gold of each distribution; EV(α) = d/100 · ((1-α)A + αE) + g.
  const A = cw.reduce((s, w, i) => s + w * goldAt(i, rarityGold), 0);
  const E = extreme.reduce((s, w, i) => s + w * goldAt(i, rarityGold), 0);
  const denom = E - A;

  let alpha = 0;
  let reachable = false;
  if (d > 0 && denom !== 0) {
    const K = ((targetEV - g) * 100) / d; // required (1-α)A + αE
    const alphaRaw = (K - A) / denom;
    reachable = alphaRaw >= -1e-6 && alphaRaw <= 1 + 1e-6;
    alpha = Math.min(1, Math.max(0, alphaRaw));
  } else {
    // dropChance 0 (or degenerate) → reweighting can't move EV (EV == bonus gold).
    reachable = Math.abs(g - targetEV) < 1;
    alpha = 0;
  }

  const blended = cw.map((w, i) => w * (1 - alpha) + extreme[i] * alpha);
  const weights = roundToSum100(blended);
  const achievedEV = computeExpectedValue({ ...binding, rarityWeights: weights }, rarityGold);

  const note = reachable
    ? 'Reweighting reaches the target — apply to retune the drop distribution.'
    : 'Target is beyond what reweighting alone can reach; also adjust drop chance or bonus gold.';

  return { targetEV, currentEV, achievedEV, weights, reachable, note };
}
