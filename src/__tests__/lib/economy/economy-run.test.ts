import { describe, it, expect } from 'vitest';
import {
  economyDrift,
  extractRunMetrics,
  metricsToStatRows,
  type EconomyRun,
  type EconomyRunMetrics,
} from '@/lib/economy/economy-run';
import type { SimulationResult } from '@/types/economy-simulator';

function makeMetrics(overrides: Partial<EconomyRunMetrics> = {}): EconomyRunMetrics {
  return {
    avgGold: 1000,
    medianGold: 900,
    gini: 0.3,
    netFlowPerHour: 10,
    inflowPerHour: 100,
    outflowPerHour: 90,
    criticalAlerts: 0,
    warningAlerts: 1,
    durationMs: 5,
    ...overrides,
  };
}

function makeBaselineRun(metrics: EconomyRunMetrics, name = 'baseline'): EconomyRun {
  return {
    id: 'b1',
    name,
    config: {
      agentCount: 100, maxLevel: 25, maxPlayHours: 80, philosophy: 'balanced', seed: 42,
    },
    metrics,
    isBaseline: true,
  };
}

describe('extractRunMetrics', () => {
  it('pulls last-tick metrics + counts critical/warning alerts', () => {
    const result = {
      config: { agentCount: 1, maxLevel: 1, maxPlayHours: 1, philosophy: 'balanced', seed: 1 },
      metrics: [
        { level: 1, hour: 1, avgGold: 100, medianGold: 90, minGold: 0, maxGold: 200, totalGold: 100, giniCoefficient: 0.2, inflowPerHour: 50, outflowPerHour: 40, netFlowPerHour: 10, velocity: 0.1 },
        { level: 1, hour: 2, avgGold: 200, medianGold: 180, minGold: 0, maxGold: 400, totalGold: 200, giniCoefficient: 0.35, inflowPerHour: 60, outflowPerHour: 50, netFlowPerHour: 10, velocity: 0.1 },
      ],
      alerts: [
        { level: 1, hour: 1, severity: 'critical', type: 'inflation', message: '', metric: '', value: 0, threshold: 0 },
        { level: 1, hour: 1, severity: 'warning', type: 'inflation', message: '', metric: '', value: 0, threshold: 0 },
        { level: 1, hour: 1, severity: 'warning', type: 'inflation', message: '', metric: '', value: 0, threshold: 0 },
        { level: 1, hour: 1, severity: 'info', type: 'inflation', message: '', metric: '', value: 0, threshold: 0 },
      ],
      supplyDemand: [],
      finalSnapshots: [],
      durationMs: 17,
      completedAt: '',
    } as unknown as SimulationResult;

    const m = extractRunMetrics(result);
    expect(m.avgGold).toBe(200);
    expect(m.medianGold).toBe(180);
    expect(m.gini).toBeCloseTo(0.35);
    expect(m.criticalAlerts).toBe(1);
    expect(m.warningAlerts).toBe(2);
    expect(m.durationMs).toBe(17);
  });

  it('handles a result with no metrics rows (returns zeros, no NaN)', () => {
    const empty = {
      config: {}, metrics: [], alerts: [], supplyDemand: [],
      finalSnapshots: [], durationMs: 0, completedAt: '',
    } as unknown as SimulationResult;
    const m = extractRunMetrics(empty);
    expect(m.avgGold).toBe(0);
    expect(m.gini).toBe(0);
    expect(m.criticalAlerts).toBe(0);
  });
});

describe('metricsToStatRows', () => {
  it('scales gini ×100 so the shared drift tolerance can detect movement', () => {
    const rows = metricsToStatRows(makeMetrics({ gini: 0.5 }));
    const gini = rows.find((r) => r.label === 'Gini')!;
    expect(gini.value).toBe(50);
  });
});

describe('economyDrift', () => {
  it('flags an increase in avgGold and netFlow as drift', () => {
    const baseline = makeBaselineRun(makeMetrics({ avgGold: 1000, netFlowPerHour: 10 }));
    const current = makeMetrics({ avgGold: 1500, netFlowPerHour: 25 });
    const d = economyDrift(current, baseline);
    expect(d.baselineId).toBe('b1');
    expect(d.baselineName).toBe('baseline');
    const ag = d.stats.find((s) => s.label === 'Avg Gold')!;
    expect(ag.delta).toBe(500);
    const nf = d.stats.find((s) => s.label === 'Net Flow/hr')!;
    expect(nf.delta).toBe(15);
  });

  it('detects a gini drift after scaling (0.30 → 0.41 = +11 units)', () => {
    const baseline = makeBaselineRun(makeMetrics({ gini: 0.30 }));
    const d = economyDrift(makeMetrics({ gini: 0.41 }), baseline);
    const g = d.stats.find((s) => s.label === 'Gini');
    expect(g).toBeDefined();
    expect(g!.delta).toBeCloseTo(11, 5);
  });

  it('returns no drift entries when current matches baseline within tolerance', () => {
    const baseline = makeBaselineRun(makeMetrics());
    const d = economyDrift(makeMetrics(), baseline);
    expect(d.stats).toEqual([]);
  });

  it('flags new criticalAlerts vs a clean baseline', () => {
    const baseline = makeBaselineRun(makeMetrics({ criticalAlerts: 0 }));
    const d = economyDrift(makeMetrics({ criticalAlerts: 3 }), baseline);
    const c = d.stats.find((s) => s.label === 'Critical Alerts')!;
    expect(c.delta).toBe(3);
    expect(c.baseline).toBe(0);
  });
});
