import { describe, expect, it } from 'vitest';
import {
  effectiveUniqueItem,
  effectiveUniqueItemsForPromotion,
} from '@/lib/catalog/reference/uniqueItems';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic',
  sourceProject: 'tests',
  sourceFile: 'synthetic.tsv',
  sourceRow: 'row=0',
  licenceNote: 'invented test values',
  ingestedAt: 't0',
  canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  file: string,
  raw: Record<string, string>,
  data: Record<string, unknown> = {},
  links?: ReferenceWrapper['entity']['links'],
): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`,
    sourceId: 'test',
    file,
    technique: 'test',
    key: id,
    keyKind: 'column',
    raw,
    rawHash: 'raw',
    catalogId: 'items',
    mappingVersion: 'test',
    entity: {
      id,
      catalogId: 'items',
      name: id,
      categoryPath: [],
      lifecycle: 'planned',
      tags: [],
      data,
      links,
      provenance,
    },
  };
}

const baseRaw = {
  class: 'Weapon',
  equipType: 'Two-handed',
  itemType: 'Sword',
  uniqueBaseItem: 'SYNTH_BASE',
  durability: '40',
  minDamage: '3',
  maxDamage: '8',
  minArmor: '1',
  maxArmor: '4',
  minStrength: '25',
  minMagic: '6',
  minDexterity: '9',
};

describe('effectiveUniqueItem', () => {
  it('starts from the base and applies SETDAM, SETAC, NOMINSTR, and percentage damage in order', () => {
    const base = wrapper('d1-base', 'items/itemdat.tsv', baseRaw);
    const unique = wrapper('d1-uitem-synthetic', 'items/unique_itemdat.tsv', {
      uniqueBaseItem: 'SYNTH_BASE',
    }, {
      powers: [
        { power: 'SETDAM', min: '5', max: '9' },
        { power: 'SETAC', min: '12', max: '14' },
        { power: 'NOMINSTR' },
        { power: 'DAMP', min: '50', max: '50' },
      ],
    });

    const effective = effectiveUniqueItem(unique, base);
    expect(effective.damage).toEqual({ value: { min: 5, max: 9 }, source: 'unique power' });
    expect(effective.damagePercent).toEqual({ value: { min: 50, max: 50 }, source: 'unique power' });
    expect(effective.effectiveDamage).toEqual({ value: { min: 7, max: 13 }, source: 'engine rule' });
    expect(effective.armor).toEqual({ value: { min: 12, max: 14 }, source: 'unique power' });
    expect(effective.requiredStrength).toEqual({ value: 0, source: 'unique power' });
    expect(effective.requiredMagic).toEqual({ value: 6, source: 'base' });
    expect(effective.durability).toEqual({ value: { min: 40, max: 40 }, source: 'base' });
    expect(effective.equipType).toEqual({ value: 'Two-handed', source: 'base' });
    expect(effective.slot).toEqual({ value: 'Weapon', source: 'base' });
  });

  it('uses the first ordered base-item link for the engine choice and writes data.effective', () => {
    const first = wrapper('d1-base-first', 'items/itemdat.tsv', { ...baseRaw, itemType: 'Axe' });
    const second = wrapper('d1-base-second', 'items/itemdat.tsv', { ...baseRaw, itemType: 'Sword' });
    const unique = wrapper('d1-uitem-synthetic', 'items/unique_itemdat.tsv', {
      uniqueBaseItem: 'SYNTH_BASE',
    }, { powers: [] }, [
      { catalogId: 'items', entityId: first.entity.id, role: 'base-item' },
      { catalogId: 'items', entityId: second.entity.id, role: 'base-item' },
    ]);

    const result = effectiveUniqueItemsForPromotion([unique], [second, unique, first]);
    expect(result.unresolved).toEqual([]);
    expect(result.wrappers).toHaveLength(1);
    const effective = result.wrappers[0].entity.data.effective as ReturnType<typeof effectiveUniqueItem>;
    expect(effective.itemType).toEqual({ value: 'Axe', source: 'base' });
  });

  it('reports an ambiguous match when ordered links are unavailable', () => {
    const first = wrapper('d1-base-first', 'items/itemdat.tsv', baseRaw);
    const second = wrapper('d1-base-second', 'items/itemdat.tsv', baseRaw);
    const unique = wrapper('d1-uitem-synthetic', 'items/unique_itemdat.tsv', {
      uniqueBaseItem: 'SYNTH_BASE',
    }, { powers: [] });

    const result = effectiveUniqueItemsForPromotion([unique], [unique, first, second]);
    expect(result.wrappers).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/matches 2 itemdat rows/);
  });
});
