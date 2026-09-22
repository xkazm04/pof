/**
 * B6 + B3 (/diablo backlog). The lab never read `catalog_entities` back, so a persisted entity
 * — another session's one-shot, an ingested reference entity — resolved for every server gate
 * and was absent from the tree. And an ingested entity, once visible, must not pass for one a
 * designer wrote.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import { useCatalogStore } from '@/stores/catalogStore';
import { mergePersistedDrafts, type PersistedRow } from '@/lib/catalog/persistedHydration';
import type { EntityProvenance, StoredCatalogEntity } from '@/lib/catalog/types';

afterEach(() => {
  cleanup();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

const provenance: EntityProvenance = {
  kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'DevilutionX', sourceFile: 'monsters/monstdat.tsv',
  sourceRow: '_monster_id=MT_NZOMBIE', licenceNote: 'Reference-only.', ingestedAt: '2026-09-22T00:00:00Z',
};
const entity = (id: string, extra: Partial<StoredCatalogEntity> = {}): StoredCatalogEntity =>
  ({ id, catalogId: 'bestiary', name: id, categoryPath: [], tags: [], lifecycle: 'planned', ...extra });
const row = (id: string, extra: Partial<StoredCatalogEntity> = {}): PersistedRow =>
  ({ catalogId: 'bestiary', entityId: id, source: 'ingest', entity: entity(id, extra) });

describe('mergePersistedDrafts', () => {
  it('adds server rows the cache does not have', () => {
    const r = mergePersistedDrafts({}, {}, [row('d1-MT_NZOMBIE')]);
    expect(Object.keys(r.drafts.bestiary)).toEqual(['d1-MT_NZOMBIE']);
    expect(r.added).toBe(1);
  });

  it('never lets a persisted row shadow a code seed, and reports it', () => {
    const r = mergePersistedDrafts({}, { bestiary: { 'bestiary-brute': {} } }, [row('bestiary-brute')]);
    expect(r.drafts.bestiary).toBeUndefined();
    expect(r.shadowed).toEqual(['bestiary/bestiary-brute']);
  });

  it('keeps a browser-only draft the server does not know, and replaces a stale cached copy', () => {
    const local = { bestiary: {
      'draft-bestiary-1': { ...entity('draft-bestiary-1'), browserOnly: true },
      'd1-MT_A': { ...entity('d1-MT_A'), name: 'stale' },
    } };
    const r = mergePersistedDrafts(local, {}, [row('d1-MT_A', { name: 'Zombie' })]);
    expect(r.drafts.bestiary['draft-bestiary-1']).toMatchObject({ browserOnly: true });
    expect(r.drafts.bestiary['d1-MT_A'].name).toBe('Zombie');
    expect(r.added).toBe(0);
  });
});

describe('CatalogTree — ingested entities', () => {
  const groups = [{ category: 'Core', catalogs: [{ catalogId: 'bestiary', label: 'Bestiary', description: '', total: 1 }] }];

  it('store hydration + tree: an ingested entity shows an INGEST tag naming its source row', () => {
    useCatalogStore.getState().hydratePersisted([row('d1-MT_NZOMBIE', { name: 'Zombie', provenance })]);
    render(
      <CatalogTree
        t={LIGHT} groups={groups} selectedCatalogId="bestiary"
        entities={[{ id: 'd1-MT_NZOMBIE', name: 'Zombie', lifecycle: 'planned', data: {} }]}
        selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}}
      />,
    );
    const tag = screen.getByTestId('entity-ingested-d1-MT_NZOMBIE');
    expect(tag.textContent).toBe('INGEST');
    expect(tag.getAttribute('title')).toContain('Diablo I (1996)');
    expect(tag.getAttribute('title')).toContain('_monster_id=MT_NZOMBIE');
  });

  it('an authored entity carries no INGEST tag', () => {
    useCatalogStore.getState().hydratePersisted([row('draft-bestiary-9')]);
    render(
      <CatalogTree
        t={LIGHT} groups={groups} selectedCatalogId="bestiary"
        entities={[{ id: 'draft-bestiary-9', name: 'Mine', lifecycle: 'planned', data: {} }]}
        selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}}
      />,
    );
    expect(screen.queryByTestId('entity-ingested-draft-bestiary-9')).toBeNull();
  });
});
