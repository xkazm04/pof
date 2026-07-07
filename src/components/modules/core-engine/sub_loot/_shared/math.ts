import type { TreemapRect, EnemyLootBinding, SimulatedDrop, EVResult } from './data';
import { RARITY_TIERS } from './data';

/* -- Treemap layout ------------------------------------------------------- */

export function computeTreemapLayout(data: TreemapRect[], w: number, h: number) {
  const rects: { x: number; y: number; w: number; h: number; item: TreemapRect }[] = [];
  let x = 0;
  let y = 0;
  let remainingW = w;
  let remainingH = h;
  let remainingProb = data.reduce((s, d) => s + d.probability, 0);
  let horizontal = true;

  // Slice-and-dice: each datum takes its share of the *remaining* strip, then the
  // strip shrinks before the next datum. Using a running index (not data.indexOf,
  // which mis-resolves duplicate probabilities) and decrementing after *every*
  // rect (not just the first) keeps the layout area-conservative — Σ rect.area = w·h
  // and no rect overlaps or overflows the box.
  for (const item of data) {
    if (remainingProb <= 0) break;
    const frac = item.probability / remainingProb;
    if (horizontal) {
      const rw = remainingW * frac;
      rects.push({ x, y, w: Math.max(rw, 0), h: remainingH, item });
      x += rw;
      remainingW -= rw;
    } else {
      const rh = remainingH * frac;
      rects.push({ x, y, w: remainingW, h: Math.max(rh, 0), item });
      y += rh;
      remainingH -= rh;
    }
    remainingProb -= item.probability;
    horizontal = !horizontal;
  }
  return rects;
}

/* -- Drought / Probability math ------------------------------------------- */

/** Cumulative probability of getting >=1 drop in N attempts.
 *  Without pity: P(N) = 1 - (1 - rate)^N
 *  With a hard pity timer T: P(N) = 1 - (1 - rate)^N for N < T, and 1 for N >= T
 *  (pity guarantees a drop AT the threshold and adds nothing before it). */
export function cumulativeProbCurve(
  dropRate: number,
  maxKills: number,
  pityThreshold: number | null,
): { kill: number; probNoPity: number; probWithPity: number }[] {
  const points: { kill: number; probNoPity: number; probWithPity: number }[] = [];
  for (let n = 1; n <= maxKills; n++) {
    const probNoPity = 1 - Math.pow(1 - dropRate, n);
    // Hard pity timer: a drop is *guaranteed* at the threshold, but pity adds no
    // extra probability before it — below T the curve is the plain geometric one.
    // (The old formula bent the curve upward pre-threshold, over-stating early
    // drops and disagreeing with findPercentileKill, which already uses hard pity.)
    const probWithPity = pityThreshold
      ? (n >= pityThreshold ? 1.0 : probNoPity)
      : probNoPity;
    points.push({ kill: n, probNoPity, probWithPity: Math.min(probWithPity, 1) });
  }
  return points;
}

/** Find the kill count where cumulative probability first crosses a threshold */
export function findPercentileKill(dropRate: number, percentile: number, pityThreshold: number | null): number {
  const target = percentile / 100;
  for (let n = 1; n <= 2000; n++) {
    if (pityThreshold && n >= pityThreshold) return n;
    const prob = 1 - Math.pow(1 - dropRate, n);
    if (prob >= target) return n;
  }
  return 2000;
}

/* -- Kill simulation ------------------------------------------------------ */

export function simulateKills(binding: EnemyLootBinding, killCount: number): SimulatedDrop[] {
  const totalWeight = binding.rarityWeights.reduce((s, w) => s + w, 0);
  const counts = binding.rarityWeights.map(() => 0);
  if (totalWeight <= 0) return counts.map((count, rarityIndex) => ({ rarityIndex, count }));

  // Largest-remainder (Hamilton) apportionment so Σ counts === round(expectedDrops)
  // exactly. Rounding each tier independently neither conserves the total nor
  // distributes the remainder — it mints or burns drops (e.g. an even 3-way split
  // of 10 rounds to [3,3,3]=9, losing a drop), and the column never reconciles
  // against killCount·dropChance.
  const target = Math.round(killCount * binding.dropChance);
  const exact = binding.rarityWeights.map((w) => (killCount * binding.dropChance) * (w / totalWeight));
  const floors = exact.map((x) => Math.floor(x));
  let remainder = target - floors.reduce((s, x) => s + x, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floors.length; i++) counts[i] = floors[i];
  for (let k = 0; k < byFraction.length && remainder > 0; k++) {
    counts[byFraction[k].i]++;
    remainder--;
  }

  return counts.map((count, rarityIndex) => ({ rarityIndex, count }));
}

/* -- EV Calculator -------------------------------------------------------- */

export function computeEVResults(
  bindings: EnemyLootBinding[],
  rarityGold: Record<string, number>,
  killsPerHour: number,
  sessionHours: number,
): EVResult[] {
  return bindings.map(b => {
    const totalWeight = b.rarityWeights.reduce((s, w) => s + w, 0);
    let itemEV = 0;
    for (let i = 0; i < RARITY_TIERS.length; i++) {
      const prob = totalWeight > 0 ? b.rarityWeights[i] / totalWeight : 0;
      itemEV += prob * (rarityGold[RARITY_TIERS[i].name] ?? 0);
    }
    itemEV *= b.dropChance;

    const evPerKill = itemEV + b.bonusGold;
    return {
      archetypeId: b.archetypeId,
      archetypeName: b.archetypeName,
      color: b.color,
      evPerKill,
      goldFromItems: itemEV,
      goldFromBonus: b.bonusGold,
      evPerHour: evPerKill * killsPerHour,
      evPerSession: evPerKill * killsPerHour * sessionHours,
    };
  });
}
