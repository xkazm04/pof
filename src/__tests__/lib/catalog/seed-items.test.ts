import { describe, it, expect } from 'vitest';
import { itemToEntry, seedItemEntries } from '@/lib/catalog/seed-items';
import { DUMMY_ITEMS } from '@/components/modules/core-engine/sub_inventory/_shared/data';

describe('itemToEntry', () => {
  const it0 = DUMMY_ITEMS[0];
  it('prefixes id, keeps name, data === input', () => {
    const e = itemToEntry(it0);
    expect(e.id).toBe(`item-${it0.id}`);
    expect(e.name).toBe(it0.name);
    expect(e.data).toBe(it0);
    expect(e.catalogId).toBe('items');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [type, rarity] and tags = [type, subtype]', () => {
    const e = itemToEntry(it0);
    expect(e.categoryPath).toEqual([it0.type, it0.rarity]);
    expect(e.tags).toEqual([it0.type, it0.subtype]);
  });
});

describe('seedItemEntries', () => {
  it('maps every item with unique ids', () => {
    const entries = seedItemEntries();
    expect(entries.length).toBe(DUMMY_ITEMS.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
