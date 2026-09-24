// /diablo W10 (D2) — base-item seeds from a reference row, graded by the REAL items steps. A seed writes what the
// reference states in the shape UE's UARPGItemDefinition declares (slot, damage/armour range, durability,
// attribute requirements) and names every field it cannot fill; a seeded step never grades pass. Synthetic rows.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { seedItemSteps } from '@/lib/catalog/reference/stepSeeds';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const itemSpec = DIABLO1.tables.find((t) => t.catalogId === 'items')!;
const COLS = Object.keys(itemSpec.map);
const tsv = (rows: Record<string, string>[]) => [COLS.join('\t'), ...rows.map((r) => COLS.map((c) => r[c] ?? '').join('\t'))].join('\n');
const row = (r: Record<string, string>) => wrapTable(DIABLO1, itemSpec, tsv([r]), 't0').wrappers[0];

const sword = row({ class: 'Weapon', equipType: 'Two-handed', itemType: 'Sword', name: 'Test Blade', minMonsterLevel: '9', durability: '40', minDamage: '3', maxDamage: '11', minStrength: '30', minMagic: '5', minDexterity: '12' });
const shield = row({ class: 'Armor', equipType: 'One-handed', itemType: 'Shield', name: 'Test Shield', durability: '20', minArmor: '4', maxArmor: '7' });
const potion = row({ class: 'Misc', equipType: 'Unequippable', itemType: 'Misc', name: 'Test Potion' });

describe('seedItemSteps', () => {
  it('seeds a weapon\'s Base Type and Damage, stamped with the source row', () => {
    const seeds = seedItemSteps(sword);
    expect(seeds.map((s) => s.step)).toEqual(['Base Type & Rarity', 'Damage / Implicit']);
    for (const s of seeds) expect(s.data.sourced).toBeDefined();
  });

  it('writes the UE-declared fields: slot, two-handedness, requirements (Magic → Intelligence), durability', () => {
    const b = seedItemSteps(sword)[0].data.baseType as Record<string, unknown>;
    expect(b.slot).toBe('Weapon');
    expect(b.twoHanded).toBe(true);
    expect(b.requirements).toEqual({ strength: 30, dexterity: 12, intelligence: 5 });
    expect(b.durability).toBe(40);
    expect(b.dropLevel).toBe(9);
  });

  it('declares, never invents, what the reference cannot state', () => {
    const b = seedItemSteps(sword)[0].data.baseType as Record<string, unknown>;
    for (const k of ['rarity', 'ilvl', 'requiredLevel', 'implicit']) expect(b[k]).toBe(REFERENCE_GAP);
    const d = seedItemSteps(sword)[1].data.damage as Record<string, unknown>;
    expect(d).toMatchObject({ damageMin: 3, damageMax: 11 });
    expect(d.attackSpeed).toBe(REFERENCE_GAP);
    expect(seedItemSteps(sword)[1].gaps.join(' ')).toMatch(/class/);
  });

  it('puts a shield in the off hand, with its armour range and no Damage seed', () => {
    const seeds = seedItemSteps(shield);
    expect(seeds.map((s) => s.step)).toEqual(['Base Type & Rarity']);
    const b = seeds[0].data.baseType as Record<string, unknown>;
    expect(b.slot).toBe('OffHand');
    expect(b.armor).toEqual({ minimum: 4, maximum: 7 });
  });

  it('seeds nothing for an item that cannot be worn', () => {
    expect(seedItemSteps(potion)).toEqual([]);
  });
});
