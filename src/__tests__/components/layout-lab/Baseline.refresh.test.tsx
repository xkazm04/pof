import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const fetchArtifactsResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
  postArtifact: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
}));

// Placeholder canvas — no bespoke step UI in this test.
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore, SERVER_MISSING_REASON } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1, verified: 0 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Concept Brief', 'Economy'],
};

const row = (step: string, data: Record<string, unknown>, updatedAt: string) =>
  ({ catalogId: 'items', entityId: 'item-1', step, data, ueAssets: [], status: 'pass' as const, tier: 'L0' as const, updatedAt });

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

const localSteps = () => useLabPipelineStore.getState().byEntity['item-1'] ?? {};

beforeEach(() => {
  _resetArtifactCache();
  useLabPipelineStore.setState({ byEntity: {} });
  fetchArtifactsResult.mockReset();
});
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); _resetArtifactCache(); });

describe('Baseline — refresh from server', () => {
  it('offers the refresh unconditionally (not buried behind a drift banner)', async () => {
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [] });
    renderBaseline();
    expect(screen.getByTestId('refresh-from-server')).toBeTruthy();
    expect(screen.queryByTestId('drift-banner')).toBeNull();
  });

  it('reconciles a step the server has DELETED, and reports it', async () => {
    // First load: the server holds both steps, so both are hydrated (and stamped).
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [
      row('Concept Brief', { brief: 'a' }, '2026-07-10T00:00:00Z'),
      row('Economy', { price: 10 }, '2026-07-10T00:00:00Z'),
    ] });
    renderBaseline();
    await waitFor(() => expect(Object.keys(localSteps())).toHaveLength(2));

    // Another session deleted Economy server-side. Add-only hydration would keep it green.
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [row('Concept Brief', { brief: 'a' }, '2026-07-10T00:00:00Z')] });
    fireEvent.click(screen.getByTestId('refresh-from-server'));

    await waitFor(() => expect(Object.keys(localSteps())).toEqual(['Concept Brief']));
    expect(screen.getByTestId('refresh-outcome').textContent).toMatch(/Removed \(the server no longer has\): Economy/);
  });

  it('adopts changed server CONTENT (which add-only hydration never could)', async () => {
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [row('Economy', { price: 10 }, '2026-07-10T00:00:00Z')] });
    renderBaseline();
    await waitFor(() => expect(localSteps().Economy?.data).toEqual({ price: 10 }));

    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [row('Economy', { price: 250 }, '2026-07-20T00:00:00Z')] });
    fireEvent.click(screen.getByTestId('refresh-from-server'));

    await waitFor(() => expect(localSteps().Economy.data).toEqual({ price: 250 }));
    expect(screen.getByTestId('refresh-outcome').textContent).toMatch(/1 adopted/);
  });

  it('never destroys unsynced local produce output — it keeps it and flags it', async () => {
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [] });
    renderBaseline();
    await waitFor(() => expect(screen.getByTestId('refresh-from-server')).toBeTruthy());
    useLabPipelineStore.setState({ byEntity: { 'item-1': {
      Economy: { done: true, data: { price: 999 }, ueAssets: [], at: '2026-07-25T00:00:00Z' },
    } } });

    fireEvent.click(screen.getByTestId('refresh-from-server'));

    await waitFor(() => expect(screen.getByTestId('refresh-outcome').textContent).toMatch(/1 kept/));
    expect(localSteps().Economy.data).toEqual({ price: 999 });
    expect(localSteps().Economy.syncError).toBe(SERVER_MISSING_REASON);
  });

  it('reports a failed refresh and changes nothing', async () => {
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [row('Economy', { price: 10 }, '2026-07-10T00:00:00Z')] });
    renderBaseline();
    await waitFor(() => expect(localSteps().Economy?.data).toEqual({ price: 10 }));

    fetchArtifactsResult.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    fireEvent.click(screen.getByTestId('refresh-from-server'));

    await waitFor(() => expect(screen.getByText(/Refresh failed — nothing was changed: HTTP 500/)).toBeTruthy());
    expect(localSteps().Economy.data).toEqual({ price: 10 });
  });

  it('surfaces CONTENT divergence for a step whose verdict is unchanged', async () => {
    // A produced step the server holds with the SAME `pass`, but different data — no
    // status comparison can see this, so the drift banner must be content-aware. Both
    // payloads satisfy the real Items Economy checker, so the verdicts genuinely agree.
    const tuned = { power: 102, target: 100, cost: 143 };
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [row('Economy', { ...tuned, rarity: 'Rare' }, '2026-07-20T00:00:00Z')] });
    useLabPipelineStore.setState({ byEntity: { 'item-1': {
      Economy: { done: true, data: tuned, ueAssets: [], at: '2026-07-25T00:00:00Z', status: 'pass', tier: 'L0' },
    } } });
    renderBaseline();

    // Select the Economy step so its canvas (and drift banner) renders.
    await waitFor(() => expect(screen.getAllByText('Economy').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Economy')[0]);

    await waitFor(() => expect(screen.getByTestId('drift-banner')).toBeTruthy());
    expect(screen.getByTestId('drift-banner').textContent).toMatch(/Server CONTENT differs/);
  });
});
