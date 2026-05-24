import type { TreemapRect, EnemyLootBinding, SimulatedDrop, EVResult } from './data';
import { RARITY_TIERS } from './data';

/* -- Treemap layout ------------------------------------------------------- */

export function computeTreemapLayout(data: TreemapRect[], w: number, h: number) {
  const total = data.reduce((s, d) => s + d.probability, 0);
  const rects: { x: number; y: number; w: number; h: number; item: TreemapRect }[] = [];
  let x = 0;
  let y = 0;
  let remainingW = w;
  let remainingH = h;
  let horizontal = true;

  for (const item of data) {
    const ratio = item.probability / total;
    if (horizontal) {
      const rw = remainingW * ratio / (data.slice(data.indexOf(item)).reduce((s, d) => s + d.probability, 0) / total);
      rects.push({ x, y, w: Math.max(rw, 0), h: remainingH, item });
      x += rw;
    } else {
      const rh = remainingH * ratio / (data.slice(data.indexOf(item)).reduce((s, d) => s + d.probability, 0) / total);
      rects.push({ x, y, w: remainingW, h: Math.max(rh, 0), item });
      y += rh;
    }
    if (rects.length === 1) {
      if (horizontal) { remainingW -= rects[0].w; x = rects[0].x + rects[0].w; } else { remainingH -= rects[0].h; y = rects[0].y + rects[0].h; }
    }
    horizontal = !horizontal;
  }
  return rects;
}

/* -- Drought / Probability math ------------------------------------------- */

/** Cumulative probability of getting >=1 drop in N attempts.
 *  Without pity: P(N) = 1 - (1 - rate)^N
 *  With pity threshold T: P(N) = 1 for N >= T, else adjusted via inclusion. */
export function cumulativeProbCurve(
  dropRate: number,
  maxKills: number,
  pityThreshold: number | null,
): { kill: number; probNoPity: number; probWithPity: number }[] {
  const points: { kill: number; probNoPity: number; probWithPity: number }[] = [];
  for (let n = 1; n <= maxKills; n++) {
    const probNoPity = 1 - Math.pow(1 - dropRate, n);
    const probWithPity = pityThreshold && n >= pityThreshold
      ? 1.0
      : pityThreshold
        ? 1 - Math.pow(1 - dropRate, n) * ((pityThreshold - Math.min(n, pityThreshold)) / pityThreshold)
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

  const expectedDrops = killCount * binding.dropChance;
  for (let i = 0; i < binding.rarityWeights.length; i++) {
    counts[i] = Math.round(expectedDrops * (binding.rarityWeights[i] / totalWeight));
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
