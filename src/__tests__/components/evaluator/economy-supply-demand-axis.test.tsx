import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => 1440,
  useViewportAtLeast: () => true,
  WIDE_FALLBACK_WIDTH: 1440,
}));
vi.mock('@/components/ui/CodeViewer', () => ({ CodeViewer: () => null }));

import { EconomySimulatorView } from '@/components/modules/evaluator/EconomySimulatorView';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { SimulationConfig, SimulationResult } from '@/types/economy-simulator';

afterEach(cleanup);

const CFG = { agentCount: 100, maxLevel: 25, maxPlayHours: 60, seed: 7, philosophy: 'balanced' } as SimulationConfig;

describe('EconomySimulatorView supply/demand axis', () => {
  it('labels the axis with the level cap the shown run used, not an unrun edit', async () => {
    const result = { config: CFG, metrics: [], alerts: [], supplyDemand: [], finalSnapshots: [], durationMs: 5 } as unknown as SimulationResult;
    useEconomySimulatorStore.setState({
      defaultConfig: CFG, config: CFG, result,
      metrics: [], alerts: [],
      supplyDemand: [{ level: 1, category: 'weapon', supplyRate: 1, demandRate: 1, avgPrice: 10, affordabilityIndex: 0.5 }],
      fetchDefaults: async () => {}, listRuns: async () => {},
    });
    const { getByText, getByLabelText, container } = render(<EconomySimulatorView />);
    expect(container.textContent).toContain('Lvl 25');

    // Edit Max Level without re-running: the chart still shows the 25-level run.
    await act(async () => { fireEvent.click(getByText('Config')); });
    fireEvent.change(getByLabelText('Max Level'), { target: { value: '50' } });

    expect(container.textContent).toContain('Lvl 25');
    expect(container.textContent).not.toContain('Lvl 50');
  });
});
