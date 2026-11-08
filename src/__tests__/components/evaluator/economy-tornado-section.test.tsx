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

import { TornadoSection } from '@/components/modules/evaluator/EconomySimulatorView/TornadoSection';
import type { SimulationConfig } from '@/types/economy-simulator';

const CONFIG = { agentCount: 100, maxLevel: 25, maxPlayHours: 60, seed: 1, philosophy: 'balanced' } as SimulationConfig;

beforeEach(() => apiFetchMock.mockReset());

/* ── Tornado: the drawn sweep is labelled by the output it was RUN for ─── */

describe('TornadoSection', () => {
  it('keeps formatting a finished sweep by its own output after the toggle moves', async () => {
    apiFetchMock.mockResolvedValue({
      output: 'gini', range: 0.5, baseline: 0.412,
      entries: [{ paramId: 'kill-gold', label: 'Monster Gold', kind: 'faucet', baseValue: 10, lowValue: 5, highValue: 15, low: 0.38, high: 0.45 }],
    });
    const { getByText, container } = render(<TornadoSection config={CONFIG} />);
    await act(async () => { fireEvent.click(getByText('Run sweep')); });
    expect(container.textContent).toContain('baseline 0.412');

    // Moving the output toggle is an ENTERED change; the bars still answer gini.
    fireEvent.click(getByText('Net Flow /hr'));
    expect(container.textContent).toContain('baseline 0.412');
    expect(container.textContent).toContain('0.380 → 0.450');
  });

  it('keys a converter (vendor sale) as a converter, not as a faucet', async () => {
    apiFetchMock.mockResolvedValue({
      output: 'gini', range: 0.5, baseline: 0.4,
      entries: [
        { paramId: 'kill-gold', label: 'Monster Gold', kind: 'faucet', baseValue: 10, lowValue: 5, highValue: 15, low: 0.38, high: 0.45 },
        { paramId: 'loot-vendor-sell', label: 'Vendor Loot Sales', kind: 'converter', baseValue: 8, lowValue: 4, highValue: 12, low: 0.39, high: 0.41 },
      ],
    });
    const { getByText, getByTitle, container } = render(<TornadoSection config={CONFIG} />);
    await act(async () => { fireEvent.click(getByText('Run sweep')); });
    const dot = (title: string) => (getByTitle(title).querySelector('span') as HTMLElement).style.backgroundColor;
    expect(dot('Vendor Loot Sales')).not.toBe(dot('Monster Gold'));
    expect(container.textContent).toContain('Converter');
  });
});


describe('TornadoSection empty sweep', () => {
  it('labels a zero-entry sweep instead of rendering an empty body', async () => {
    apiFetchMock.mockResolvedValue({ output: 'gini', range: 0.5, baseline: 0.4, entries: [] });
    const { getByText, container } = render(<TornadoSection config={CONFIG} />);
    await act(async () => { fireEvent.click(getByText('Run sweep')); });
    expect(container.textContent).toContain('No faucet/sink parameters to sweep');
  });
});
