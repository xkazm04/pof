import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  expectedHealingPotionLife,
  expectedManaPotionMana,
  manaSustainArithmetic,
  simulateDescent,
  sustainArithmetic,
} from '@/lib/catalog/reference/descentSim';
import type { LocationEntityWrapper } from '@/lib/catalog/reference/locationSpecs';
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
  data: Record<string, unknown>,
  raw: Record<string, string> = {},
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

const graphics = ['unarmed', 'unarmedShield', 'sword', 'swordShield', 'bow', 'axe', 'mace', 'maceShield', 'staff'];
const animations = {
  attack: Object.fromEntries(graphics.map((graphic) => [graphic, { frames: 1, actionFrame: 1 }])),
  cast: { frames: 1, actionFrame: 1 },
  block: { frames: 1 },
  hitRecovery: { frames: 1 },
};

const warrior = wrapper('d1-class-warrior', 'characters', 'classes/warrior', {
  classFlags: [],
  baseStrength: 0,
  baseMagic: 0,
  baseDexterity: 0,
  baseVitality: 10,
  maxStrength: 250,
  maxMagic: 250,
  maxDexterity: 250,
  maxVitality: 250,
  blockBonus: 0,
  lifeAdjustment: 0,
  manaAdjustment: 0,
  lifePerLevel: 1,
  manaPerLevel: 0,
  lifePerBaseVitality: 1,
  manaPerBaseMagic: 0,
  lifePerItemVitality: 1,
  manaPerItemMagic: 0,
  baseMagicToHit: 0,
  baseMeleeToHit: 95,
  baseRangedToHit: 95,
  animations,
});

const sorcerer = wrapper('d1-class-sorcerer', 'characters', 'classes/sorcerer', {
  baseStrength: 0,
  baseMagic: 10,
  baseDexterity: 0,
  baseVitality: 10,
  maxStrength: 250,
  maxMagic: 250,
  maxDexterity: 250,
  maxVitality: 250,
  blockBonus: 0,
  lifeAdjustment: 0,
  manaAdjustment: 0,
  lifePerLevel: 1,
  manaPerLevel: 0,
  lifePerBaseVitality: 1,
  manaPerBaseMagic: 1,
  lifePerItemVitality: 1,
  manaPerItemMagic: 1,
  baseMagicToHit: 87,
  baseMeleeToHit: 0,
  baseRangedToHit: 0,
  animations,
});

const rogue = wrapper('d1-class-rogue', 'characters', 'classes/rogue', {
  classFlags: [],
  baseStrength: 0,
  baseMagic: 0,
  baseDexterity: 0,
  baseVitality: 10,
  maxStrength: 250,
  maxMagic: 250,
  maxDexterity: 250,
  maxVitality: 250,
  blockBonus: 0,
  lifeAdjustment: 0,
  manaAdjustment: 0,
  lifePerLevel: 1,
  manaPerLevel: 0,
  lifePerBaseVitality: 1,
  manaPerBaseMagic: 0,
  lifePerItemVitality: 1,
  manaPerItemMagic: 0,
  baseMagicToHit: 0,
  baseMeleeToHit: 0,
  baseRangedToHit: 95,
  animations,
});

const monster = wrapper('d1-test-monster', 'bestiary', 'monsters/monstdat.tsv', {
  category: 'demon',
  spawnDepth: { min: 1, max: 16 },
  stats: [
    { label: 'Level', value: 1 },
    { label: 'HP Min', value: 2 },
    { label: 'HP Max', value: 2 },
    { label: 'Armor Class', value: 0 },
    { label: 'To Hit', value: -100 },
    { label: 'Damage Min', value: 1 },
    { label: 'Damage Max', value: 1 },
    { label: 'XP', value: 10 },
  ],
}, {
  _monster_id: 'TEST',
  availability: 'Retail',
  minDunLvl: '1',
  maxDunLvl: '16',
  resistance: '',
});

const curve = [
  wrapper('curve-1', 'progression-curves', 'classes/Experience.tsv', { level: 1, experienceToReach: 20 }),
  wrapper('curve-2', 'progression-curves', 'classes/Experience.tsv', { level: 2, experienceToReach: 1_000 }),
  wrapper('curve-3', 'progression-curves', 'classes/Experience.tsv', { level: 3, experienceToReach: 10_000 }),
];

