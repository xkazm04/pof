import { describe, it, expect } from 'vitest';
import { computeThreatScore, threatContributions, threatPercentile } from '@/lib/balance/threat-score';

describe('computeThreatScore', () => {
  it('weights damage above health', () => {
    const dmgHeavy = computeThreatScore([{ label: 'Damage', value: 100 }]);
    const hpHeavy = computeThreatScore([{ label: 'Health', value: 100 }]);
    expect(dmgHeavy).toBeGreaterThan(hpHeavy);
  });

  it('sums weighted contributions across stats', () => {
    const score = computeThreatScore([
      { label: 'Health', value: 100 },
      { label: 'Damage', value: 50 },
    ]);
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for no stats', () => {
    expect(computeThreatScore([])).toBe(0);
  });

  it('applies a default weight to unknown stat labels', () => {
    const score = computeThreatScore([{ label: 'Mystery', value: 10 }]);
    expect(score).toBeGreaterThan(0);
  });
});

describe('threatContributions', () => {
  it('returns per-stat contributions sorted descending', () => {
    const contribs = threatContributions([
      { label: 'Health', value: 100 },
      { label: 'Damage', value: 100 },
    ]);
    expect(contribs[0].label).toBe('Damage'); // damage weighted higher
    expect(contribs[0].contribution).toBeGreaterThan(contribs[1].contribution);
  });
});

describe('threatPercentile', () => {
  it('returns 100 for the highest score in the roster', () => {
    expect(threatPercentile(90, [10, 50, 90])).toBe(100);
  });

  it('returns 0 for the lowest', () => {
    expect(threatPercentile(10, [10, 50, 90])).toBe(0);
  });

  it('returns a mid value for the middle', () => {
    const p = threatPercentile(50, [10, 50, 90]);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(100);
  });

  it('returns 100 when roster has a single entry (itself)', () => {
    expect(threatPercentile(42, [42])).toBe(100);
  });
});

/**
 * The assertions above are all weight-INDEPENDENT: "damage outranks health",
 * "a score is positive", "empty is zero". Every one of them passes for any
 * weight vector where damage outranks health, so none of them pins a shipped
 * weight value. The weights are unestimated (see threat-score.ts PROVENANCE)
 * and the within-tier ordering they decide is what encounter budgeting and the
 * bestiary peer-band checks read — so it is pinned here on purpose.
 *
 * These are characterization tests, not correctness tests. They do not claim
 * the ordering is right. They claim that changing it is a decision, and make a
 * silent retune fail loudly. If a session with the game measures a different
 * order, change the weights AND this expectation together, in one commit.
 */
describe('threat ordering the unestimated weights decide', () => {
  const sameTier = [
    { id: 'tank', stats: [
      { label: 'Damage', value: 50 }, { label: 'Health', value: 360 },
      { label: 'Armor', value: 95 }, { label: 'Speed', value: 20 }, { label: 'Crit', value: 8 } ] },
    { id: 'glasscannon', stats: [
      { label: 'Damage', value: 200 }, { label: 'Health', value: 90 },
      { label: 'Armor', value: 20 }, { label: 'Speed', value: 52 }, { label: 'Crit', value: 44 } ] },
    { id: 'skirmisher', stats: [
      { label: 'Damage', value: 110 }, { label: 'Health', value: 160 },
      { label: 'Armor', value: 35 }, { label: 'Speed', value: 88 }, { label: 'Crit', value: 30 } ] },
    { id: 'bruiser', stats: [
      { label: 'Damage', value: 120 }, { label: 'Health', value: 260 },
      { label: 'Armor', value: 55 }, { label: 'Speed', value: 36 }, { label: 'Crit', value: 18 } ] },
  ];

  const ordered = () =>
    sameTier
      .map((a) => ({ id: a.id, score: computeThreatScore(a.stats) }))
      .sort((x, y) => y.score - x.score)
      .map((a) => a.id);

  it('ranks same-tier archetypes in the order the shipped weights produce', () => {
    expect(ordered()).toEqual(['tank', 'bruiser', 'glasscannon', 'skirmisher']);
  });

  it('separates the pair that a defensible reweighting swaps', () => {
    // glasscannon over skirmisher is the one comparison that inverts when
    // defense is weighted level with offense. It is the ordering most at risk
    // from a weight edit, so it gets its own named assertion.
    const order = ordered();
    expect(order.indexOf('glasscannon')).toBeLessThan(order.indexOf('skirmisher'));
  });
});
