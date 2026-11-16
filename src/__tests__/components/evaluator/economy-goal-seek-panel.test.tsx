import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('@/lib/api-utils', () => ({ apiFetch: apiFetchMock }));

const FLOWS = [
  { id: 'kill-gold', name: 'Monster Gold', type: 'faucet', baseAmount: 10 },
  { id: 'repair', name: 'Repair Cost', type: 'sink', baseAmount: 5 },
];
const STORE = { defaultFlows: FLOWS };
vi.mock('@/stores/economySimulatorStore', () => ({
  useEconomySimulatorStore: (selector: (s: typeof STORE) => unknown) => selector(STORE),
}));

import { GoalSeekPanel } from '@/components/modules/evaluator/EconomySimulatorView/GoalSeekPanel';
import type { SimulationConfig } from '@/types/economy-simulator';

const CONFIG = { agentCount: 100, maxLevel: 25, maxPlayHours: 60, seed: 1, philosophy: 'balanced' } as SimulationConfig;

beforeEach(() => apiFetchMock.mockReset());

/* ── Goal-seek: the result card describes the solve that produced it ───── */

describe('GoalSeekPanel', () => {
  it('keeps the achieved metric in the solved output and flow after the controls change', async () => {
    apiFetchMock.mockResolvedValue({
      target: 0.35, solvedValue: 22, achievedMetric: 0.351, iterations: 9, converged: true,
      reason: 'ok', flowId: 'kill-gold', output: 'gini', baseValue: 10, leverRange: [0, 60],
    });
    const { getByText, getByRole, container } = render(<GoalSeekPanel config={CONFIG} />);
    fireEvent.click(getByText('Gini'));
    await act(async () => { fireEvent.click(getByText('Auto-balance')); });
    expect(container.textContent).toContain('0.351');

    // Change both controls after the solve.
    fireEvent.click(getByText('Net Flow /hr'));
    fireEvent.change(getByRole('combobox'), { target: { value: 'repair' } });

    expect(container.textContent).toContain('Achieved Gini');
    expect(container.textContent).toContain('0.351');
    expect(container.textContent).not.toContain('/hr0');
    expect(container.textContent).toContain('Solve Monster Gold baseAmount');
  });

  it('refuses an empty target instead of solving for 0', async () => {
    const { getByText, getByLabelText, container } = render(<GoalSeekPanel config={CONFIG} />);
    fireEvent.change(getByLabelText(/Target/), { target: { value: '' } });
    await act(async () => { fireEvent.click(getByText('Auto-balance')); });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Enter a numeric target/);
  });
});

describe('GoalSeekPanel Gini range', () => {
  it.each(['1.5', '-0.2'])('refuses a Gini target of %s without calling the server', async (value) => {
    const { getByText, getByLabelText, container } = render(<GoalSeekPanel config={CONFIG} />);
    fireEvent.click(getByText('Gini'));
    fireEvent.change(getByLabelText(/Target/), { target: { value } });
    await act(async () => { fireEvent.click(getByText('Auto-balance')); });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Gini targets are 0-1');
  });
});