const expectedSword = wrapper('d1-expected-sword', 'items', 'items/itemdat.tsv', {
  subtype: 'Sword',
  requiredStrength: 0,
  requiredMagic: 0,
  requiredDexterity: 0,
  stats: [
    { label: 'Damage Min', value: 5 },
    { label: 'Damage Max', value: 8 },
  ],
}, {
  dropRate: '1',
  itemType: 'Sword',
  miscId: 'NONE',
  spell: 'Null',
  minMonsterLevel: '1',
  minDamage: '5',
  maxDamage: '8',
  minStrength: '0',
  minMagic: '0',
  minDexterity: '0',
  uniqueBaseItem: 'EXPECTED_SWORD',
});

const expectedBow = wrapper('d1-expected-bow', 'items', 'items/itemdat.tsv', {
  subtype: 'Bow',
  requiredStrength: 0,
  requiredMagic: 0,
  requiredDexterity: 0,
  stats: [
    { label: 'Damage Min', value: 3 },
    { label: 'Damage Max', value: 6 },
  ],
}, {
  dropRate: '1',
  itemType: 'Bow',
  miscId: 'NONE',
  spell: 'Null',
  minMonsterLevel: '1',
  minDamage: '3',
  maxDamage: '6',
  minStrength: '0',
  minMagic: '0',
  minDexterity: '0',
  uniqueBaseItem: 'EXPECTED_BOW',
});

const expectedDamagePrefix = wrapper('d1-expected-damage-prefix', 'affixes', 'items/item_prefixes.tsv', {}, {
  power: 'DAMP',
  'power.value1': '100',
  'power.value2': '100',
  minLevel: '1',
  itemTypes: 'Weapon',
  alignment: 'Any',
  chance: '1',
  useful: 'true',
});

const healingPotion = wrapper('d1-healing-potion', 'items', 'items/itemdat.tsv', {
  subtype: 'Misc',
  stats: [{ label: 'Value', value: 7 }],
}, {
  dropRate: '0',
  itemType: 'Misc',
  miscId: 'HEAL',
  spell: 'Null',
  minMonsterLevel: '0',
});

const manaPotion = wrapper('d1-mana-potion', 'items', 'items/itemdat.tsv', {
  subtype: 'Misc',
  stats: [{ label: 'Value', value: 5 }],
}, {
  dropRate: '0',
  itemType: 'Misc',
  miscId: 'MANA',
  spell: 'Null',
  minMonsterLevel: '0',
});

const firebolt = wrapper('d1-spell-firebolt', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'Firebolt',
  manaCost: '2',
  manaMultiplier: '1',
  minMana: '1',
});

const fireball = wrapper('d1-spell-fireball', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'Fireball',
  manaCost: '4',
  manaMultiplier: '1',
  minMana: '1',
});

const locations: LocationEntityWrapper[] = Array.from({ length: 16 }, (_, index) => {
  const depth = index + 1;
  return {
    catalogId: 'zone-map',
    entity: {
      id: `d1-level-${String(depth).padStart(2, '0')}`,
      catalogId: 'zone-map',
      name: `Level ${depth}`,
      categoryPath: [],
      lifecycle: 'planned',
      tags: ['diablo-location', 'dungeon'],
      links: [
        { catalogId: 'bestiary', entityId: monster.entity.id, role: 'spawns' },
        ...(depth === 1 ? [{ catalogId: 'bestiary', entityId: 'd1-test-unique', role: 'unique' }] : []),
      ],
      data: {
        kind: 'dungeon',
        dungeonType: depth <= 4 ? 'DTYPE_CATHEDRAL' : depth <= 8 ? 'DTYPE_CATACOMBS' : depth <= 12 ? 'DTYPE_CAVES' : 'DTYPE_HELL',
        depth,
        entry: 'fixture',
        procedural: 'fixture',
        poolSize: 1,
        notes: [],
      },
      provenance,
    },
  };
});

