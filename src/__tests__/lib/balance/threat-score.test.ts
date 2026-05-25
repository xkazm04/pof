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
