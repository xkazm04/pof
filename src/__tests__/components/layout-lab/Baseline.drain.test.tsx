import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Partial mock: the artifact READ/WRITE paths are stubbed, but `drainGates` stays REAL so the
// coach drain goes through the actual client against a mocked `fetch`.
vi.mock('@/components/layout-lab/labArtifactClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout-lab/labArtifactClient')>();
  return {
    ...actual,
    fetchArtifacts: vi.fn().mockResolvedValue([]),
    fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    postArtifact: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
  };
});

// Spy on the cache invalidation a drain must still perform, keeping the real behaviour.
const invalidateSpy = vi.fn();
vi.mock('@/components/layout-lab/labArtifactCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout-lab/labArtifactCache')>();
  return {
    ...actual,
    invalidateArtifacts: (...a: Parameters<typeof actual.invalidateArtifacts>) => { invalidateSpy(...a); actual.invalidateArtifacts(...a); },
  };
});

vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

// Synthetic pipeline: one passing step and one live-UE gate that stays deferred until drained.
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'Concept', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'p', status: 'pass', tier: 'L0', detail: '' }) },
        { archetype: 'gate', label: 'Test Gate', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'd', status: 'deferred', tier: 'L3', detail: 'live-UE runner not yet run: T' }) },
      ],
    }),
  };
});

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', verified: 0, total: 2 }] }];
const detail = {
  catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 },
  entities: [
    { id: 'e1', name: 'Entity One', lifecycle: 'planned' as const, data: {} },
    { id: 'e2', name: 'Entity Two', lifecycle: 'planned' as const, data: {} },
  ],
  steps: ['Concept', 'Test Gate'],
};

const REFUSAL = 'drain already in flight for items/item-3 — refusing to overlap (UE editor is non-reentrant)';
let drainResponse: () => Response;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Harness() {
  const [entityId, setEntityId] = useState('e1');
  return <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId={entityId} onSelectEntity={setEntityId} />;
}

beforeEach(() => {
  _resetArtifactCache();
  invalidateSpy.mockReset();
  useLabRunnerStore.setState({ localDrain: null });
  useLabPipelineStore.setState({ byEntity: { e1: {
    Concept: { done: true, data: {}, ueAssets: [], at: '2026-09-28T00:00:00Z' },
    'Test Gate': { done: true, data: {}, ueAssets: [], at: '2026-09-28T00:00:00Z' },
  } } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).startsWith('/api/pipeline-artifacts/drain')) return drainResponse();
    return json(500, { success: false, error: 'not stubbed' });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useLabPipelineStore.setState({ byEntity: {} });
  _resetArtifactCache();
});

describe('Baseline — the coach drain DISPLAYS its outcome', () => {
  it('a 409 refusal renders the server reason with Retry, clears draining, and hides on another entity', async () => {
    drainResponse = () => json(409, { success: false, error: REFUSAL });
    render(<Harness />);

    fireEvent.click(await screen.findByTestId('next-step-drain'));

    const result = await screen.findByTestId('entity-drain-result');
    expect(result.textContent).toContain('drain already in flight for items/item-3');
    expect(screen.getByTestId('entity-drain-retry')).toBeTruthy();
    // draining === false: the CTA is back to its idle label and enabled.
    await waitFor(() => expect((screen.getByTestId('next-step-drain') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('next-step-drain').textContent).not.toMatch(/Running/);

    // Select another entity: the outcome belongs to e1 and must not render on e2.
    fireEvent.click(screen.getByTestId('entity-lifecycle-e2'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Entity Two'));
    expect(screen.queryByTestId('entity-drain-result')).toBeNull();
  });

  it('[guard] a 200 drain still invalidates this entity\'s cache once and releases the header lease', async () => {
    drainResponse = () => json(200, { success: true, data: { ran: 1, passed: 1, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [] } });
    render(<Harness />);

    fireEvent.click(await screen.findByTestId('next-step-drain'));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('fixtures', 'e1'));
    expect(invalidateSpy.mock.calls.filter((c) => c[0] === 'fixtures' && c[1] === 'e1')).toHaveLength(1);
    await waitFor(() => expect(useLabRunnerStore.getState().localDrain).toBeNull());
  });
});
