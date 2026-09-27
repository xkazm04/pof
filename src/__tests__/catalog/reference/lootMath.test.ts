import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import {
  MAGIC_AFFIX_ALLOCATION,
  bestArmourExpectation,
  bestDefensiveAffixExpectation,
  bestWeaponExpectation,
  expectedDrop,
  expectedSaleValue,
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
const bow = wrapper('d1-test-bow', 'items', 'items/itemdat.tsv', {
  dropRate: '2', itemType: 'Bow', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
  uniqueBaseItem: 'TEST_BOW', minDamage: '3', maxDamage: '6', minStrength: '0', minMagic: '0', minDexterity: '0',
}, { subtype: 'Bow' });
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

describe('expectedSaleValue', () => {
  it('hand-computes quarter-value sales, kept items, and the one-trip capacity', () => {
    expect(expectedSaleValue([
      { baseId: 'valuable', expectedCount: 2, baseValue: 40, keptCount: 0.5 },
      { baseId: 'cheap', expectedCount: 3, baseValue: 9 },
    ], 2)).toEqual({
      expectedItemsDropped: 5,
      expectedItemsKept: 0.5,
      expectedItemsCarried: 2,
      expectedItemsLeftBehind: 2.5,
      expectedGold: 16,
    });
  });

  it('applies the engine one-gold minimum after integer quartering', () => {
    expect(expectedSaleValue([
      { baseId: 'worthless', expectedCount: 1.25, baseValue: 0 },
    ], 2).expectedGold).toBe(1.25);
  });
});

describe('bestArmourExpectation', () => {
  it('selects each armour slot by hand-computed maximum probabilities and rejects a requirement-gated body', () => {
    const body = wrapper('d1-test-body', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'LightArmor', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'TEST_BODY', minArmor: '9', maxArmor: '9', minStrength: '10', minMagic: '0', minDexterity: '0',
    });
    const gatedBody = wrapper('d1-gated-body', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'HeavyArmor', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'GATED_BODY', minArmor: '50', maxArmor: '50', minStrength: '11', minMagic: '0', minDexterity: '0',
    });
    const helm = wrapper('d1-test-helm', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'Helm', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'TEST_HELM', minArmor: '6', maxArmor: '6', minStrength: '0', minMagic: '0', minDexterity: '0',
    });
    const shield = wrapper('d1-test-shield', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'Shield', minMonsterLevel: '1', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'TEST_SHIELD', minArmor: '3', maxArmor: '3', minStrength: '0', minMagic: '0', minDexterity: '0',
    });
    const result = bestArmourExpectation({
      className: 'Warrior',
      depth: 2,
      killsSoFar: 2,
      monsterProfiles: [{ profile: { ...profile, unique: true }, weight: 2 }],
      itemWrappers: [body, gatedBody, helm, shield],
      affixWrappers: [],
      uniqueItemWrappers: [],
      difficulty: 'normal',
      strength: 10,
      magic: 0,
      dexterity: 0,
      shieldAllowed: true,
    });

    // Each usable slot base has p=1/4 per named-monster kill, hence P(found by two kills)=7/16.
    expect(result.slots.body).toMatchObject({ itemId: body.entity.id, armourRange: { min: 3, max: 3 }, armourClass: 3 });
    expect(result.slots.body.maxBaseArmourDistribution[0].p).toBeCloseTo(7 / 16, 12);
    expect(result.slots.body.maxBaseArmourDistribution.flatMap((row) => row.baseIds)).not.toContain(gatedBody.entity.id);
    expect(result.slots.helm.armourClass).toBe(Math.floor(6 * 7 / 16));
    expect(result.slots.shield.armourClass).toBe(Math.floor(3 * 7 / 16));
    expect(result.totalArmourClass).toBe(6);
    expect(result.hasShield).toBe(true);
  });
});

