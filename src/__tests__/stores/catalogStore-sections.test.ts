import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';

describe('catalogStore multi-section seeding', () => {
  it('seeds spellbook, items, and loot-tables on init', () => {
    const byCat = useCatalogStore.getState().entitiesByCatalog;
    expect(Object.keys(byCat.spellbook ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(byCat.items ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(byCat['loot-tables'] ?? {}).length).toBeGreaterThan(0);
  });
});
