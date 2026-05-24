import { describe, it, expect } from 'vitest';
import { archetypeToEntry, seedBestiaryEntries } from '@/lib/catalog/seed-bestiary';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

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

  it('drops unmatched ability names (no fabricated spellbook links)', () => {
    const allAbilityLinks = entries.flatMap((e) => (e.links ?? []).filter((l) => l.catalogId === 'spellbook'));
    for (const link of allAbilityLinks) {
      expect(link.entityId).toMatch(/^[a-z0-9-]+$/);
      expect(link.role).toBe('ability');
    }
  });
});
