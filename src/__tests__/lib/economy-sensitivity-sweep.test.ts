import { describe, it, expect } from 'vitest';
import { runSensitivitySweep } from '@/lib/economy/sensitivity-sweep';
import { DEFAULT_FAUCETS } from '@/lib/economy/definitions';
import type { SimulationConfig } from '@/types/economy-simulator';

const tinyConfig: SimulationConfig = {
  agentCount: 5, maxLevel: 4, maxPlayHours: 6, philosophy: 'balanced', seed: 7,
};
const params = DEFAULT_FAUCETS.filter((f) => ['enemy-kill-gold', 'quest-reward', 'boss-kill-gold'].includes(f.id));

describe('runSensitivitySweep', () => {
  it('returns one entry per param, sorted by delta desc', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    expect(res.entries).toHaveLength(params.length);
    for (let i = 1; i < res.entries.length; i++) {
      expect(res.entries[i - 1].delta).toBeGreaterThanOrEqual(res.entries[i].delta);
    }
  });

  it('brackets the base value and reports delta as |high - low|', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    for (const e of res.entries) {
      expect(e.lowValue).toBeLessThan(e.baseValue);
      expect(e.highValue).toBeGreaterThan(e.baseValue);
      expect(e.delta).toBeCloseTo(Math.abs(e.high - e.low));
    }
  });

  it('is deterministic for the same seed', () => {
    const a = runSensitivitySweep(tinyConfig, { output: 'gini', range: 0.5, params });
    const b = runSensitivitySweep(tinyConfig, { output: 'gini', range: 0.5, params });
    expect(a).toEqual(b);
  });

  it('a stronger gold faucet yields a higher net flow at the high end', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    const ek = res.entries.find((e) => e.paramId === 'enemy-kill-gold')!;
    expect(ek.high).toBeGreaterThanOrEqual(ek.low);
    expect(ek.kind).toBe('faucet');
  });

  it('carries the chosen output and a numeric baseline', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'criticalAlerts', range: 0.3, params });
    expect(res.output).toBe('criticalAlerts');
    expect(typeof res.baseline).toBe('number');
  });
});
