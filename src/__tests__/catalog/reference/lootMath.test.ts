import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import {
  MAGIC_AFFIX_ALLOCATION,
  expectedDrop,
  type LootMonsterProfile,
} from '@/lib/catalog/reference/lootMath';
import { DIABLO1_LOOT_LAWS } from '@/lib/catalog/reference/lootSpecsData';
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

const profile: LootMonsterProfile = {
  monsterId: 'd1-test-monster',
  baseSelectionLevel: 5,
  generationLevel: 4,
  dungeonLevel: 1,
  gameMode: 'single',
};

const gold = wrapper('d1-gold', 'items', 'items/itemdat.tsv', {
  dropRate: '1', itemType: 'Gold', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
});
const sword = wrapper('d1-test-sword', 'items', 'items/itemdat.tsv', {
  dropRate: '3', itemType: 'Sword', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
  uniqueBaseItem: 'TEST_SWORD', minDamage: '2', maxDamage: '5', minStrength: '0', minMagic: '0', minDexterity: '0',
}, { subtype: 'Sword' });
const gatedAxe = wrapper('d1-gated-axe', 'items', 'items/itemdat.tsv', {
  dropRate: '4', itemType: 'Axe', minMonsterLevel: '6', miscId: 'NONE', spell: 'Null',
  uniqueBaseItem: 'TEST_AXE', minDamage: '4', maxDamage: '8', minStrength: '0', minMagic: '0', minDexterity: '0',
}, { subtype: 'Axe' });
const prefix = wrapper('d1-prefix', 'affixes', 'items/item_prefixes.tsv', {
  power: 'DAMP', 'power.value1': '10', 'power.value2': '20', minLevel: '2', itemTypes: 'Weapon',
  alignment: 'Any', chance: '1', useful: 'true',
});
const suffix = wrapper('d1-suffix', 'affixes', 'items/item_suffixes.tsv', {
  power: 'DAMMOD', 'power.value1': '1', 'power.value2': '2', minLevel: '2', itemTypes: 'Weapon',
  alignment: 'Any', chance: '1', useful: 'true',
});

describe('expectedDrop', () => {
  it('matches the two-roll outcome, weighted pool, level gate, gold mean, and level quality gate', () => {
    const result = expectedDrop(profile, [gold, sword, gatedAxe], [prefix, suffix], [], 'normal');

    expect(result.pNothing).toBe(0.59);
    expect(result.pGold).toBeCloseTo(0.3034 + 0.1066 * (1 / 4), 12);
    expect(result.expectedGold).toBeCloseTo(result.pGold * 9.5, 12);
    expect(result.basePool).toEqual([{ baseId: sword.entity.id, p: 0.1066 * (3 / 4) }]);
    expect(result.basePool.some((row) => row.baseId === gatedAxe.entity.id)).toBe(false);

    const quality = result.baseQuality[0];
    const expectedMagicGate = 0.11 + 0.89 * (5 / 100);
    expect(quality.pBonus).toBeCloseTo(expectedMagicGate, 12);
    expect(quality.pMagic).toBeCloseTo(expectedMagicGate, 12);
    expect(quality.pUnique).toBe(0);
  });

  it('keeps allocation probabilities exact and applies them when both synthetic pools are nonempty', () => {
    const result = expectedDrop(profile, [sword], [prefix, suffix], [], 'normal');
    const quality = result.baseQuality[0];

    expect(result.affixes.allocation).toEqual(MAGIC_AFFIX_ALLOCATION);
    expect(MAGIC_AFFIX_ALLOCATION.prefixOnly).toBeCloseTo(5 / 24, 15);
    expect(MAGIC_AFFIX_ALLOCATION.suffixOnly).toBeCloseTo(5 / 8, 15);
    expect(MAGIC_AFFIX_ALLOCATION.both).toBeCloseTo(1 / 6, 15);
    expect(quality.affixes.prefixOnly).toBeCloseTo(quality.pBonus * 5 / 24, 12);
    expect(quality.affixes.suffixOnly).toBeCloseTo(quality.pBonus * 5 / 8, 12);
    expect(quality.affixes.both).toBeCloseTo(quality.pBonus / 6, 12);
  });

  it('uses the 2% unique check only when a compatible level-gated identity exists', () => {
    const unique = wrapper('d1-test-unique', 'items', 'items/unique_itemdat.tsv', {
      uniqueBaseItem: 'TEST_SWORD', minLevel: '4',
    });
    const result = expectedDrop(profile, [sword], [prefix, suffix], [unique], 'normal');
    const quality = result.baseQuality[0];

    expect(quality.pUnique).toBeCloseTo(quality.pBonus * 0.02, 12);
    expect(quality.pMagic).toBeCloseTo(quality.pBonus * 0.98, 12);
  });
});

describe('loot canon generation', () => {
  it('generates five concise laws with pinned source links and includes them in the Diablo canon', () => {
    expect(DIABLO1_LOOT_LAWS).toHaveLength(5);
    for (const law of DIABLO1_LOOT_LAWS) {
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    }
  });
});
