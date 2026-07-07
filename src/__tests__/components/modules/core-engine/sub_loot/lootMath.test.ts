import { describe, it, expect } from 'vitest';
import {
  cumulativeProbCurve,
  simulateKills,
  computeTreemapLayout,
} from '@/components/modules/core-engine/sub_loot/_shared/math';
import type { EnemyLootBinding, TreemapRect } from '@/components/modules/core-engine/sub_loot/_shared/data';

describe('cumulativeProbCurve — pity (hard pity timer)', () => {
  const rate = 0.1;
  const T = 50;
  const pts = cumulativeProbCurve(rate, 80, T);

  it('never reports a lower drop probability with pity than without', () => {
    for (const p of pts) expect(p.probWithPity).toBeGreaterThanOrEqual(p.probNoPity - 1e-9);
  });

  it('does not over-state drops before the threshold (pity only guarantees AT the threshold)', () => {
    // A pity *timer* gives no extra probability until the threshold is reached;
    // below T the with-pity curve must equal the plain geometric curve.
    for (const p of pts) {
      if (p.kill < T) expect(p.probWithPity).toBeCloseTo(p.probNoPity, 10);
    }
  });

  it('guarantees a drop at and after the threshold', () => {
    for (const p of pts) {
      if (p.kill >= T) expect(p.probWithPity).toBe(1);
    }
  });

  it('with no pity threshold, the two curves are identical', () => {
    const noPity = cumulativeProbCurve(rate, 10, null);
    for (const p of noPity) expect(p.probWithPity).toBe(p.probNoPity);
  });
});

describe('simulateKills — drop count conservation', () => {
  const binding = {
    archetypeId: 'x',
    archetypeName: 'X',
    color: '#fff',
    rarityWeights: [1, 1, 1],
    dropChance: 1,
    bonusGold: 0,
  } as EnemyLootBinding;

  it('total simulated drops equals round(expected drops), not the sum of independent roundings', () => {
    // expected = 10 * 1 = 10, evenly split 3 ways → 3.333 each. Independent
    // rounding gives [3,3,3] = 9 (a drop vanishes); apportionment must total 10.
    const drops = simulateKills(binding, 10);
    const total = drops.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(10);
  });

  it('keeps the largest-remainder ordering (extra unit goes to the largest fractional share)', () => {
    const skewed = { ...binding, rarityWeights: [0, 5, 25, 40, 30], dropChance: 0.5 } as EnemyLootBinding;
    const drops = simulateKills(skewed, 10); // expected = 5
    expect(drops.reduce((s, d) => s + d.count, 0)).toBe(5);
  });

  it('returns all zeros when total weight is zero (no divide-by-zero)', () => {
    const zero = { ...binding, rarityWeights: [0, 0, 0] } as EnemyLootBinding;
    const drops = simulateKills(zero, 10);
    expect(drops.every((d) => d.count === 0)).toBe(true);
  });
});

describe('computeTreemapLayout — area conservation', () => {
  const data: TreemapRect[] = [
    { name: 'A', probability: 40, color: '#1', affixes: [] },
    { name: 'B', probability: 40, color: '#2', affixes: [] }, // duplicate probability of A
    { name: 'C', probability: 20, color: '#3', affixes: [] },
  ];
  const W = 100;
  const H = 80;
  const rects = computeTreemapLayout(data, W, H);

  it('produces one rect per datum', () => {
    expect(rects).toHaveLength(3);
  });

  it('total rect area equals the box area (no overlap/overflow)', () => {
    const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(W * H, 4);
  });

  it('each rect area is proportional to its probability', () => {
    const totalProb = data.reduce((s, d) => s + d.probability, 0);
    for (const r of rects) {
      expect(r.w * r.h).toBeCloseTo((W * H * r.item.probability) / totalProb, 4);
    }
  });

  it('keeps every rect inside the box', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 1e-6);
    }
  });
});
