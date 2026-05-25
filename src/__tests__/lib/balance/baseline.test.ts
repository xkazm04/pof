import { describe, it, expect } from 'vitest';
import { threatDrift, computeStatDrift, driftDirection } from '@/lib/balance/baseline';

describe('threatDrift', () => {
  it('reports an increase', () => {
    const d = threatDrift(120, 100);
    expect(d.delta).toBe(20);
    expect(d.pct).toBe(20);
  });

  it('reports a decrease', () => {
    const d = threatDrift(75, 100);
    expect(d.delta).toBe(-25);
    expect(d.pct).toBe(-25);
  });

  it('handles a zero baseline (no percent, just delta)', () => {
    const d = threatDrift(50, 0);
    expect(d.delta).toBe(50);
    expect(d.pct).toBeNull();
  });
});

describe('driftDirection', () => {
  it('classifies up / down / flat with a tolerance', () => {
    expect(driftDirection(5)).toBe('up');
    expect(driftDirection(-5)).toBe('down');
    expect(driftDirection(0)).toBe('flat');
  });
});

describe('computeStatDrift', () => {
  it('matches stats by label and computes deltas', () => {
    const drift = computeStatDrift(
      [{ label: 'Health', value: 220 }, { label: 'Damage', value: 30 }],
      [{ label: 'Health', value: 200 }, { label: 'Damage', value: 25 }],
    );
    const hp = drift.find((d) => d.label === 'Health')!;
    expect(hp.current).toBe(220);
    expect(hp.baseline).toBe(200);
    expect(hp.delta).toBe(20);
  });

  it('includes stats new since baseline (baseline 0)', () => {
    const drift = computeStatDrift(
      [{ label: 'Armor', value: 10 }],
      [],
    );
    const armor = drift.find((d) => d.label === 'Armor')!;
    expect(armor.baseline).toBe(0);
    expect(armor.delta).toBe(10);
  });

  it('only includes stats that changed', () => {
    const drift = computeStatDrift(
      [{ label: 'Health', value: 200 }, { label: 'Damage', value: 30 }],
      [{ label: 'Health', value: 200 }, { label: 'Damage', value: 25 }],
    );
    expect(drift.map((d) => d.label)).toEqual(['Damage']);
  });
});
