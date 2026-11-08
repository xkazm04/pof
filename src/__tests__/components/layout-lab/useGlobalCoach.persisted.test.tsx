/**
 * The global coach must coach the entities the tree LISTS (`labEntitiesOf`: code seeds +
 * persisted rows), not the code seeds alone. A non-default game has no code seeds by
 * construction, so a seeds-only coach left GTAI's "Do next" bar permanently empty, and every
 * hydrated `/diablo` ingest was listed in the tree but never coached.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import type { StepSummary } from '@/components/layout-lab/stepSummary';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const fetchStepSummaryResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  fetchStepSummaryResult: (...a: unknown[]) => fetchStepSummaryResult(...a),
}));
vi.mock('@/components/layout-lab/hooks/useStepJudgeVerdicts', () => ({
  useAllJudgeVerdicts: () => [],
  useCatalogJudgeVerdicts: () => [],
  useStepJudgeVerdicts: () => [],
  invalidateJudgeVerdicts: () => {},
  JUDGE_VERDICT_CACHE_TTL_MS: 60_000,
}));
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));
vi.mock('@/components/layout-lab/catalogManifest', () => ({
  resolveCatalogSteps: () => ['A', 'B'],
  catalogManifest: () => ({ bespoke: false }),
}));

import { useGlobalCoach, _resetGlobalCoachCache } from '@/components/layout-lab/hooks/useGlobalCoach';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActiveGameStore } from '@/stores/activeGameStore';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const summary = (entityId: string, step: string, status: string): StepSummary => ({
  entityId, step, status: status as StepSummary['status'], tier: 'L0',
  updatedAt: '2026-11-01T10:00:00.000Z', contentHash: 'v2-1-0', driftHash: 'v2-1-0|[]',
});

const gtaiQuest: StoredCatalogEntity = {
  id: 'gtai-first-hit', catalogId: 'quests', name: 'Zorblax First Hit', categoryPath: [], tags: [], lifecycle: 'planned',
  provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T00:00:00Z' },
} as StoredCatalogEntity;

beforeEach(() => {
  _resetArtifactCache();
  _resetGlobalCoachCache();
  fetchStepSummaryResult.mockReset();
  fetchStepSummaryResult.mockImplementation((catalogId: string) => Promise.resolve({
    ok: true, data: catalogId === 'quests' ? [summary(gtaiQuest.id, 'A', 'pass'), summary(gtaiQuest.id, 'B', 'fail')] : [],
  }));
  useLabPipelineStore.setState({ byEntity: {} });
  useCatalogStore.setState({ entitiesByCatalog: {}, draftEntitiesByCatalog: {} } as never);
  act(() => { useCatalogStore.getState().hydratePersisted([{ catalogId: 'quests', entityId: gtaiQuest.id, source: 'intake', entity: gtaiQuest }]); });
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} } as never);
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
});

describe('useGlobalCoach — coaches the entities the tree lists', () => {
  it('a persisted entity of the active game is a coach candidate', async () => {
    act(() => { useActiveGameStore.setState({ gameId: 'gtai', showAllPipelines: false }); });
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0]).toMatchObject({ catalogId: 'quests', entityId: 'gtai-first-hit', step: 'B', priority: 'fail' });
  });

  it('stays game-scoped: the gtai entity is not coached under pof', async () => {
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.candidates.filter((c) => c.entityId === 'gtai-first-hit')).toHaveLength(0);
  });
});