describe('bestDefensiveAffixExpectation', () => {
  it('floors invented per-ring resistance order statistics and the expected best recovery tier', () => {
    const ring = wrapper('invented-ring', 'items', 'items/itemdat.tsv', {
      dropRate: '1', itemType: 'Ring', minMonsterLevel: '1', miscId: 'RING', spell: 'Null',
      minStrength: '0', minMagic: '0', minDexterity: '0',
    });
    const allResistance = wrapper('invented-all-resistance', 'affixes', 'items/item_prefixes.tsv', {
      power: 'ALLRES', 'power.value1': '10', 'power.value2': '10', minLevel: '4', itemTypes: 'Misc',
      alignment: 'Any', chance: '1', useful: 'true',
    });
    const recovery = wrapper('invented-recovery', 'affixes', 'items/item_suffixes.tsv', {
      power: 'FASTRECOVER', 'power.value1': '2', 'power.value2': '2', minLevel: '4', itemTypes: 'Misc',
      alignment: 'Any', chance: '1', useful: 'true',
    });
    const result = bestDefensiveAffixExpectation({
      depth: 2,
      killsSoFar: 2,
      monsterProfiles: [{ profile: { ...profile, unique: true }, weight: 2 }],
      itemWrappers: [ring],
      affixWrappers: [allResistance, recovery],
      uniqueItemWrappers: [],
      difficulty: 'normal',
    });

    // A prefix is requested with probability 5/24 + 1/6 = 3/8 on each independent kill.
    expect(result.slotResistances.ring1).toEqual({ magic: 6, fire: 6, lightning: 6 });
    expect(result.slotResistances.ring2).toEqual({ magic: 1, fire: 1, lightning: 1 });
    expect(result.resistances).toEqual({ magic: 7, fire: 7, lightning: 7 });
    // Recovery appears with probability 5/8 + 1/6 = 19/24. Its two-frame expected maximum
    // over two kills is still below two after flooring, so the conservative tier is Fast.
    expect(result.expectedHitRecoverySkippedFrames).toBe(1);
    expect(result.hitRecoveryTier).toBe('fast');
  });
});

describe('bestWeaponExpectation', () => {
  it('retains an owned staff when the expected wieldable drop pool has no better base', () => {
    const staff = wrapper('d1-starting-staff', 'items', 'items/itemdat.tsv', {
      dropRate: '0', itemType: 'Staff', minMonsterLevel: '0', miscId: 'NONE', spell: 'Firebolt',
      uniqueBaseItem: 'STARTING_STAFF', minDamage: '3', maxDamage: '6', minStrength: '0', minMagic: '0', minDexterity: '0',
    }, { subtype: 'Staff' });
    const result = bestWeaponExpectation({
      class: 'Sorcerer',
      depth: 2,
      killsSoFar: 10,
      monsterProfiles: [{ profile: { ...profile, unique: true }, weight: 10 }],
      itemWrappers: [sword],
      affixWrappers: [],
      uniqueItemWrappers: [],
      difficulty: 'normal',
      strength: 100,
      magic: 100,
      dexterity: 100,
      fallbackWeapon: staff,
    });

    expect(result).toMatchObject({
      weaponId: staff.entity.id,
      weaponType: 'staff',
      damage: { min: 3, max: 6 },
      pWeaponFound: 0,
    });
  });

  it('restricts the Rogue expected weapon pool to bows', () => {
    const result = bestWeaponExpectation({
      class: 'Rogue',
      depth: 2,
      killsSoFar: 10,
      monsterProfiles: [{ profile: { ...profile, unique: true }, weight: 10 }],
      itemWrappers: [sword, bow],
      affixWrappers: [],
      uniqueItemWrappers: [],
      difficulty: 'normal',
      strength: 100,
      magic: 100,
      dexterity: 100,
    });

    expect(result.model).toBe('conservative-expected-best-ranged-base');
    expect(result.weaponId).toBe(bow.entity.id);
    expect(result.weaponType).toBe('bow');
    expect(result.maxBaseDamageDistribution.flatMap((row) => row.baseIds)).toEqual([bow.entity.id]);
  });
});

describe('loot canon generation', () => {
  it('generates concise laws with pinned source links and includes them in the Diablo canon', () => {
    expect(DIABLO1_LOOT_LAWS).toHaveLength(6);
    for (const law of DIABLO1_LOOT_LAWS) {
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    }
  });
});
