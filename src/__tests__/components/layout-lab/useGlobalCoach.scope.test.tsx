/**
 * The coach's first-paint fan-out is scoped to the ACTIVE game's catalogs: a catalog the game
 * does not show is neither fetched nor allowed to hold the Do-next row on its loading state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Result } from '@/types/result';
import type { StepSummary } from '@/components/layout-lab/stepSummary';

const fetchArtifactsResult = vi.fn();
const fetchStepSummaryResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
  fetchStepSummaryResult: (...a: unknown[]) => fetchStepSummaryResult(...a),
}));
vi.mock('@/components/layout-lab/hooks/useStepJudgeVerdicts', () => ({
  useAllJudgeVerdicts: () => [],
  useCatalogJudgeVerdicts: () => [],
  useStepJudgeVerdicts: () => [],
  invalidateJudgeVerdicts: () => {},
  JUDGE_VERDICT_CACHE_TTL_MS: 60_000,
}));
vi.mock('@/components/layout-lab/catalogManifest', () => ({
  resolveCatalogSteps: () => ['A'],
  catalogManifest: () => ({ bespoke: false }),
}));

import { useGlobalCoach, _resetGlobalCoachCache } from '@/components/layout-lab/hooks/useGlobalCoach';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { scopeCatalogIds } from '@/lib/games/scope';
import { useActiveGameStore } from '@/stores/activeGameStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const ALL = CATALOG_SECTIONS.map((s) => s.catalogId);
const ok = (rows: StepSummary[]): Result<StepSummary[], string> => ({ ok: true, data: rows });

beforeEach(() => {
  _resetArtifactCache();
  _resetGlobalCoachCache();
  fetchArtifactsResult.mockReset();
  fetchStepSummaryResult.mockReset();
  useLabPipelineStore.setState({ byEntity: {} });
  useCatalogStore.setState({ entitiesByCatalog: {} } as never);
});
afterEach(() => {
  cleanup();
  useActiveGameStore.setState({ gameId: 'pof' } as never);
});

describe('useGlobalCoach under a scoped game', () => {
  it('fetches only the visible catalogs, and loading settles without the out-of-scope ones', async () => {
    useActiveGameStore.setState({ gameId: 'gtai', showAllPipelines: false } as never);
    const visible = new Set(scopeCatalogIds('gtai', ALL, false).visible);
    expect(visible.size).toBeLessThan(ALL.length); // the scenario only exists if gtai hides some
    // An out-of-scope catalog never answers: it must not be able to hold `loading`.
    fetchStepSummaryResult.mockImplementation((c: string) => (visible.has(c) ? Promise.resolve(ok([])) : new Promise(() => {})));

    const { result } = renderHook(() => useGlobalCoach());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const asked = new Set(fetchStepSummaryResult.mock.calls.map((c) => c[0] as string));
    expect(asked.size).toBe(visible.size);
    for (const c of asked) expect(visible.has(c)).toBe(true);
  });

  it('PoF (everything visible) still reads every catalog', async () => {
    useActiveGameStore.setState({ gameId: 'pof' } as never);
    fetchStepSummaryResult.mockImplementation(() => Promise.resolve(ok([])));
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(new Set(fetchStepSummaryResult.mock.calls.map((c) => c[0] as string)).size).toBe(scopeCatalogIds('pof', ALL, false).visible.length);
  });
});
