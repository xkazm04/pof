/**
 * The Matrix's catalog-wide refresh, driven through the real board.
 *
 * The board is the surface whose staleness bites: another session commits, a headless drain
 * resolves a gate, the MCP submit path writes rows — and add-only hydration means a LOCAL
 * copy of an older server row keeps winning, so the cell stays green until a hard reload.
 * This drives the button and asserts the cell moves, while a step that exists only in this
 * browser survives and is named in the report.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const OLD = '2026-08-17T09:00:00.000Z';
const NEW = '2026-08-17T12:00:00.000Z';

// A MUTABLE server: the fixture rewrites `state.arts` between fetches, exactly as another
// session would. Declared through vi.hoisted because vi.mock is hoisted above consts.
const state = vi.hoisted(() => ({
  arts: [] as Record<string, unknown>[],
}));

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn(() => Promise.resolve(state.arts)),
  fetchArtifactsResult: vi.fn(() => Promise.resolve({ ok: true, data: state.arts })),
  fetchStepSummaryResult: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  drainCatalogGates: vi.fn(),
}));

vi.mock('@/components/layout-lab/useLabCatalogData', () => ({
  useLabDetail: (id: string) => (id === 'fixtures' ? {
    catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 },
    entities: [
      { id: 'e1', name: 'Entity One', lifecycle: 'planned', data: {} },
      { id: 'e2', name: 'Entity Two', lifecycle: 'planned', data: {} },
    ],
    steps: ['StepA', 'StepB'],
  } : null),
}));

// Steps grade from their own data, so a server-side CONTENT change actually moves a cell.
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = (label: string) => (data: Record<string, unknown>) => ({
    label, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  });
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'StepA', view, produce, accept: accept('StepA') },
        { archetype: 'brief', label: 'StepB', view, produce, accept: accept('StepB') },
      ],
    }),
  };
});

import { CatalogMatrix } from '@/components/layout-lab/CatalogMatrix';
import { LIGHT } from '@/components/layout-lab/theme';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { useLabPipelineStore, SERVER_MISSING_REASON } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 }] }];

const row = (entityId: string, step: string, status: string, updatedAt: string) => ({
  catalogId: 'fixtures', entityId, step, data: { __status: status }, ueAssets: [],
  status, tier: 'L0', updatedAt,
});

const renderMatrix = () => render(
  <CatalogMatrix t={LIGHT} groups={groups} catalogId="fixtures" onSelectCatalog={vi.fn()} onOpenStep={vi.fn()} />,
);

const statusOf = (c: HTMLElement, cell: string) => c.querySelector(`[data-cell="${cell}"]`)?.getAttribute('data-status');

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  _resetArtifactCache();
  state.arts = [row('e1', 'StepA', 'pass', OLD), row('e2', 'StepA', 'pass', OLD)];
  // e2 holds a LOCAL copy of the server's older row (what add-only hydration leaves behind)
  // plus a step that never reached the server.
  useLabPipelineStore.setState({
    byEntity: {
      e2: {
        StepA: { done: true, data: { __status: 'pass' }, ueAssets: [], at: OLD, serverSeen: OLD, status: 'pass', tier: 'L0' },
        StepB: { done: true, data: { __status: 'pass' }, ueAssets: [], at: NEW },
      },
    },
  });
});

describe('CatalogMatrix — catalog-wide refresh from server', () => {
  it('makes another session\'s change to a NON-open entity visible, and keeps local-only work', async () => {
    const { container, getByTestId, queryByTestId } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e2::StepA')).toBe('pass'));
    expect(queryByTestId('catalog-refresh-outcome')).toBeNull(); // nothing reported before an ask

    // Another session rewrites e2/StepA and the checker now grades it `fail`.
    state.arts = [row('e1', 'StepA', 'pass', OLD), row('e2', 'StepA', 'fail', NEW)];

    fireEvent.click(getByTestId('refresh-catalog-from-server'));

    // The cell moves — without the store reconcile the stale LOCAL artifact would keep winning.
    await waitFor(() => expect(statusOf(container, 'e2::StepA')).toBe('fail'));

    // The local-only step survived and is flagged, not destroyed.
    const e2 = useLabPipelineStore.getState().byEntity.e2;
    expect(e2.StepB.data).toEqual({ __status: 'pass' });
    expect(e2.StepB.syncError).toBe(SERVER_MISSING_REASON);

    // …and the outcome NAMES it rather than keeping it silently.
    const report = getByTestId('catalog-refresh-outcome');
    expect(report.textContent).toContain('1 entity changed');
    expect(getByTestId('catalog-refresh-detail').textContent).toContain('kept StepB (local only)');
  });

  it('reports a failed refresh and changes nothing', async () => {
    const { container, getByTestId, findByText } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e2::StepA')).toBe('pass'));

    const client = await import('@/components/layout-lab/labArtifactClient');
    vi.mocked(client.fetchArtifactsResult).mockResolvedValueOnce({ ok: false, error: 'HTTP 500' });

    fireEvent.click(getByTestId('refresh-catalog-from-server'));

    await findByText(/Refresh failed — nothing was changed: HTTP 500/);
    expect(useLabPipelineStore.getState().byEntity.e2.StepA.data).toEqual({ __status: 'pass' });
  });
});
