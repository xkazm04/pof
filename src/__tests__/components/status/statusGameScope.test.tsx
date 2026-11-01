/**
 * /status under the ACTIVE game (spark gtai-uprising-project, WP2): the whole-project read
 * covers only the game's pipelines (off-manifest ones join under "show all"), every read keeps
 * only rows whose entity is in the game, and the entity set is the game's. For pof every
 * pipeline and every non-gtai row is kept — today's board.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/games/gtai', () => ({
  GTAI_OMITTED: [],
  GTAI_GAME: {
    id: 'gtai', title: 'GTAI: Uprising', canonProfiles: ['gtai'],
    manifest: [{ catalogId: 'achievements', fit: 'reuse' }, { catalogId: 'vehicles', fit: 'planned' }],
    engine: { kind: 'undecided' }, designDir: 'games/gtai',
  },
}));
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return { ...actual, allCatalogPipelines: () => [{ catalogId: 'achievements', steps: [] }, { catalogId: 'ambient', steps: [] }] };
});
const summary = (entityId: string) => ({ entityId, step: 'Concept Brief', status: 'pass', tier: 'L0', reason: '', updatedAt: '2026-11-01', contentHash: null });
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: vi.fn(async () => ({ ok: true, data: [] })),
  fetchStepSummaryResult: vi.fn(async () => ({ ok: true, data: [summary('seed-1'), summary('gtai-hit'), summary('unknown-row')] })),
  fetchArtifacts: vi.fn(async () => []),
}));

import { useStatusArtifacts, useStatusCatalogIds, useStatusEntities } from '@/components/status/statusArtifactSource';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { useActiveGameStore } from '@/stores/activeGameStore';
import { useCatalogStore } from '@/stores/catalogStore';

const GTAI_ENTITY = {
  id: 'gtai-hit', catalogId: 'achievements', name: 'Hit', categoryPath: [], tags: [], lifecycle: 'planned',
  provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T00:00:00Z' },
};

beforeEach(() => {
  _resetArtifactCache();
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
  act(() => { useCatalogStore.getState().addDraft('achievements', GTAI_ENTITY as never); });
});
afterEach(() => {
  cleanup();
  act(() => { useCatalogStore.getState().removeDraft('achievements', 'gtai-hit'); });
});

const entityIds = (rows: { entityId: string }[]) => rows.map((r) => r.entityId).sort();

describe('/status — active game scope', () => {
  it('pof: every pipeline; a gtai entity\'s rows leave, every other row stays (today\'s board)', async () => {
    const { result } = renderHook(() => useStatusArtifacts());
    await waitFor(() => expect(result.current.catalogs).not.toBeNull());
    expect(result.current.catalogs!.map((c) => c.catalogId)).toEqual(['achievements', 'ambient']);
    expect(entityIds(result.current.catalogs![0].rows)).toEqual(['seed-1', 'unknown-row']);
  });

  it('gtai: only manifest pipelines, only gtai rows; show-all brings back off-manifest lanes', async () => {
    act(() => { useActiveGameStore.setState({ gameId: 'gtai' }); });
    const { result } = renderHook(() => useStatusArtifacts());
    await waitFor(() => expect(result.current.catalogs).not.toBeNull());
    expect(result.current.catalogs!.map((c) => c.catalogId)).toEqual(['achievements']);
    expect(entityIds(result.current.catalogs![0].rows)).toEqual(['gtai-hit']);
    act(() => { useActiveGameStore.setState({ showAllPipelines: true }); });
    await waitFor(() => expect(result.current.catalogs?.map((c) => c.catalogId)).toEqual(['achievements', 'ambient']));
  });

  it('catalog ids and the entity set follow the game (pof = the seed map itself)', () => {
    const ids = renderHook(() => useStatusCatalogIds());
    const ents = renderHook(() => useStatusEntities());
    expect(ids.result.current).toEqual(['achievements', 'ambient']);
    expect(ents.result.current).toBe(useCatalogStore.getState().entitiesByCatalog);
    act(() => { useActiveGameStore.setState({ gameId: 'gtai' }); });
    ids.rerender();
    ents.rerender();
    expect(ids.result.current).toEqual(['achievements']);
    expect(Object.keys(ents.result.current)).toEqual(['achievements']);
    expect(Object.keys(ents.result.current.achievements)).toEqual(['gtai-hit']);
  });
});
