import { describe, it, expect } from 'vitest';
import {
  readCanonThresholds,
  checkFaucetSinkBalance,
  checkResistCap,
  checkOneShot,
  checkXpCurveShape,
  checkPricePower,
  lintCanonConformance,
} from '@/lib/balance/canon-conformance';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { generateXPCurve } from '@/lib/economy/definitions';
import type { EconomyMetrics, SimulationConfig, XPCurvePoint } from '@/types/economy-simulator';

const T = readCanonThresholds();

function metric(over: Partial<EconomyMetrics> = {}): EconomyMetrics {
  return {
    level: 10, hour: 20, avgGold: 500, medianGold: 400, minGold: 0, maxGold: 2000,
    totalGold: 50000, giniCoefficient: 0.3, inflowPerHour: 100, outflowPerHour: 100,
    netFlowPerHour: 0, velocity: 0.1, ...over,
  };
}

/** A truly geometric XP curve (xp-to-next = base × 1.08^level) — canon-compliant shape. */
function geometricCurve(maxLevel: number, base = 100, r = 1.08): XPCurvePoint[] {
  const points: XPCurvePoint[] = [];
  let cum = 0;
  for (let level = 1; level <= maxLevel; level++) {
    const xp = level === 1 ? 0 : Math.round(base * r ** level);
    cum += xp;
    points.push({ level, xpRequired: xp, cumulativeXP: cum });
  }
  return points;
}

describe('readCanonThresholds — thresholds are READ from the canon seed', () => {
  it('parses every threshold from canon prose (not hardcoded)', () => {
    expect(T.faucetSinkTolerance).toBeCloseTo(0.15, 6);
    expect(T.resistCap).toBeCloseTo(0.75, 6);
    expect(T.oneShotEhpFraction).toBeCloseTo(0.33, 6);
    expect(T.xpGeometricBase).toBeCloseTo(1.08, 6);
    expect(T.pricePowerBounds).toEqual([0.8, 1.2]);
  });
});

describe('Law 1 — faucet/sink balance ±15% (proj-economy)', () => {
  it('flags an imbalanced economy (inflow 150 vs sink 100 → 33%)', () => {
    const v = checkFaucetSinkBalance([metric({ inflowPerHour: 150, outflowPerHour: 100 })], T);
    expect(v).toHaveLength(1);
    expect(v[0].lawId).toBe('proj-economy');
    expect(v[0].actual).toBeCloseTo(1 / 3, 2);
  });
  it('passes a balanced economy (inflow ≈ sink)', () => {
    expect(checkFaucetSinkBalance([metric({ inflowPerHour: 105, outflowPerHour: 100 })], T)).toHaveLength(0);
  });
});

describe('Law 2 — resist cap 75% (arpg-resists)', () => {
  it('flags a resist above the cap', () => {
    const v = checkResistCap([{ type: 'Fire', value: 0.9 }], T);
    expect(v).toHaveLength(1);
    expect(v[0].lawId).toBe('arpg-resists');
    expect(v[0].actual).toBe(0.9);
  });
  it('passes a resist at/below the cap', () => {
    expect(checkResistCap([{ type: 'Cold', value: 0.7 }, { type: 'Fire', value: 0.75 }], T)).toHaveLength(0);
  });
});

describe('Law 3 — no one-shot ≥33% EHP (arpg-defenses)', () => {
  it('flags a hit at/above 33% of EHP', () => {
    const v = checkOneShot({ ehp: 1000, biggestHit: 400 }, T);
    expect(v).toHaveLength(1);
    expect(v[0].lawId).toBe('arpg-defenses');
  });
  it('passes a hit below 33% of EHP', () => {
    expect(checkOneShot({ ehp: 1000, biggestHit: 200 }, T)).toHaveLength(0);
  });
});

describe('Law 4 — XP curve is geometric (arpg-leveling)', () => {
  it('flags the shipped polynomial curve (100·level^1.8)', () => {
    const v = checkXpCurveShape(generateXPCurve(25), T);
    expect(v).toHaveLength(1);
    expect(v[0].lawId).toBe('arpg-leveling');
  });
  it('passes a true geometric curve (~1.08^level)', () => {
    expect(checkXpCurveShape(geometricCurve(25), T)).toHaveLength(0);
  });
});

describe('Law 5 — price/power ratio 0.8–1.2 (proj-balance)', () => {
  it('flags an item priced far above its power', () => {
    const v = checkPricePower([{ name: 'Overpriced Blade', price: 200, power: 100 }], T);
    expect(v).toHaveLength(1);
    expect(v[0].lawId).toBe('proj-balance');
    expect(v[0].actual).toBeCloseTo(2, 6);
  });
  it('passes an item inside the envelope', () => {
    expect(checkPricePower([{ name: 'Fair Blade', price: 100, power: 100 }], T)).toHaveLength(0);
  });
});

describe('lintCanonConformance — dispatches over present facets', () => {
  it('runs only the checks whose data is provided', () => {
    const v = lintCanonConformance({
      resists: [{ type: 'Fire', value: 0.9 }],
      defense: { ehp: 1000, biggestHit: 500 },
    });
    expect(v.map((x) => x.lawId).sort()).toEqual(['arpg-defenses', 'arpg-resists']);
  });
});

describe('integration — the shipped loot-driven default is flagged faucet-imbalanced', () => {
  it('runSimulation(loot-driven) emits a proj-economy canon violation', () => {
    const config: SimulationConfig = {
      agentCount: 30, maxLevel: 15, maxPlayHours: 20, philosophy: 'loot-driven', seed: 42,
    };
    const result = runSimulation(config);
    const canon = result.alerts.filter((a) => a.type === 'canon-violation');
    expect(canon.some((a) => a.lawId === 'proj-economy')).toBe(true);
  });
});
