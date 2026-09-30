import { describe, expect, it } from 'vitest';
import { itemEnumOrdinal, itemWrapperByEnumId } from '@/lib/catalog/reference/itemIndex';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

function item(key: string, id: string): ReferenceWrapper {
  return {
    wrapperId: `test:items/itemdat.tsv:${key}`,
    sourceId: 'test',
    file: 'items/itemdat.tsv',
    technique: 'fixture',
    key,
    keyKind: id ? 'column' : 'positional',
    raw: { id },
    rawHash: key,
    catalogId: 'items',
    mappingVersion: 'fixture',
    entity: {
      id: `d1-${key}`,
      catalogId: 'items',
      name: key,
      categoryPath: [],
      tags: [],
      lifecycle: 'planned',
      data: {},
      provenance: {
        kind: 'ingest',
        sourceGame: 'fixture',
        sourceProject: 'fixture',
        sourceFile: 'items/itemdat.tsv',
        sourceRow: key,
        licenceNote: 'test',
        ingestedAt: '2026-01-01T00:00:00.000Z',
        canonProfile: 'diablo1',
      },
    },
  };
}

describe('Diablo I item enum ordinal index', () => {
  it('resolves both named rows and blank-id positional wrappers', () => {
    const named = item('IDI_HEAL', 'IDI_HEAL');
    const blankSorcererStaff = item('row166', '');
    const wrappers = [named, blankSorcererStaff];

    expect(itemEnumOrdinal('IDI_HEAL')).toBe(24);
    expect(itemEnumOrdinal('idi_sorcerer_diablo')).toBe(166);
    expect(itemWrapperByEnumId(wrappers, 'IDI_HEAL')).toBe(named);
    expect(itemWrapperByEnumId(wrappers, 'IDI_SORCERER_DIABLO')).toBe(blankSorcererStaff);
    expect(itemWrapperByEnumId(wrappers, 'IDI_NOT_REAL')).toBeUndefined();
  });
});
