/**
 * The catalog row's `verified/total` counter must count ONE entity set on both sides.
 *
 * The tree LISTS `useLabDetail(c).entities` (seeds + persisted/ingested/draft rows of the active
 * game), but `LabCatalog.total` counted PoF's seed map only, and the numerator skipped `draft-`
 * ids while counting every other persisted row (`d1-*` ingests). So a bestiary with 3 seeds and
 * 40 ingested monsters read `n/3` above 43 rows, and `n` could exceed its own denominator.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabCatalogData, useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActiveGameStore } from '@/stores/activeGameStore';
import type { DerivedLifecycleMap } from '@/components/layout-lab/useDerivedLifecycle';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

afterEach(() => {
  cleanup();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

const ingested = (id: string): StoredCatalogEntity => ({
  id, catalogId: 'bestiary', name: id, categoryPath: [], tags: [], lifecycle: 'planned',
  provenance: {
    kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'DevilutionX', sourceFile: 'monstdat.tsv',
    sourceRow: id, licenceNote: 'Reference-only.', ingestedAt: '2026-09-22T00:00:00Z', canonProfile: 'diablo1',
  },
} as StoredCatalogEntity);

describe('catalog total counts the entities the tree lists', () => {
  it('useLabCatalogData total === useLabDetail entity count once persisted rows are hydrated (pof)', () => {
    act(() => { useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false }); });
    act(() => {
      useCatalogStore.getState().hydratePersisted([
        { catalogId: 'bestiary', entityId: 'd1-MT_A', source: 'ingest', entity: ingested('d1-MT_A') },
        { catalogId: 'bestiary', entityId: 'd1-MT_B', source: 'ingest', entity: ingested('d1-MT_B') },
      ]);
    });
    const groups = renderHook(() => useLabCatalogData()).result.current;
    const detail = renderHook(() => useLabDetail('bestiary')).result.current!;
    const total = groups.flatMap((g) => g.catalogs).find((c) => c.catalogId === 'bestiary')!.total;
    expect(detail.entities.some((e) => e.id === 'd1-MT_A')).toBe(true);
    expect(total).toBe(detail.entities.length);
  });
});

describe('verified counter numerator and denominator cover the same rows', () => {
  it('a verified draft counts toward the numerator it is already in the denominator of', () => {
    const groups = [{ category: 'Core', catalogs: [{ catalogId: 'bestiary', label: 'Bestiary', description: '', total: 3 }] }];
    const entities = [
      { id: 'bestiary-brute', name: 'Brute', lifecycle: 'planned' as const, data: {} },
      { id: 'd1-MT_A', name: 'Zombie', lifecycle: 'planned' as const, data: {} },
      { id: 'draft-bestiary-1', name: 'Mine', lifecycle: 'planned' as const, data: {} },
    ];
    const derived: DerivedLifecycleMap = new Map(entities.map((e) => [e.id, { lifecycle: 'verified' as const, summary: 'proven', gatePasses: 1 }]));
    render(
      <CatalogTree t={LIGHT} groups={groups} selectedCatalogId="bestiary" entities={entities}
        selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} derivedLifecycle={derived} />,
    );
    expect(screen.getByTestId('catalog-verified-bestiary').textContent).toBe('3/3');
  });
});
