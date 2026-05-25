import { describe, it, expect } from 'vitest';
import { solveWeightsForTargetEV } from '@/lib/loot/auto-balancer';
import { computeExpectedValue, type LootBindingLike } from '@/lib/loot/economy';

function bind(over: Partial<LootBindingLike> = {}): LootBindingLike {
  return { lootTableName: 'LT_Test', dropChance: 0.5, rarityWeights: [30, 25, 25, 15, 5], bonusGold: 40, ...over };
}

describe('solveWeightsForTargetEV', () => {
  it('leaves weights near the current ones when the target equals current EV', () => {
    const current = computeExpectedValue(bind());
    const p = solveWeightsForTargetEV(bind(), current);
    expect(p.reachable).toBe(true);
    expect(Math.abs(p.achievedEV - current)).toBeLessThanOrEqual(6);
  });

  it('shifts weight toward higher rarities to raise EV', () => {
    const current = computeExpectedValue(bind()); // ~89
    const p = solveWeightsForTargetEV(bind(), current + 30);
    expect(p.reachable).toBe(true);
    // legendary weight (last) should increase vs the current 5
    expect(p.weights[4]).toBeGreaterThan(5);
    expect(p.achievedEV).toBeGreaterThan(current);
    expect(Math.abs(p.achievedEV - (current + 30))).toBeLessThanOrEqual(10);
  });

  it('shifts weight toward lower rarities to lower EV', () => {
    const current = computeExpectedValue(bind());
    const p = solveWeightsForTargetEV(bind(), current - 30);
    expect(p.reachable).toBe(true);
    expect(p.weights[0]).toBeGreaterThan(30); // common weight grows
    expect(p.achievedEV).toBeLessThan(current);
  });

  it('flags an unreachable target and clamps to the richest distribution', () => {
    const p = solveWeightsForTargetEV(bind(), 999999);
    expect(p.reachable).toBe(false);
    expect(p.weights[4]).toBe(100); // all weight on Legendary
  });

  it('always proposes weights summing to 100', () => {
    for (const t of [10, 50, 120, 400]) {
      const p = solveWeightsForTargetEV(bind(), t);
      expect(p.weights.reduce((s, w) => s + w, 0)).toBe(100);
    }
  });

  it('cannot hit a target by reweighting when drop chance is 0', () => {
    const p = solveWeightsForTargetEV(bind({ dropChance: 0 }), 200);
    expect(p.reachable).toBe(false);
  });
});
