import { describe, it, expect } from 'vitest';
import { archetypeToEntry, seedBestiaryEntries } from '@/lib/catalog/seed-bestiary';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import { seedLootEntries } from '@/lib/catalog/seed-loot';

describe('archetypeToEntry', () => {
  const a0 = ARCHETYPES[0];
  it('prefixes id, keeps name + data, lifecycle planned', () => {
    const e = archetypeToEntry(a0);
    expect(e.id).toBe(`bestiary-${a0.id}`);
    expect(e.name).toBe(a0.label);
    expect(e.data).toBe(a0);
    expect(e.catalogId).toBe('bestiary');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Bestiary, tier, role] and tags = [class, category]', () => {
    const e = archetypeToEntry(a0);
    expect(e.categoryPath).toEqual(['Bestiary', a0.tier, a0.role]);
    expect(e.tags).toEqual([a0.class, a0.category]);
  });
});

describe('seedBestiaryEntries — cross-catalog links', () => {
  const entries = seedBestiaryEntries();

  it('maps every archetype with unique ids', () => {
    expect(entries.length).toBe(ARCHETYPES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('links a known archetype to its loot table case-insensitively (brute → lt-Brute)', () => {
    // Archetype ids are lowercase, loot bindings are PascalCase; link uses the binding's PascalCase id.
    const brute = entries.find((e) => e.data.id === 'brute');
    expect(brute).toBeDefined();
    const lootLink = brute!.links?.find((l) => l.catalogId === 'loot-tables');
    expect(lootLink?.entityId).toBe('lt-Brute');
    expect(lootLink?.role).toBe('loot');
  });

  it('links all 14 joinable archetypes (hyphenated ids included), each to a real loot-tables id', () => {
    const lootIds = new Set(seedLootEntries().map((e) => e.id));
    const lootLinks = entries.flatMap((e) =>
      (e.links ?? []).filter((l) => l.catalogId === 'loot-tables' && l.role === 'loot'),
    );
    expect(lootLinks).toHaveLength(14);
    for (const link of lootLinks) expect(lootIds.has(link.entityId)).toBe(true);
    const grunt = entries.find((e) => e.data.id === 'melee-grunt');
    expect(grunt!.links?.find((l) => l.catalogId === 'loot-tables')?.entityId).toBe('lt-MeleeGrunt');
  });

  it('[guard] loot-tables ids do not move: 22 PascalCase lt-<bindingId> ids', () => {
    const ids = seedLootEntries().map((e) => e.id);
    expect(ids).toHaveLength(22);
    expect(ids).toEqual(DEFAULT_ENEMY_LOOT_BINDINGS.map((b) => `lt-${b.archetypeId}`));
    for (const id of ids) expect(id).toMatch(/^lt-[A-Z][A-Za-z]+$/);
  });

  it('drops unmatched ability names (no fabricated spellbook links)', () => {
    const allAbilityLinks = entries.flatMap((e) => (e.links ?? []).filter((l) => l.catalogId === 'spellbook'));
    for (const link of allAbilityLinks) {
      expect(link.entityId).toMatch(/^[a-z0-9-]+$/);
      expect(link.role).toBe('ability');
    }
  });
});
