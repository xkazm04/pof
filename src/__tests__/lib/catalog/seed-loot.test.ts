import { describe, it, expect } from 'vitest';
import { lootBindingToEntry, seedLootEntries } from '@/lib/catalog/seed-loot';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

describe('lootBindingToEntry', () => {
  it('maps a boss binding to a Boss tier', () => {
    const boss = DEFAULT_ENEMY_LOOT_BINDINGS.find((b) => b.dropChance >= 1)!;
    const e = lootBindingToEntry(boss);
    expect(e.id).toBe(`lt-${boss.archetypeId}`);
    expect(e.name).toBe(boss.lootTableName);
    expect(e.catalogId).toBe('loot-tables');
    expect(e.categoryPath).toEqual(['Loot Tables', 'Boss']);
    expect(e.data).toBe(boss);
  });
  it('maps a minion (low dropChance) to a Minion tier', () => {
    const minion = DEFAULT_ENEMY_LOOT_BINDINGS.find((b) => b.dropChance < 0.32)!;
    expect(lootBindingToEntry(minion).categoryPath).toEqual(['Loot Tables', 'Minion']);
  });
});

describe('seedLootEntries', () => {
  it('maps every binding with unique ids', () => {
    const entries = seedLootEntries();
    expect(entries.length).toBe(DEFAULT_ENEMY_LOOT_BINDINGS.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
