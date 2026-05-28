import { describe, it, expect } from 'vitest';
import { rowToRun } from '@/lib/economy/economy-run-db';

describe('rowToRun', () => {
  it('maps a full row, parses config + metrics JSON, reads baseline flag', () => {
    const run = rowToRun({
      id: 'r1',
      name: 'baseline-v1',
      config: '{"agentCount":100,"maxLevel":25,"maxPlayHours":80,"philosophy":"balanced","seed":42}',
      metrics: '{"avgGold":1234,"gini":0.31,"netFlowPerHour":12,"criticalAlerts":0,"warningAlerts":2,"inflowPerHour":100,"outflowPerHour":88,"medianGold":1100,"durationMs":15}',
      is_baseline: 1,
      captured_at: '2026-05-27T12:00:00.000Z',
    });
    expect(run.id).toBe('r1');
    expect(run.name).toBe('baseline-v1');
    expect(run.config.agentCount).toBe(100);
    expect(run.config.philosophy).toBe('balanced');
    expect(run.metrics.avgGold).toBe(1234);
    expect(run.metrics.gini).toBeCloseTo(0.31);
    expect(run.isBaseline).toBe(true);
    expect(run.capturedAt).toBe('2026-05-27T12:00:00.000Z');
  });

  it('defaults empty config/metrics + omits null captured_at + non-baseline', () => {
    const run = rowToRun({
      id: 'r2', name: 'empty', config: '{}', metrics: '{}',
      is_baseline: 0, captured_at: null,
    });
    expect(run.metrics.avgGold ?? 0).toBe(0);
    expect(run.isBaseline).toBe(false);
    expect(run.capturedAt).toBeUndefined();
  });
});
