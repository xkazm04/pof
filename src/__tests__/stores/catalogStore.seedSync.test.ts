/**
 * catalogStore persist ↔ seedSync (scan-sweep --challenge challenge-2026-09-30b,
 * catalog-seed-data/A). Round-trips through the REAL `pof-catalog` localStorage blob:
 * partialize stops mirroring pristine seeds, rehydrate classifies what was persisted, and
 * adopt/keep resolve the findings. The persist version STAYS 0 — zustand 5 discards a
 * version-mismatched blob that has no `migrate`, so a bump would make a revert silently drop
 * the user's local rows and browser-only drafts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore, type DraftCatalogEntity } from '@/stores/catalogStore';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { seedContentHash, seedKey } from '@/lib/catalog/seedSync';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const KEY = 'pof-catalog';
const seeded = seedAllCatalogs();
const ITEM = Object.keys(seeded.items)[0];

function blob(): { version: number; state: Record<string, unknown> } {
  return JSON.parse(localStorage.getItem(KEY) ?? 'null');
}
function countEntities(byCatalog: Record<string, Record<string, unknown>> | undefined): number {
  return Object.values(byCatalog ?? {}).reduce((n, c) => n + Object.keys(c).length, 0);
}

beforeEach(() => {
  localStorage.clear();
  useCatalogStore.setState({ entitiesByCatalog: seedAllCatalogs(), draftEntitiesByCatalog: {}, seedHashes: {}, seedDrift: [] });
});

describe('catalogStore persist — seed provenance', () => {
  it('[guard] a legacy v0 blob keeps its renamed row, re-seeds the rest, and reports it as unrecorded', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 0,
      state: { entitiesByCatalog: { items: { [ITEM]: { ...seeded.items[ITEM], name: 'Renamed locally' } } } },
    }));
    await useCatalogStore.persist.rehydrate();
    const s = useCatalogStore.getState();

    expect(s.entitiesByCatalog.items[ITEM].name).toBe('Renamed locally');
    expect(Object.keys(s.entitiesByCatalog.items).sort()).toEqual(Object.keys(seeded.items).sort());
    expect(s.seedDrift).toEqual([expect.objectContaining({ catalogId: 'items', entityId: ITEM, verdict: 'unrecorded' })]);
  });

  it('partialize of a pristine store persists 0 entities; an overlaid entity persists with its seed hash', () => {
    useCatalogStore.setState({ entitiesByCatalog: seedAllCatalogs() });
    expect(countEntities(blob().state.entitiesByCatalog as never)).toBe(0);

    useCatalogStore.getState().loadLifecycle([
      { catalogId: 'items', entityId: ITEM, lifecycle: 'verified', ueAssets: ['/Game/Items/X'] } as never,
    ]);
    const state = blob().state as { entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>>; seedHashes: Record<string, string> };
    expect(countEntities(state.entitiesByCatalog)).toBe(1);
    expect(state.entitiesByCatalog.items[ITEM].lifecycle).toBe('verified');
    expect(state.seedHashes[seedKey('items', ITEM)]).toBe(seedContentHash(seeded.items[ITEM]));
  });

  it('keeps a user-<slug> row and a browser-only draft byte-equal through partialize -> localStorage -> rehydrate, at version 0', async () => {
    const local: CatalogEntityBase = {
      id: 'user-rusty-dagger-mg3k2', catalogId: 'items', name: 'Rusty Dagger', categoryPath: ['Weapon'], tags: ['user'], lifecycle: 'planned',
    };
    const draft = {
      id: 'draft-ogre-1', catalogId: 'bestiary', name: 'Ogre', categoryPath: [], tags: [], lifecycle: 'planned',
      browserOnly: true, persistError: 'POST /api/catalog-entities 500',
    } as DraftCatalogEntity;
    useCatalogStore.getState().addEntity('items', local);
    useCatalogStore.getState().addDraft('bestiary', draft);

    // What partialize wrote: the two browser-only records, no pristine seed, version 0.
    const written = localStorage.getItem(KEY) as string;
    const w = JSON.parse(written) as { version: number; state: { entitiesByCatalog: Record<string, Record<string, unknown>> } };
    expect(w.version).toBe(0);
    expect(countEntities(w.state.entitiesByCatalog)).toBe(1);

    // A fresh tab: pristine state (which itself re-persists), then the written blob comes back.
    useCatalogStore.setState({ entitiesByCatalog: seedAllCatalogs(), draftEntitiesByCatalog: {} });
    localStorage.setItem(KEY, written);
    await useCatalogStore.persist.rehydrate();
    const s = useCatalogStore.getState();

    expect(JSON.stringify(s.entitiesByCatalog.items[local.id])).toBe(JSON.stringify(local));
    expect(JSON.stringify(s.draftEntitiesByCatalog.bestiary[draft.id])).toBe(JSON.stringify(draft));
    expect(s.seedDrift).toEqual([]);
    expect(blob().version).toBe(0);
  });

  it('adoptShippedSeeds takes the code seed (overlays kept), clears the finding and records the current hash', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 0,
      state: { entitiesByCatalog: { items: { [ITEM]: { ...seeded.items[ITEM], name: 'Renamed locally', lifecycle: 'verified' } } } },
    }));
    await useCatalogStore.persist.rehydrate();
    useCatalogStore.getState().adoptShippedSeeds([{ catalogId: 'items', entityId: ITEM }]);
    const s = useCatalogStore.getState();

    expect(s.entitiesByCatalog.items[ITEM]).toEqual({ ...seeded.items[ITEM], lifecycle: 'verified' });
    expect(s.seedDrift).toEqual([]);
    expect(s.seedHashes[seedKey('items', ITEM)]).toBe(seedContentHash(seeded.items[ITEM]));
  });

  it('keepMine records the current seed hash, so the next load reads the row as edited (kept, no finding)', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 0,
      state: { entitiesByCatalog: { items: { [ITEM]: { ...seeded.items[ITEM], name: 'Renamed locally' } } } },
    }));
    await useCatalogStore.persist.rehydrate();
    useCatalogStore.getState().keepMine([{ catalogId: 'items', entityId: ITEM }]);
    expect(useCatalogStore.getState().seedDrift).toEqual([]);
    expect(useCatalogStore.getState().seedHashes[seedKey('items', ITEM)]).toBe(seedContentHash(seeded.items[ITEM]));

    await useCatalogStore.persist.rehydrate();
    const s = useCatalogStore.getState();
    expect(s.entitiesByCatalog.items[ITEM].name).toBe('Renamed locally');
    expect(s.seedDrift).toEqual([]);
  });
});
