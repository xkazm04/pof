import { describe, it, expect } from 'vitest';
import {
  parseUE5LootTable,
  generateUE5LootTableCpp,
} from '@/components/modules/core-engine/sub_loot/_shared/codegen';
import { RARITY_ENUM_VALUES } from '@/components/modules/core-engine/sub_loot/_shared/data';
import type { UE5LootTableJson } from '@/components/modules/core-engine/sub_loot/_shared/data';

const table = {
  Entries: [
    { Item: 'Sword', MinRarity: 'EARPGItemRarity::Mythic', MaxRarity: 'EARPGItemRarity::Legendary' },
    { Item: 'Potion', MinRarity: 'EARPGItemRarity::Rare' },
  ],
} as unknown as UE5LootTableJson;

function invalidLiterals(cpp: string): string[] {
  const found = [...cpp.matchAll(/EARPGItemRarity::(\w+)/g)].map((m) => m[1]);
  return found.filter((v) => !RARITY_ENUM_VALUES.includes(v));
}

describe('unknown imported rarity never reaches generated C++', () => {
  it('emits only real EARPGItemRarity values for an unknown-rarity row', () => {
    const { entries } = parseUE5LootTable(table);
    expect(invalidLiterals(generateUE5LootTableCpp(entries, 0))).toEqual([]);
  });

  it('maps the unknown value to Common and keeps known values intact', () => {
    const { entries } = parseUE5LootTable(table);
    expect(entries[0].minRarity).toBe('Common');
    expect(entries[0].maxRarity).toBe('Legendary');
    expect(entries[1].minRarity).toBe('Rare');
  });

  it('reports a warning naming the row and the unknown value', () => {
    const { warnings } = parseUE5LootTable(table);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Sword');
    expect(warnings[0]).toContain('Mythic');
  });

  it('codegen guards entries built outside the importer too', () => {
    const cpp = generateUE5LootTableCpp(
      [{ id: 'x', name: 'Odd', weight: 1, rarity: 'Mythic', color: 'x', minRarity: 'Mythic', maxRarity: 'Mythic' }],
      0,
    );
    expect(invalidLiterals(cpp)).toEqual([]);
  });

  it('a clean table produces no warnings', () => {
    expect(parseUE5LootTable({ Entries: [{ Item: 'A', MinRarity: 'Epic' }] }).warnings).toEqual([]);
  });
});