describe('simulateDescent', () => {
  it('computes a hand-checked two-kill floor and levels from the invented XP curve', () => {
    const result = simulateDescent({
      className: 'warrior',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      wrappers: [warrior, monster, ...curve],
      locations,
    });

    expect(result.model).toBe('deterministic-expectation');
    expect(result.levels).toHaveLength(16);
    expect(result.levels[0]).toMatchObject({
      depth: 1,
      poolSize: 1,
      expectedMonstersKilled: 2,
      expectedXpGained: 20,
      heroLevelBefore: 1,
      heroLevelAfter: 2,
    });
    // 1 HP needs one damaging hit; 95% hit chance and a 1-frame (0.05 s) swing.
    expect(result.levels[0].expectedSecondsToClear).toBeCloseTo(2 * (0.05 / 0.95), 10);
    // Hero attacks first: (1 / .95 - 1) counterattacks × .15 expected HP × two kills.
    expect(result.levels[0].expectedDamageTaken).toBeCloseTo(2 * ((1 / 0.95) - 1) * 0.15, 10);
    expect(result.levels[0].hardestMonster.byLowestHeroHitChance).toMatchObject({
      monsterId: monster.entity.id,
      value: 0.95,
    });
    expect(result.levels[0].note).toContain('1 eligible unique row');
    expect(result.levels[1]).toMatchObject({
      expectedXpGained: 18,
      heroLevelBefore: 2,
      heroLevelAfter: 2,
    });
  });

  it('uses and reports the named tile-count default instead of hiding it', () => {
    const result = simulateDescent({
      className: 'warrior',
      policy: 'balanced',
      gameMode: 'single',
      difficulty: 'normal',
      wrappers: [warrior, monster, ...curve],
      locations,
    });

    expect(result.levels[0].expectedMonstersKilled).toBe(Math.floor(DEFAULT_TILES_PER_LEVEL_ASSUMPTION / 30));
    expect(result.assumptions.find((item) => item.id === 'non-solid-tiles-per-level')).toMatchObject({
      value: DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
      source: expect.stringContaining('explicit caller assumption'),
    });
    expect(result.assumptions.find((item) => item.id === 'stat-point-policy')?.detail).toContain('round-robin');
  });

  it('keeps explicit gear:none byte-identical to the legacy omitted-gear path', () => {
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 60,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      wrappers: [warrior, monster, ...curve],
      locations,
    };
    const omitted = simulateDescent(input);
    const explicit = simulateDescent({ ...input, gear: 'none' });

    expect(JSON.stringify(explicit)).toBe(JSON.stringify(omitted));
    expect(Object.keys(explicit.levels[0])).toEqual([
      'depth',
      'poolSize',
      'expectedMonstersKilled',
      'expectedXpGained',
      'heroLevelBefore',
      'heroLevelAfter',
      'expectedSecondsToClear',
      'expectedDamageTaken',
      'hardestMonster',
      'note',
    ]);
  });

  it('uses accumulated first-depth kills to report and wield expected gear on the second depth', () => {
    const result = simulateDescent({
      className: 'warrior',
      policy: 'none',
      tilesPerLevel: 600,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'expected',
      wrappers: [warrior, monster, expectedSword, expectedDamagePrefix, healingPotion, ...curve],
      locations,
    });

    expect(result.gear).toBe('expected');
    expect(result.levels[0].weaponAssumed).toMatchObject({
      killsSoFar: 0,
      weaponId: null,
      damage: { min: 1, max: 1 },
      damageBonusPercent: 0,
    });
    expect(result.levels[1].weaponAssumed).toMatchObject({
      killsSoFar: 20,
      weaponId: expectedSword.entity.id,
      damage: { min: 4, max: 7 },
      damageBonusPercent: 9,
    });
    expect(result.assumptions.some((assumption) => assumption.id === 'expected-loot-weapon')).toBe(true);
    expect(result.levels[0].armourAssumed).toMatchObject({ totalArmourClass: 0, hasShield: false });
    expect(result.levels[0].sustain).toMatchObject({
      healingPotionPrice: 7,
      healingPotionsBought: 0,
      sustainable: true,
      deficit: 0,
    });
  });

  it('uses ranged mode and the expected best bow for the Rogue', () => {
    const result = simulateDescent({
      className: 'rogue',
      policy: 'none',
      tilesPerLevel: 600,
      gameMode: 'single',
      difficulty: 'normal',
      wrappers: [rogue, monster, expectedBow, healingPotion, ...curve],
      locations,
    });

    expect(result.gear).toBe('expected');
    expect(result.attackMode).toBe('ranged');
    expect(result.levels[0].attackMode).toBe('ranged');
    expect(result.levels[1].weaponAssumed).toMatchObject({
      model: 'conservative-expected-best-ranged-base',
      weaponId: expectedBow.entity.id,
      weaponType: 'bow',
    });
    expect(result.assumptions.find((assumption) => assumption.id === 'ranged-engagement-distance')).toMatchObject({ value: 4 });
  });

  it('uses Sorcerer spell bands and carries mana without passive regeneration', () => {
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      wrappers: [sorcerer, monster, firebolt, fireball, ...curve],
      locations,
    });

    expect(result.attackMode).toBe('spell');
    expect(result.levels[0].attackMode).toBe('spell');
    expect(result.levels[0].spellAssumed).toMatchObject({ spell: 'Firebolt', spellLevel: 1, manaPerCast: 2 });
    expect(result.levels[0].mana).toMatchObject({ currentManaAtStart: 10, manaPool: 10, sustainable: true });
    expect(result.levels[0].mana!.expectedManaSpent).toBeCloseTo(2 * 2 / 0.95, 12);
    // The depth-1 level-up refills before depth 2; no later level-up occurs, so depth 3 carries the remainder.
    expect(result.levels[1].mana!.currentManaAtStart).toBe(10);
    expect(result.levels[2].mana!.currentManaAtStart).toBeCloseTo(10 - 2 * 2 / 0.95, 12);
    expect(result.levels[8].spellAssumed).toMatchObject({ spell: 'Fireball', spellLevel: 1 });
    expect(result.assumptions.find((assumption) => assumption.id === 'mana-recovery')?.detail).toContain('Shrines are ignored');
  });

  it('splits prior-depth gold for mana potions and makes overall sustain require mana', () => {
    const expensiveFirebolt = wrapper('d1-spell-firebolt-expensive', 'spellbook', 'spells/spelldat.tsv', {}, {
      id: 'Firebolt', manaCost: '100', manaMultiplier: '1', minMana: '1',
    });
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      wrappers: [
        sorcerer, monster, expensiveFirebolt, fireball, expectedSword, expectedDamagePrefix,
        healingPotion, manaPotion, ...curve,
      ],
      locations,
    });

    expect(result.levels[0].sustain).toMatchObject({ deficit: 0, sustainable: false });
    expect(result.levels[0].mana).toMatchObject({ manaPotionPrice: 5, sustainable: false });
    expect(result.levels[1].mana!.expectedGoldAllocated).toBeCloseTo(result.levels[0].sustain!.expectedGoldDropped * 0.5, 12);
    expect(result.levels[1].mana!.manaPotionsBought).toBeCloseTo(result.levels[1].mana!.expectedGoldAllocated / 5, 12);
  });
});

describe('sustain arithmetic', () => {
  it('adds life and both potion supplies, then reports the exact deficit', () => {
    expect(expectedHealingPotionLife('warrior', 40)).toBe(19);
    expect(sustainArithmetic({
      expectedDamageTaken: 101,
      lifePool: 40,
      healingPotions: 2,
      fullHealingPotions: 0.5,
      lifeRestoredPerHealingPotion: 10,
    })).toEqual({ healingSupply: 40, sustainable: false, deficit: 21 });
  });

  it('adds carried mana and both mana potion supplies, then reports the exact deficit', () => {
    expect(expectedManaPotionMana('sorcerer', 40)).toBe(19);
    expect(manaSustainArithmetic({
      expectedManaSpent: 101,
      currentMana: 40,
      manaPool: 40,
      manaPotions: 2,
      fullManaPotions: 0.5,
      manaRestoredPerPotion: 10,
    })).toEqual({ potionManaSupply: 40, totalManaAvailable: 80, sustainable: false, deficit: 21 });
  });
});
