import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('@/lib/api-utils', () => ({ apiFetch: apiFetchMock }));

import { EconomyRunsStrip } from '@/components/modules/evaluator/EconomyRunsStrip';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { SimulationResult } from '@/types/economy-simulator';

const RESULT = { config: {}, metrics: [], alerts: [], supplyDemand: [] } as unknown as SimulationResult;

beforeEach(() => {
  apiFetchMock.mockReset();
  useEconomySimulatorStore.setState({ result: RESULT, error: null, runsError: null, savedRuns: [], baselineRun: null });
});

describe('EconomyRunsStrip failures', () => {
  it('reports a failed save inside the Saved Runs card, not the simulation error', async () => {
    // list-runs on mount succeeds; save-run rejects.
    apiFetchMock.mockImplementation(async (_url: string, init?: { body?: string }) => {
      if (init?.body && JSON.parse(init.body).action === 'save-run') throw new Error('disk full');
      return { runs: [], baseline: null };
    });
    const { getByLabelText, getByText, getByRole, container } = render(<EconomyRunsStrip />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.change(getByLabelText(/Name for the current run/), { target: { value: 'r1' } });
    await act(async () => { fireEvent.click(getByText('Save')); });

    const alert = getByRole('alert');
    expect(alert.textContent).toContain('disk full');
    expect(container.contains(alert)).toBe(true);
    expect(useEconomySimulatorStore.getState().error).toBeNull();

    // The next runs action clears it.
    apiFetchMock.mockImplementation(async () => ({ runs: [], baseline: null }));
    await act(async () => { await useEconomySimulatorStore.getState().listRuns(); });
    expect(useEconomySimulatorStore.getState().runsError).toBeNull();
  });
});
