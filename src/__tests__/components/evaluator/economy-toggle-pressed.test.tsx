import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

afterEach(cleanup);

vi.mock('@/lib/api-utils', () => ({ apiFetch: vi.fn() }));
const STORE = { defaultFlows: [{ id: 'kill-gold', name: 'Monster Gold', type: 'faucet', baseAmount: 10 }] };
vi.mock('@/stores/economySimulatorStore', () => ({
  useEconomySimulatorStore: (selector: (s: typeof STORE) => unknown) => selector(STORE),
}));

import { ConfigPanel } from '@/components/modules/evaluator/EconomySimulatorView/ConfigPanel';
import { GoalSeekPanel } from '@/components/modules/evaluator/EconomySimulatorView/GoalSeekPanel';
import { TornadoSection } from '@/components/modules/evaluator/EconomySimulatorView/TornadoSection';
import { SupplyDemandSection } from '@/components/modules/evaluator/EconomySimulatorView/SupplyDemandSection';
import type { SimulationConfig, SupplyDemandPoint } from '@/types/economy-simulator';

const CFG = { agentCount: 100, maxLevel: 25, maxPlayHours: 60, seed: 1, philosophy: 'balanced' } as SimulationConfig;
const pressed = (el: HTMLElement) => el.closest('button')!.getAttribute('aria-pressed');

describe('economy single-choice toggles announce which option is on', () => {
  it('ConfigPanel philosophy', () => {
    const { getByText } = render(<ConfigPanel config={CFG} onChange={() => {}} onValidity={() => {}} />);
    expect(pressed(getByText('Balanced'))).toBe('true');
    expect(pressed(getByText('Loot-Driven (Diablo-like)'))).toBe('false');
  });

  it('GoalSeekPanel output', () => {
    const { getAllByText, getByText } = render(<GoalSeekPanel config={CFG} />);
    const netFlow = getAllByText('Net Flow /hr').find((e) => e.closest('button'))!;
    expect(pressed(netFlow)).toBe('true');
    fireEvent.click(getByText('Gini'));
    expect(pressed(getByText('Gini'))).toBe('true');
    expect(pressed(netFlow)).toBe('false');
  });

  it('TornadoSection output', () => {
    const { getByText } = render(<TornadoSection config={CFG} />);
    expect(pressed(getByText('Endgame Gini'))).toBe('true');
    expect(pressed(getByText('Critical Alerts'))).toBe('false');
  });

  it('SupplyDemandSection category', () => {
    const data = [{ level: 1, category: 'weapon', supplyRate: 1, demandRate: 1, avgPrice: 1, affordabilityIndex: 1 }] as SupplyDemandPoint[];
    const { getByText } = render(<SupplyDemandSection data={data} maxLevel={25} />);
    expect(pressed(getByText('weapon'))).toBe('true');
    expect(pressed(getByText('armor'))).toBe('false');
  });
});
