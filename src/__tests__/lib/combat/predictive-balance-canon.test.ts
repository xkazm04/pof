import { describe, it, expect } from 'vitest';
import { readCanonThresholds } from '@/lib/balance/canon-conformance';
import {
  collectCanonFacets,
  lintCombatCanon,
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  RESIST_FACET_MISSING_REASON,
  type HeatmapCell,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';

const T = readCanonThresholds();

const cell = (o: Partial<HeatmapCell> = {}): HeatmapCell => ({
  playerLevel: 10,
  enemyLabel: '1x Test Dummy',
  survivalRate: 0.5,
  avgTTK: 10,
  avgDPS: 20,
  avgEHP: 1000,
  biggestHit: 100,
  ...o,
});

describe('checkResistCap wiring — arpg-resists', () => {
  it('flags a resist above the canon cap, naming the law, the value and the threshold', () => {
    const { alerts, checks } = lintCombatCanon(
      { resists: [{ type: 'Fire', value: 0.85 }], defense: null },
      T,
    );
    const check = checks.find((c) => c.lawId === 'arpg-resists')!;
    expect(check.status).toBe('violation');
    expect(check.observed).toBeCloseTo(0.85, 5);

    const alert = alerts.find((a) => a.lawId === 'arpg-resists')!;
    expect(alert.type).toBe('canon-violation');
    // names the law, the observed value AND the canon threshold — never a bare "violation"
    expect(alert.message).toContain('Resist cap');
    expect(alert.message).toContain('85.0%');
    expect(alert.message).toContain(`${(T.resistCap * 100).toFixed(1)}%`);
  });

  it('passes a conforming resist profile with no alert', () => {
    const { alerts, checks } = lintCombatCanon(
      { resists: [{ type: 'Fire', value: 0.7 }, { type: 'Cold', value: 0.5 }], defense: null },
      T,
    );
    expect(checks.find((c) => c.lawId === 'arpg-resists')!.status).toBe('pass');
    expect(alerts.filter((a) => a.lawId === 'arpg-resists')).toHaveLength(0);
  });

  it('reports that it could not run when the sim carries no resists — never a silent pass', () => {
    const check = lintCombatCanon({ resists: null, defense: null }, T)
      .checks.find((c) => c.lawId === 'arpg-resists')!;
    expect(check.status).toBe('not-evaluated');
    expect(check.reason).toBe(RESIST_FACET_MISSING_REASON);
    expect(check.reason).toMatch(/no per-type resists/);
  });
});

describe('checkOneShot wiring — arpg-defenses', () => {
  it('flags a hit at/above the canon EHP fraction, naming law, value and threshold', () => {
    const { alerts, checks } = lintCombatCanon(
      {
        resists: null,
        defense: { ehp: 100, biggestHit: 60, label: 'Lv.4 vs 1x Stone Brute' },
        oneShotBreachCells: 3,
        evaluatedCells: 8,
      },
      T,
    );
    const check = checks.find((c) => c.lawId === 'arpg-defenses')!;
    expect(check.status).toBe('violation');
    expect(check.observed).toBeCloseTo(0.6, 5);
    expect(check.observedAt).toBe('Lv.4 vs 1x Stone Brute');

    const alert = alerts.find((a) => a.lawId === 'arpg-defenses')!;
    expect(alert.type).toBe('canon-violation');
    expect(alert.message).toContain('one-shot');
    expect(alert.message).toContain('60.0%');
    expect(alert.message).toContain(`${(T.oneShotEhpFraction * 100).toFixed(1)}%`);
    // breadth is reported rather than muted
    expect(alert.message).toContain('3/8 sweep cells');
  });

  it('passes a hit safely below the one-shot fraction', () => {
    const { alerts, checks } = lintCombatCanon(
      { resists: null, defense: { ehp: 1000, biggestHit: 100, label: 'Lv.10 vs 1x Dummy' } },
      T,
    );
    expect(checks.find((c) => c.lawId === 'arpg-defenses')!.status).toBe('pass');
    expect(alerts.filter((a) => a.lawId === 'arpg-defenses')).toHaveLength(0);
  });

  it('reports that it could not run when no cell was evaluable', () => {
    const check = lintCombatCanon({ resists: null, defense: null }, T)
      .checks.find((c) => c.lawId === 'arpg-defenses')!;
    expect(check.status).toBe('not-evaluated');
    expect(check.reason).toMatch(/no heatmap cell/);
  });
});

describe('collectCanonFacets', () => {
  it('picks the WORST cell (highest hit/EHP) and counts the breaching cells', () => {
    const facets = collectCanonFacets(
      [
        cell({ playerLevel: 5, avgEHP: 1000, biggestHit: 50 }),   // 0.05 — fine
        cell({ playerLevel: 8, avgEHP: 200, biggestHit: 180, enemyLabel: '1x Brute' }), // 0.9 — worst
        cell({ playerLevel: 9, avgEHP: 100, biggestHit: 40 }),    // 0.4 — breaches
      ],
      T,
    );
    expect(facets.defense).toEqual({ ehp: 200, biggestHit: 180, label: 'Lv.8 vs 1x Brute' });
    expect(facets.evaluatedCells).toBe(3);
    expect(facets.oneShotBreachCells).toBe(2);
  });

  it('yields no defense facet when no cell has a usable EHP/hit pair', () => {
    expect(collectCanonFacets([cell({ avgEHP: 0, biggestHit: 0 })], T).defense).toBeNull();
  });
});

describe('runPredictiveBalance — canon policing is live on sim output', () => {
  const cfg: PredictiveBalanceConfig = {
    ...DEFAULT_PREDICTIVE_CONFIG,
    levelRange: [1, 5],
    levelStep: 4,
    iterations: 5,
    enemyConfigs: [{ archetypeId: 'melee-grunt', count: 1, levelOffset: 0 }],
    sensitivityAttributes: [],
  };

  it('reports every combat-facing law, including the one that could not run', () => {
    const report = runPredictiveBalance(cfg);
    const ids = report.canonChecks.map((c) => c.lawId).sort();
    expect(ids).toEqual(['arpg-defenses', 'arpg-resists']);

    const resist = report.canonChecks.find((c) => c.lawId === 'arpg-resists')!;
    expect(resist.status).toBe('not-evaluated');
    expect(resist.reason).toBeTruthy();

    const oneShot = report.canonChecks.find((c) => c.lawId === 'arpg-defenses')!;
    expect(oneShot.status).not.toBe('not-evaluated');
    expect(oneShot.observed).toBeGreaterThan(0);
  });

  it('records a biggestHit observation per heatmap cell', () => {
    const report = runPredictiveBalance(cfg);
    expect(report.heatmap.length).toBeGreaterThan(0);
    for (const c of report.heatmap) expect(c.biggestHit).toBeGreaterThan(0);
  });

  it('surfaces a canon breach through the alert channel, tagged with its law id', () => {
    // Enemy damage cranked to the tuning ceiling → the biggest hit dwarfs EHP.
    const report = runPredictiveBalance({
      ...cfg,
      tuning: { ...cfg.tuning, enemyDamageMul: 2, playerHealthMul: 0.5 },
    });
    const oneShot = report.canonChecks.find((c) => c.lawId === 'arpg-defenses')!;
    expect(oneShot.status).toBe('violation');
    const alert = report.alerts.find((a) => a.lawId === 'arpg-defenses')!;
    expect(alert.type).toBe('canon-violation');
    expect(alert.message).toContain('Canon (');
  });

  it('polices a resist profile the caller supplies (config-driven, not simulated)', () => {
    const report = runPredictiveBalance({
      ...cfg,
      defenderResists: [{ type: 'Lightning', value: 0.9 }],
    });
    const resist = report.canonChecks.find((c) => c.lawId === 'arpg-resists')!;
    expect(resist.status).toBe('violation');
    expect(report.alerts.some((a) => a.lawId === 'arpg-resists')).toBe(true);
  });
});

