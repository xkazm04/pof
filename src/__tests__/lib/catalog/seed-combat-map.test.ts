import { describe, it, expect } from 'vitest';
import { comboToEntry, seedCombatInteractionEntries } from '@/lib/catalog/seed-combat-map';
import { COMBO_SEQUENCES } from '@/components/modules/core-engine/unique-tabs/CombatActionMap/data-metrics';

describe('comboToEntry', () => {
  const c0 = COMBO_SEQUENCES[0];
  it('prefixes id, keeps name + data', () => {
    const e = comboToEntry(c0);
    expect(e.id).toBe(`combo-${c0.id}`);
    expect(e.name).toBe(c0.name);
    expect(e.data).toBe(c0);
    expect(e.catalogId).toBe('combat-map');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Combat Map, weaponCategory] and tags = [weaponCategory]', () => {
    const e = comboToEntry(c0);
    expect(e.categoryPath).toEqual(['Combat Map', c0.weaponCategory]);
    expect(e.tags).toEqual([c0.weaponCategory]);
  });
});

describe('seedCombatInteractionEntries', () => {
  it('maps every combo with unique ids', () => {
    const entries = seedCombatInteractionEntries();
    expect(entries.length).toBe(COMBO_SEQUENCES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
