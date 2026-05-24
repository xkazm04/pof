import { describe, it, expect } from 'vitest';
import { abilityToEntry, seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

describe('abilityToEntry', () => {
  const a = SPELLBOOK_ABILITIES[0];

  it('preserves id and name', () => {
    const e = abilityToEntry(a);
    expect(e.id).toBe(a.id);
    expect(e.name).toBe(a.name);
  });

  it('derives categoryPath = [category, element] and tags = [tier]', () => {
    const e = abilityToEntry(a);
    expect(e.categoryPath).toEqual([a.category, a.element]);
    expect(e.tags).toEqual([a.tier]);
  });

  it('keeps data === input, lifecycle planned, catalogId spellbook', () => {
    const e = abilityToEntry(a);
    expect(e.data).toBe(a);
    expect(e.lifecycle).toBe('planned');
    expect(e.catalogId).toBe('spellbook');
  });
});

describe('seedSpellbookEntries', () => {
  it('maps every ability', () => {
    expect(seedSpellbookEntries().length).toBe(SPELLBOOK_ABILITIES.length);
  });

  it('produces unique ids', () => {
    const ids = seedSpellbookEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
