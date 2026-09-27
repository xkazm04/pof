import { describe, expect, it } from 'vitest';
import { expectedDefensiveStoreStock } from '@/lib/catalog/reference/storeMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Invented test game',
  sourceProject: 'hand-computed fixture',
  sourceFile: 'fixture.tsv',
  sourceRow: 'fixture',
  licenceNote: 'test only',
  ingestedAt: '2026-01-01T00:00:00.000Z',
  canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  catalogId: string,
  file: string,
  raw: Record<string, string>,
  data: Record<string, unknown> = {},
): ReferenceWrapper {
  return {
    wrapperId: `test:${file}:${id}`,
    sourceId: 'test',
    file,
    technique: 'fixture',
    key: id,
    keyKind: 'column',
    raw,
    rawHash: id,
    catalogId,
    mappingVersion: 'fixture',
    entity: {
      id,
      catalogId,
      name: id,
      categoryPath: [],
      lifecycle: 'planned',
      tags: [],
      data,
      provenance,
    },
  };
}

const body = wrapper('invented-body', 'items', 'items/itemdat.tsv', {
  dropRate: '1', itemType: 'LightArmor', minMonsterLevel: '1', minArmor: '10', maxArmor: '10',
  minStrength: '0', minMagic: '0', minDexterity: '0', value: '100', miscId: 'NONE', spell: 'Null',
});
const resistance = wrapper('invented-resistance', 'affixes', 'items/item_prefixes.tsv', {
  power: 'ALLRES', 'power.value1': '10', 'power.value2': '10', minLevel: '1', itemTypes: 'Armor',
  alignment: 'Any', chance: '1', useful: 'true', minVal: '20', maxVal: '20', multVal: '2',
});
const recovery = wrapper('invented-recovery', 'affixes', 'items/item_suffixes.tsv', {
  power: 'FASTRECOVER', 'power.value1': '2', 'power.value2': '2', minLevel: '1', itemTypes: 'Armor',
  alignment: 'Any', chance: '1', useful: 'true', minVal: '10', maxVal: '10', multVal: '2',
});

describe('expectedDefensiveStoreStock', () => {
  it('projects basic, premium, Wirt, and Adria stock with conservative ranked offers and prices', () => {
    const result = expectedDefensiveStoreStock({
      heroLevel: 1,
      deepestVisitedDepth: 0,
      strength: 0,
      magic: 0,
      dexterity: 0,
      shieldAllowed: true,
      wrappers: [body, resistance, recovery],
    });

    expect(result.stores.map((store) => store.store)).toEqual([
      'griswold-basic', 'griswold-premium', 'adria', 'wirt',
    ]);
    expect(result.stores.find((store) => store.store === 'griswold-basic')?.offers)
      .toContainEqual(expect.objectContaining({
        equipmentSlot: 'body', target: 'armour', armourClass: 10, expectedPrice: 100,
      }));
    const premium = result.stores.find((store) => store.store === 'griswold-premium')!;
    expect(premium.offers).toContainEqual(expect.objectContaining({
      equipmentSlot: 'body', target: 'magic-resistance', resistances: { magic: 10, fire: 10, lightning: 10 },
    }));
    expect(premium.offers).toContainEqual(expect.objectContaining({
      equipmentSlot: 'body', target: 'hit-recovery', hitRecoveryTier: 'faster',
    }));
    expect(premium.offers.every((offer) => offer.expectedSaleValue > 0)).toBe(true);
    expect(result.stores.find((store) => store.store === 'adria')?.offers).toEqual([]);
    expect(result.stores.find((store) => store.store === 'wirt')?.offers
      .every((offer) => offer.expectedPrice >= 50)).toBe(true);
  });

  it('keeps requirement-gated and two-handed-shield offers out of the usable expectation', () => {
    const gatedShield = wrapper('invented-shield', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'Shield', minMonsterLevel: '1', minArmor: '20', maxArmor: '20',
      minStrength: '20', minMagic: '0', minDexterity: '0', value: '50', miscId: 'NONE', spell: 'Null',
    });
    const result = expectedDefensiveStoreStock({
      heroLevel: 1,
      deepestVisitedDepth: 0,
      strength: 0,
      magic: 0,
      dexterity: 0,
      shieldAllowed: false,
      wrappers: [body, gatedShield, resistance, recovery],
    });

    expect(result.stores.flatMap((store) => store.offers)
      .some((offer) => offer.equipmentSlot === 'shield')).toBe(false);
  });
});
