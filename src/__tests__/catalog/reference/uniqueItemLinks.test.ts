import { describe, expect, it } from 'vitest';
import { resolveLinks } from '@/lib/catalog/reference/links';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const, sourceGame: 'Synthetic', sourceProject: 'tests', sourceFile: 'synthetic.tsv',
  sourceRow: 'row=0', licenceNote: 'invented test values', ingestedAt: 't0', canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  file: string,
  data: Record<string, unknown>,
  links?: { catalogId: string; entityId: string; role: string }[],
): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file, technique: 'test', key: id, keyKind: 'column',
    raw: {}, rawHash: 'raw', catalogId: file.startsWith('monsters/') ? 'bestiary' : 'items', mappingVersion: 'test',
    entity: { id, catalogId: file.startsWith('monsters/') ? 'bestiary' : 'items', name: id, categoryPath: [], lifecycle: 'planned', tags: [], data, links, provenance },
  };
}

describe('Diablo I unique-item links', () => {
  it('joins every matching base wrapper and resolves Uniq(X) by unique enum index, not shared base enum', () => {
    const baseA = wrapper('d1-base-a', 'items/itemdat.tsv', { uniqueBase: 'SYNTH_BASE' });
    const baseB = wrapper('d1-base-b', 'items/itemdat.tsv', { uniqueBase: 'SYNTH_BASE' });
    const first = wrapper('d1-uitem-first', 'items/unique_itemdat.tsv', { uniqueBase: 'SYNTH_BASE' });
    const second = wrapper('d1-uitem-second', 'items/unique_itemdat.tsv', { uniqueBase: 'SYNTH_BASE' });
    const monsterA = wrapper('d1-monster-a', 'monsters/monstdat.tsv', {}, [
      { catalogId: 'items', entityId: 'CLEAVER', role: 'unique-drop' },
    ]);
    const monsterB = wrapper('d1-monster-b', 'monsters/monstdat.tsv', {}, [
      { catalogId: 'items', entityId: 'SKCROWN', role: 'unique-drop' },
    ]);

    const result = resolveLinks([baseA, baseB, first, second, monsterA, monsterB], 'd1');
    const entity = (id: string) => result.wrappers.find((candidate) => candidate.entity.id === id)!.entity;
    expect(entity('d1-uitem-first').links).toEqual([
      { catalogId: 'items', entityId: 'd1-base-a', role: 'base-item' },
      { catalogId: 'items', entityId: 'd1-base-b', role: 'base-item' },
    ]);
    expect(entity('d1-uitem-second').links).toEqual([
      { catalogId: 'items', entityId: 'd1-base-a', role: 'base-item' },
      { catalogId: 'items', entityId: 'd1-base-b', role: 'base-item' },
    ]);
    expect(entity('d1-monster-a').links?.[0].entityId).toBe('d1-uitem-first');
    expect(entity('d1-monster-b').links?.[0].entityId).toBe('d1-uitem-second');
    expect(result.report).toEqual({ resolved: 6, unresolved: [] });
  });
});
