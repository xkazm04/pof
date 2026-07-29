import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
import { seedAllCatalogs } from '@/lib/catalog/sections';

/**
 * The persist `merge` has to run one level deeper than a spread of catalogs.
 *
 * A per-CATALOG spread replaced each seeded catalog wholesale with the persisted blob's
 * version of it, so a newly seeded entity added to an EXISTING catalog never reached a
 * returning user — only an entirely new catalog id did. That is a refresh bug with a very
 * long tail: the seed ships new content, and the people who used the app before never see it.
 */
describe('catalogStore persist merge — new seed entities reach returning users', () => {
  const seeded = seedAllCatalogs();
  const catalogId = 'items';
  const seededIds = Object.keys(seeded[catalogId]);

  beforeEach(() => {
    localStorage.clear();
    useCatalogStore.setState({ entitiesByCatalog: seedAllCatalogs(), draftEntitiesByCatalog: {} });
  });

  it('keeps a newly seeded entity that the persisted blob has never heard of', async () => {
    // A returning user whose persisted blob holds only the FIRST items entity.
    const kept = seededIds[0];
    localStorage.setItem('pof-catalog', JSON.stringify({
      version: 0,
      state: { entitiesByCatalog: { [catalogId]: { [kept]: { ...seeded[catalogId][kept], name: 'Renamed locally' } } } },
    }));

    await useCatalogStore.persist.rehydrate();
    const merged = useCatalogStore.getState().entitiesByCatalog[catalogId];

    // The persisted row still wins where it exists…
    expect(merged[kept].name).toBe('Renamed locally');
    // …and every other seeded entity survives instead of being spread away.
    expect(Object.keys(merged).sort()).toEqual([...seededIds].sort());
    expect(seededIds.length).toBeGreaterThan(1);
  });

  it('still lets the persisted blob introduce a catalog the seed does not have', async () => {
    localStorage.setItem('pof-catalog', JSON.stringify({
      version: 0,
      state: { entitiesByCatalog: { 'custom-catalog': { x1: { id: 'x1', name: 'X', lifecycle: 'planned' } } } },
    }));

    await useCatalogStore.persist.rehydrate();
    const byCatalog = useCatalogStore.getState().entitiesByCatalog;
    expect(byCatalog['custom-catalog'].x1.name).toBe('X');
    expect(Object.keys(byCatalog[catalogId]).sort()).toEqual([...seededIds].sort());
  });
});
