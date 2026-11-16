import { describe, it, expect } from 'vitest';
import { generateUE5LootTableCpp } from '@/components/modules/core-engine/sub_loot/_shared/codegen';
import type { LootEditorEntry } from '@/components/modules/core-engine/sub_loot/_shared/data';

const entry = (name: string): LootEditorEntry => ({ id: 'x', name, weight: 5, rarity: 'Common', color: 'c' });

/** Every line of generated C++ that is not a // comment must be one of the known statements. */
const ALLOWED = [
  /^$/,
  /^NothingWeight = [0-9.]+f;$/,
  /^[{}]$/,
  /^FLootEntry& E = Entries[.]AddDefaulted_GetRef[(][)];$/,
  /^E[.]DropWeight = [0-9.]+f;$/,
  /^E[.]M(?:in|ax)Quantity = [0-9]+;$/,
  /^E[.]M(?:in|ax)Rarity = EARPGItemRarity::[A-Za-z]+;$/,
];

function liveLines(cpp: string): string[] {
  return cpp.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => !l.startsWith('//'));
}
const unexpected = (cpp: string) => liveLines(cpp).filter((l) => !ALLOWED.some((re) => re.test(l)));

describe('generated loot C++ cannot carry imported text out of its comments', () => {
  it('a newline in an item name injects no live statement', () => {
    const cpp = generateUE5LootTableCpp([entry('X\nE.DropWeight = 9999.f;'), entry('Y\rZ()')], 0);
    expect(unexpected(cpp)).toEqual([]);
    expect(liveLines(cpp).some((l) => l.includes('9999'))).toBe(false);
  });

  it('an apostrophe name yields a UE-legal asset path', () => {
    const cpp = generateUE5LootTableCpp([entry("Bacca's Blade"), entry('Sword "Of" Dawn / v2')], 0);
    const paths = [...cpp.matchAll(/TEXT[(]"([^"]*)"[)]/g)].map((m) => m[1]);
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p).toMatch(/^[/]Game[/]Items[/][A-Za-z0-9_-]+$/);
  });

  it('plain names keep their existing asset path', () => {
    const cpp = generateUE5LootTableCpp([entry('Iron Sword')], 0);
    expect(cpp).toContain('TEXT("/Game/Items/Iron_Sword")');
  });
});
