/**
 * Applying an address (arrival / popstate) resolves its entity against the ACTIVE game's entity
 * set — the one the tree lists (`labEntitiesOf`). It used to resolve against every seed and
 * persisted row of every game, so under GTAI a step-only link (`?c=quests&s=<step>`) jumped to a
 * PoF code seed, which the GTAI tree does not list; the shell then reconciled the phantom entity
 * to the first GTAI quest at the PoF seed's step index.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useLabAddress } from '@/components/layout-lab/hooks/useLabRouteSync';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActiveGameStore } from '@/stores/activeGameStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { LabLocation } from '@/components/layout-lab/labLocation';

const gtaiQuest: StoredCatalogEntity = {
  id: 'gtai-first-hit', catalogId: 'quests', name: 'Zorblax First Hit', categoryPath: [], tags: [], lifecycle: 'planned',
  provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T00:00:00Z' },
} as StoredCatalogEntity;

const nav = { catalog: vi.fn(), entity: vi.fn(), step: vi.fn(), view: vi.fn(), open: vi.fn() };
const HERE: LabLocation = { catalogId: 'items', entityId: null, stepIdx: 0, view: 'catalogs' };

beforeEach(() => {
  Object.values(nav).forEach((f) => f.mockReset());
  act(() => { useCatalogStore.getState().hydratePersisted([{ catalogId: 'quests', entityId: gtaiQuest.id, source: 'intake', entity: gtaiQuest }]); });
  act(() => { useActiveGameStore.setState({ gameId: 'gtai', showAllPipelines: false }); });
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
  window.history.replaceState({}, '', '/');
});

describe('useLabAddress — an address resolves inside the active game', () => {
  it('a step-only address under gtai jumps to a gtai entity, never a pof seed', () => {
    expect(Object.keys(useCatalogStore.getState().entitiesByCatalog.quests ?? {}).length).toBeGreaterThan(0); // pof seeds exist
    const step = resolveCatalogSteps('quests')[0];
    window.history.replaceState({}, '', `/layout?c=quests&s=${encodeURIComponent(step)}`);
    renderHook(() => useLabAddress(HERE, null, nav));
    expect(nav.open).toHaveBeenCalledTimes(1);
    expect(nav.open.mock.calls[0][1]).toBe('gtai-first-hit');
  });
});
