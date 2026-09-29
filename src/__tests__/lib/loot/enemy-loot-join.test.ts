import { describe, it, expect } from 'vitest';
import {
  archetypeIdForLootTable,
  enemyLootCoverage,
  lootBindingForArchetype,
  lootTableIdForArchetype,
  lootWireClause,
} from '@/lib/loot/enemy-loot-join';
import { seedLootEntries } from '@/lib/catalog/seed-loot';

describe('enemy-loot-join — one normalised archetype key', () => {
  it('resolves kebab bestiary ids to the PascalCase loot-tables id', () => {
    expect(lootTableIdForArchetype('melee-grunt')).toBe('lt-MeleeGrunt');
    expect(lootTableIdForArchetype('brute')).toBe('lt-Brute');
    expect(lootTableIdForArchetype('darth-malak')).toBe('lt-DarthMalak');
    expect(lootTableIdForArchetype('taris-thug')).toBeNull();
  });

  it('resolves a loot-tables id back to its bestiary archetype id, or null for an orphan table', () => {
    expect(archetypeIdForLootTable('lt-MandalorianWarrior')).toBe('mandalorian-warrior');
    expect(archetypeIdForLootTable('lt-SkeletonWarrior')).toBeNull();
    expect(archetypeIdForLootTable('MeleeGrunt')).toBeNull();
  });

  it('returns the binding row itself (drop chance etc.) for a bound archetype', () => {
    expect(lootBindingForArchetype('elite-knight')?.lootTableName).toBe('LT_Knight');
    expect(lootBindingForArchetype('taris-thug')).toBeNull();
  });

  it('wire clause names the real id, or says no loot-tables entry is bound', () => {
    expect(lootWireClause('war-droid')).toContain('lt-WarDroid');
    const none = lootWireClause('taris-thug');
    expect(none).toContain('no loot-tables entry is bound to this archetype');
    expect(none).not.toContain('lt-taris-thug');
  });

  it('coverage: 14 linked, 80 archetypes without a table, 8 orphan tables (all real loot-tables ids)', () => {
    const cov = enemyLootCoverage();
    expect(cov).toEqual({
      linked: 14,
      archetypesWithoutTable: 80,
      tablesWithoutArchetype: [
        'lt-SkeletonWarrior', 'lt-DarkAcolyte', 'lt-BanditArcher', 'lt-Enraged',
        'lt-Commander', 'lt-AncientDragon', 'lt-LichKing', 'lt-VoidHerald',
      ],
    });
    const lootIds = new Set(seedLootEntries().map((e) => e.id));
    for (const id of cov.tablesWithoutArchetype) expect(lootIds.has(id)).toBe(true);
  });
});
