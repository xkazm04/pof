import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => 1440,
  useViewportAtLeast: () => true,
  WIDE_FALLBACK_WIDTH: 1440,
}));

import { sampleSeries } from '@/components/modules/evaluator/EconomySimulatorView/helpers';
import { GoldFlowChart } from '@/components/modules/evaluator/EconomySimulatorView/GoldFlowChart';
import { WealthDistributionChart } from '@/components/modules/evaluator/EconomySimulatorView/WealthDistributionChart';
import type { EconomyMetrics, PlayerSnapshot } from '@/types/economy-simulator';

afterEach(cleanup);

const metricsFor = (n: number): EconomyMetrics[] =>
  Array.from({ length: n }, (_, hour) => ({
    hour, level: 1 + Math.floor(hour / 4), avgGold: hour * 10, medianGold: hour * 8,
    giniCoefficient: 0.3 + hour / 1000, inflowPerHour: 100 + hour, outflowPerHour: 80,
    netFlowPerHour: 20 + hour, totalGoldInEconomy: hour * 1000,
  }) as unknown as EconomyMetrics);

describe('sampleSeries', () => {
  it('always keeps the final point, for every series length the config range produces', () => {
    for (let n = 1; n <= 200; n++) {
      const series = Array.from({ length: n }, (_, i) => i);
      const s = sampleSeries(series, 20);
      expect(s[s.length - 1]).toBe(n - 1);
      expect(s[0]).toBe(0);
      expect(s.length).toBeLessThanOrEqual(Math.min(n, 41));
    }
  });

  it('returns short series unchanged', () => {
    expect(sampleSeries([1, 2, 3], 20)).toEqual([1, 2, 3]);
  });
});

describe('charts end on the final simulated hour', () => {
  it('GoldFlowChart draws the last hour (100 metrics -> hour 99)', () => {
    const { container } = render(<GoldFlowChart metrics={metricsFor(100)} />);
    const bars = container.querySelectorAll('[role="img"]');
    expect(bars[bars.length - 1].getAttribute('aria-label')).toMatch(/^Hour 99,/);
  });

  it('WealthDistributionChart Gini bars end on the last hour', () => {
    const snaps = [{ gold: 10 }, { gold: 50 }] as unknown as PlayerSnapshot[];
    const { container } = render(<WealthDistributionChart metrics={metricsFor(100)} snapshots={snaps} />);
    const gini = container.querySelectorAll('[aria-label="Gini coefficient per sampled hour"] [role="img"]');
    expect(gini[gini.length - 1].getAttribute('aria-label')).toMatch(/^Hour 99:/);
  });
});
