import { describe, it, expect } from 'vitest';
import { parseUE5LootTable } from '@/components/modules/core-engine/sub_loot/_shared/codegen';
import type { UE5LootTableJson } from '@/components/modules/core-engine/sub_loot/_shared/data';

// The UE5 import reads arbitrary user JSON. Valid JSON of the wrong shape must import as
// "no entries" (the editor then says so), never throw into the editor's catch, which
// reports it as "Failed to parse JSON" - a false reason for a file that parsed fine.
const asTable = (v: unknown) => v as UE5LootTableJson;

describe('parseUE5LootTable - wrong-shape JSON is total, not a throw', () => {
  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'Entries'],
    ['an array', [{ DropWeight: 1 }]],
  ])('top-level %s yields zero entries', (_label, json) => {
    expect(() => parseUE5LootTable(asTable(json))).not.toThrow();
    expect(parseUE5LootTable(asTable(json)).entries).toEqual([]);
  });

  it('a non-array Entries yields zero entries', () => {
    expect(() => parseUE5LootTable(asTable({ Entries: { Item: 'Sword' } }))).not.toThrow();
    expect(parseUE5LootTable(asTable({ Entries: { Item: 'Sword' } })).entries).toEqual([]);
    expect(parseUE5LootTable(asTable({ Properties: null, Entries: 'x' })).entries).toEqual([]);
  });

  it('null / non-object rows are skipped, real rows survive', () => {
    const { entries } = parseUE5LootTable(asTable({ Entries: [null, 7, { Item: 'IT_Iron_Sword', DropWeight: 5 }] }));
    expect(entries.map((e) => e.name)).toEqual(['Iron Sword']);
    expect(entries[0].weight).toBe(5);
  });
});
