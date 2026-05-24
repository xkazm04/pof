import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

describe('useCatalogStore', () => {
  it('seeds the spellbook catalog from SPELLBOOK_ABILITIES', () => {
    const spellbook = useCatalogStore.getState().entitiesByCatalog.spellbook;
    expect(Object.keys(spellbook).length).toBe(SPELLBOOK_ABILITIES.length);
  });

  it('resolves a seeded entry by id', () => {
    const e = useCatalogStore.getState().entitiesByCatalog.spellbook['off-fire-01'];
    expect(e).toBeDefined();
    expect(e.name).toBe('Fireball');
    expect(e.lifecycle).toBe('planned');
  });

  it('every seeded entry is planned with a categoryPath + tags', () => {
    const all = Object.values(useCatalogStore.getState().entitiesByCatalog.spellbook);
    for (const e of all) {
      expect(e.lifecycle).toBe('planned');
      expect(e.categoryPath.length).toBeGreaterThanOrEqual(2);
      expect(e.tags.length).toBeGreaterThanOrEqual(1);
    }
  });
});
