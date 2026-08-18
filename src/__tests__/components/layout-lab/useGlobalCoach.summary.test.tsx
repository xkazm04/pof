/**
 * First paint must not download the project's produce bodies.
 *
 * `useGlobalCoach` fans out one read per registered catalog to rank a top-5 list. Against the
 * real `~/.pof/pof.db` the blob-bearing route answers that with 7.41 MB across 33 catalogs;
 * the verdict projection answers it with 134 KB. These cases pin that the coach asks for the
 * projection — and that it still prefers full artifacts a SIBLING surface has already paid
 * for, so the catalog on screen is never coached from a thinner input than the Matrix shows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepSummary } from '@/components/layout-lab/stepSummary';
import type { Result } from '@/types/result';

const fetchArtifactsResult = vi.fn();
const fetchStepSummaryResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
  fetchStepSummaryResult: (...a: unknown[]) => fetchStepSummaryResult(...a),
}));

// No judge overlay in these cases — the bridge has its own suite.
vi.mock('@/components/layout-lab/hooks/useStepJudgeVerdicts', () => ({
  useAllJudgeVerdicts: () => [],
  useCatalogJudgeVerdicts: () => [],
  useStepJudgeVerdicts: () => [],
  invalidateJudgeVerdicts: () => {},
  JUDGE_VERDICT_CACHE_TTL_MS: 60_000,
}));

// Deterministic acceptance: each step grades to its data's `__status`.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));

// One catalog with steps, so `resolveCatalogSteps` returns something derivable.
vi.mock('@/components/layout-lab/catalogManifest', () => ({
  resolveCatalogSteps: () => ['A', 'B'],
  catalogManifest: () => ({ bespoke: false }),
}));

import { useGlobalCoach } from '@/components/layout-lab/hooks/useGlobalCoach';
import { _resetGlobalCoachCache } from '@/components/layout-lab/hooks/useGlobalCoach';
import { _resetArtifactCache, ensureArtifacts } from '@/components/layout-lab/labArtifactCache';
import { useCatalogStore } from '@/stores/catalogStore';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const summary = (entityId: string, step: string, status: string): StepSummary => ({
  entityId, step, status: status as StepSummary['status'], tier: 'L0',
  updatedAt: '2026-08-17T10:00:00.000Z', contentHash: 'v2-1-0', driftHash: 'v2-1-0|[]',
});
const artifact = (entityId: string, step: string, status: string): PipelineArtifact => ({
  catalogId: 'items', entityId, step, data: { __status: status }, ueAssets: [],
  status: status as PipelineArtifact['status'], tier: 'L0', updatedAt: '2026-08-17T10:00:00.000Z',
});

const okSummary = (rows: StepSummary[]): Result<StepSummary[], string> => ({ ok: true, data: rows });

beforeEach(() => {
  _resetArtifactCache();
  _resetGlobalCoachCache();
  fetchArtifactsResult.mockReset();
  fetchStepSummaryResult.mockReset();
  useLabPipelineStore.setState({ byEntity: {} });
  // ONE catalog carries an entity; every other registered section is entity-less and
  // therefore contributes nothing (but is still READ — that is the fan-out under test).
  useCatalogStore.setState({
    entitiesByCatalog: { items: { e1: { id: 'e1', name: 'Sword', lifecycle: 'planned' } } },
  } as never);
});
afterEach(cleanup);

describe('useGlobalCoach — the first-paint read', () => {
  it('asks only for the blob-free summary; the artifact route is never called', async () => {
    fetchStepSummaryResult.mockImplementation((catalogId: string) =>
      Promise.resolve(okSummary(catalogId === 'items' ? [summary('e1', 'A', 'pass'), summary('e1', 'B', 'fail')] : [])));

    const { result } = renderHook(() => useGlobalCoach());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // The blob-bearing route is NOT touched on first paint — the whole point of the change.
    expect(fetchArtifactsResult).not.toHaveBeenCalled();
    expect(fetchStepSummaryResult).toHaveBeenCalled();
    // One read per registered catalog, deduped (never per entity).
    const asked = new Set(fetchStepSummaryResult.mock.calls.map((c) => c[0] as string));
    expect(asked.size).toBe(fetchStepSummaryResult.mock.calls.length);
    // …and the ranking still lands.
    expect(result.current.candidates[0]).toMatchObject({ catalogId: 'items', entityId: 'e1', step: 'B', priority: 'fail' });
  });

  it('reports a failed summary read as an UNKNOWN catalog, never as an empty one', async () => {
    fetchStepSummaryResult.mockImplementation((catalogId: string) =>
      Promise.resolve(catalogId === 'items'
        ? ({ ok: false, error: 'HTTP 500' } as Result<StepSummary[], string>)
        : okSummary([])));

    const { result } = renderHook(() => useGlobalCoach());

    await waitFor(() => expect(result.current.failedCatalogs).toHaveLength(1));
    expect(result.current.failedCatalogs[0]).toMatchObject({ catalogId: 'items', error: 'HTTP 500' });
    // No fabricated "nothing has run here" candidate for the catalog we could not read.
    expect(result.current.candidates).toEqual([]);
  });

  it('prefers full artifacts a sibling surface already cached (and still fetches none itself)', async () => {
    fetchStepSummaryResult.mockImplementation(() => Promise.resolve(okSummary([])));
    // The Matrix/Baseline paid for this catalog's blobs; the summary for it says nothing was
    // produced. The coach must side with the richer data it already has.
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [artifact('e1', 'A', 'pass'), artifact('e1', 'B', 'fail')] });
    await act(async () => { ensureArtifacts('items'); });

    const { result } = renderHook(() => useGlobalCoach());

    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));
    expect(result.current.candidates[0]).toMatchObject({ entityId: 'e1', step: 'B', priority: 'fail' });
    // The single artifact fetch is the one the TEST issued — the coach added none.
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(1);
  });
});
