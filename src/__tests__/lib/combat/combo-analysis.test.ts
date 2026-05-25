import { describe, it, expect } from 'vitest';
import {
  parseSeconds,
  comboMetrics,
  lintCombo,
  asCombo,
  type ComboLike,
} from '@/lib/combat/combo-analysis';

function combo(over: Partial<ComboLike> = {}): ComboLike {
  return {
    id: 'cb-sw-basic', name: 'Slash Combo', weaponCategory: 'Sword',
    hits: 3, totalTime: '1.5s', dps: 245, chain: ['Slash', 'Cross Cut', 'Thrust'], ...over,
  };
}

describe('parseSeconds', () => {
  it('parses a "1.5s" style string', () => {
    expect(parseSeconds('1.5s')).toBe(1.5);
    expect(parseSeconds('2s')).toBe(2);
  });
  it('returns 0 for an unparseable string', () => {
    expect(parseSeconds('')).toBe(0);
    expect(parseSeconds('Infinite')).toBe(0);
  });
});

describe('comboMetrics', () => {
  it('derives total damage, cadence, and damage per hit', () => {
    const m = comboMetrics(combo());
    expect(m.timeSec).toBe(1.5);
    expect(m.totalDamage).toBeCloseTo(367.5, 1); // 245 * 1.5
    expect(m.hitsPerSecond).toBeCloseTo(2, 3); // 3 / 1.5
    expect(m.damagePerHit).toBeCloseTo(122.5, 1); // 367.5 / 3
  });
  it('avoids divide-by-zero on a zero-time combo', () => {
    const m = comboMetrics(combo({ totalTime: 'Infinite' }));
    expect(m.hitsPerSecond).toBe(0);
    expect(m.damagePerHit).toBe(0);
  });
});

describe('lintCombo', () => {
  it('passes a well-formed combo with clustered peers', () => {
    const peers = [combo(), combo({ id: 'b', dps: 280 }), combo({ id: 'c', dps: 310 })];
    const findings = lintCombo(combo(), peers);
    expect(findings.every((f) => f.severity === 'ok')).toBe(true);
  });

  it('warns when the chain length disagrees with the hit count', () => {
    const findings = lintCombo(combo({ chain: ['Slash', 'Thrust'], hits: 3 }), []);
    expect(findings.some((f) => f.severity === 'warn' && /chain/i.test(f.message))).toBe(true);
  });

  it('flags a DPS outlier versus same-weapon peers', () => {
    const peers = [combo({ id: 'a' }), combo({ id: 'b', dps: 280 }), combo({ id: 'c', dps: 310 })];
    const findings = lintCombo(combo({ id: 'op', dps: 1200 }), peers);
    expect(findings.some((f) => f.severity === 'warn' && /dps/i.test(f.message))).toBe(true);
  });

  it('only compares against peers of the same weapon category', () => {
    const peers = [combo({ id: 'bow1', weaponCategory: 'Bow', dps: 1200 })];
    // no same-weapon peers → no outlier finding, just structural ok
    const findings = lintCombo(combo({ id: 'sw1', dps: 245 }), peers);
    expect(findings.some((f) => /dps/i.test(f.message))).toBe(false);
  });
});

describe('asCombo', () => {
  it('parses a combo-shaped object', () => {
    expect(asCombo(combo())).not.toBeNull();
  });
  it('returns null for non-combo data', () => {
    expect(asCombo({ id: 'x' })).toBeNull();
    expect(asCombo(null)).toBeNull();
  });
});
