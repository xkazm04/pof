import { describe, it, expect } from 'vitest';
import { parseUE5LootTable, generateUE5LootTableJson } from '@/components/modules/core-engine/sub_loot/_shared/codegen';

// UE5 rolls FMath::RandRange(Min, Max): an imported inverted range must not survive the
// import -> edit -> re-export round trip as Min > Max.
describe('parseUE5LootTable - an inverted quantity range is normalised', () => {
  it('MinQuantity > MaxQuantity is swapped so min <= max', () => {
    const { entries } = parseUE5LootTable({ Entries: [{ Item: 'Potion', MinQuantity: 5, MaxQuantity: 1 }] });
    expect(entries[0].minQuantity).toBe(1);
    expect(entries[0].maxQuantity).toBe(5);
  });

  it('the re-export never emits Min > Max', () => {
    const { entries, nothingWeight } = parseUE5LootTable({ Entries: [{ Item: 'Potion', MinQuantity: 9, MaxQuantity: 2 }] });
    const out = JSON.parse(generateUE5LootTableJson(entries, nothingWeight)) as { Entries: { MinQuantity: number; MaxQuantity: number }[] };
    expect(out.Entries[0].MinQuantity).toBeLessThanOrEqual(out.Entries[0].MaxQuantity);
  });

  it('an ordered range is kept as-is', () => {
    const { entries } = parseUE5LootTable({ Entries: [{ Item: 'Potion', MinQuantity: 1, MaxQuantity: 3 }] });
    expect([entries[0].minQuantity, entries[0].maxQuantity]).toEqual([1, 3]);
  });
});
