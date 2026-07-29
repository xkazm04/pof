import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const deleteEntityArtifacts = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue(true),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: (...a: unknown[]) => deleteEntityArtifacts(...a),
}));

// Placeholder canvas — no bespoke step UI in this test.
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1, verified: 0 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Concept Brief', 'Economy'],
};

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

beforeEach(() => {
  deleteEntityArtifacts.mockReset().mockResolvedValue({ ok: true, data: 2 });
  useLabPipelineStore.setState({ byEntity: { 'item-1': { Economy: { done: true, data: { price: 10 }, ueAssets: [], at: 'now' } } } });
});
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); });

describe('Baseline — Reset means reset (local AND server)', () => {
  it('confirms first, then deletes the SERVER artifacts and clears local state', async () => {
    renderBaseline();
    fireEvent.click(screen.getByTestId('entity-reset'));

    // The confirmation states the full scope — a local-only reset would silently un-do
    // itself when add-only hydration re-adopted the surviving server rows.
    expect(screen.getByText(/persisted artifacts on the server/i)).toBeTruthy();
    expect(deleteEntityArtifacts).not.toHaveBeenCalled(); // nothing destructive before confirming

    fireEvent.click(screen.getByRole('button', { name: 'Reset everywhere' }));
    await waitFor(() => expect(deleteEntityArtifacts).toHaveBeenCalledWith('items', 'item-1'));
    await waitFor(() => expect(useLabPipelineStore.getState().byEntity['item-1']).toBeUndefined());
  });

  it('cancelling deletes nothing', () => {
    renderBaseline();
    fireEvent.click(screen.getByTestId('entity-reset'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteEntityArtifacts).not.toHaveBeenCalled();
    expect(useLabPipelineStore.getState().byEntity['item-1']).toBeDefined();
  });

  it('reports a failed server delete and KEEPS local state (no false "reset done")', async () => {
    deleteEntityArtifacts.mockResolvedValue({ ok: false, error: 'offline' });
    renderBaseline();
    fireEvent.click(screen.getByTestId('entity-reset'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset everywhere' }));

    await screen.findByText(/Reset failed — server artifacts were NOT deleted: offline/i);
    expect(useLabPipelineStore.getState().byEntity['item-1']).toBeDefined();

    // Retry succeeds → the error clears and the reset lands.
    deleteEntityArtifacts.mockResolvedValue({ ok: true, data: 2 });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(useLabPipelineStore.getState().byEntity['item-1']).toBeUndefined());
  });
});

describe('Baseline — a recorded produce failure is surfaced', () => {
  it('renders the banner with the stored reason and dismisses it', async () => {
    useLabPipelineStore.setState({
      byEntity: { 'item-1': { 'Concept Brief': { done: false, data: {}, ueAssets: [], at: 'now', error: 'no candidates' } } },
    });
    const { container } = renderBaseline();

    expect(screen.getByTestId('produce-error-reason').textContent).toBe('no candidates');
    // The rail flags it too, so the failure is visible from outside the open step.
    expect(container.querySelector('[data-step-produce-failed="true"]')).toBeTruthy();

    fireEvent.click(screen.getByTestId('produce-error-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('produce-error-banner')).toBeNull());
    // The failure marker held no content → the step goes back to honest `unproduced`.
    expect(useLabPipelineStore.getState().byEntity['item-1']?.['Concept Brief']).toBeUndefined();
  });
});
