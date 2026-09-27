import { describe, expect, it } from 'vitest';
import {
  allocateMixedSpellKills,
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  expectedHealingPotionLife,
  expectedManaPotionMana,
  manaSustainArithmetic,
  simulateDescent,
  simulateDifficultyChain,
  sustainArithmetic,
  type DescentInitialState,
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

const arrowMissile = wrapper('d1-missile-arrow', 'vfx', 'missiles/misdat.tsv', {
  damageType: 'Physical',
  arrow: true,
}, { id: 'Arrow' });

const magmaBallMissile = wrapper('d1-missile-magma-ball', 'vfx', 'missiles/misdat.tsv', {
  damageType: 'Fire',
}, { id: 'MagmaBall' });

const acidMissile = wrapper('d1-missile-acid', 'vfx', 'missiles/misdat.tsv', {
  damageType: 'Acid',
}, { id: 'Acid' });

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
  startingLoadout: { itemIds: ['IDI_SORC'] },
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
  derived: {
    attackKinds: ['melee'],
    tilesPerSecond: 2,
    locomotion: { tilesPerSecondWhileWalking: 3 },
  },
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
  class: 'Weapon',
  value: '40',
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
  class: 'Weapon',
  value: '32',
});

const startingStaff = wrapper('d1-IDI_SORC', 'items', 'items/itemdat.tsv', {
  id: 'IDI_SORC',
  subtype: 'Staff',
  requiredStrength: 0,
  requiredMagic: 0,
  requiredDexterity: 0,
  stats: [
    { label: 'Damage Min', value: 2 },
    { label: 'Damage Max', value: 2 },
  ],
}, {
  id: 'IDI_SORC',
  dropRate: '0',
  itemType: 'Staff',
  equipType: 'Two-handed',
  miscId: 'NONE',
  spell: 'Firebolt',
  minMonsterLevel: '0',
  minDamage: '2',
  maxDamage: '2',
  minStrength: '0',
  minMagic: '0',
  minDexterity: '0',
  uniqueBaseItem: 'STARTING_STAFF',
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

const expectedRing = wrapper('d1-expected-ring', 'items', 'items/itemdat.tsv', {
  subtype: 'Ring',
  requiredStrength: 0,
  requiredMagic: 0,
  requiredDexterity: 0,
  stats: [{ label: 'Value', value: 20 }],
}, {
  dropRate: '1',
  itemType: 'Ring',
  equipType: 'Ring',
  miscId: 'RING',
  spell: 'Null',
  minMonsterLevel: '1',
  minStrength: '0',
  minMagic: '0',
  minDexterity: '0',
  uniqueBaseItem: 'EXPECTED_RING',
  class: 'Misc',
  value: '20',
});

const expectedAllResistance = wrapper('d1-expected-all-resistance', 'affixes', 'items/item_prefixes.tsv', {}, {
  power: 'ALLRES',
  'power.value1': '50',
  'power.value2': '50',
  minLevel: '1',
  itemTypes: 'Misc',
  alignment: 'Any',
  chance: '1',
  useful: 'true',
});

const expectedFastRecovery = wrapper('d1-expected-fast-recovery', 'affixes', 'items/item_suffixes.tsv', {}, {
  power: 'FASTRECOVER',
  'power.value1': '3',
  'power.value2': '3',
  minLevel: '1',
  itemTypes: 'Misc',
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

const chargedBolt = wrapper('d1-spell-charged-bolt', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'ChargedBolt',
  manaCost: '2',
  manaMultiplier: '1',
  minMana: '1',
});

const lightning = wrapper('d1-spell-lightning', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'Lightning',
  manaCost: '3',
  manaMultiplier: '1',
  minMana: '1',
});

const fireball = wrapper('d1-spell-fireball', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'Fireball',
  manaCost: '4',
  manaMultiplier: '1',
  minMana: '1',
});

const chainLightning = wrapper('d1-spell-chain-lightning', 'spellbook', 'spells/spelldat.tsv', {}, {
  id: 'ChainLightning',
  manaCost: '4',
  manaMultiplier: '1',
  minMana: '1',
});

const learnedSpellRows = [firebolt, chargedBolt, lightning, fireball, chainLightning];

function locationsFor(...monsters: ReferenceWrapper[]): LocationEntityWrapper[] {
  return Array.from({ length: 16 }, (_, index) => {
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
          ...monsters.map((entry) => ({ catalogId: 'bestiary', entityId: entry.entity.id, role: 'spawns' })),
          ...(depth === 1 ? [{ catalogId: 'bestiary', entityId: 'd1-test-unique', role: 'unique' }] : []),
        ],
        data: {
          kind: 'dungeon',
          dungeonType: depth <= 4 ? 'DTYPE_CATHEDRAL' : depth <= 8 ? 'DTYPE_CATACOMBS' : depth <= 12 ? 'DTYPE_CAVES' : 'DTYPE_HELL',
          depth,
          entry: 'fixture',
          procedural: 'fixture',
          poolSize: monsters.length,
          notes: [],
        },
        provenance,
      },
    };
  });
}

const locations = locationsFor(monster);

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
    const explicitDuel = simulateDescent({ ...input, encounter: 'duel', adjacentSlots: 2 });
    const explicitNoDefence = simulateDescent({ ...input, defensiveAffixes: 'none' });
    const explicitNoPurchases = simulateDescent({ ...input, purchases: 'none' });

    expect(JSON.stringify(explicit)).toBe(JSON.stringify(omitted));
    expect(JSON.stringify(explicitDuel)).toBe(JSON.stringify(omitted));
    expect(JSON.stringify(explicitNoDefence)).toBe(JSON.stringify(omitted));
    expect(JSON.stringify(explicitNoPurchases)).toBe(JSON.stringify(omitted));
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

  it('buys an affordable store armour offer and changes the defensive quantity it targets', () => {
    const hardHittingMonster = {
      ...monster,
      entity: {
        ...monster.entity,
        data: {
          ...monster.entity.data,
          stats: (monster.entity.data.stats as { label: string; value: number }[]).map((stat) => {
            if (stat.label === 'HP Min' || stat.label === 'HP Max') return { ...stat, value: 20 };
            if (stat.label === 'To Hit') return { ...stat, value: 20 };
            if (stat.label === 'Damage Min' || stat.label === 'Damage Max') return { ...stat, value: 5 };
            return stat;
          }),
        },
      },
    } satisfies ReferenceWrapper;
    const storeBody = wrapper('invented-store-body', 'items', 'items/itemdat.tsv', {
      subtype: 'LightArmor',
      requiredStrength: 0,
      requiredMagic: 0,
      requiredDexterity: 0,
      stats: [
        { label: 'Armor Min', value: 20 },
        { label: 'Armor Max', value: 20 },
        { label: 'Value', value: 100 },
      ],
    }, {
      dropRate: '1', itemType: 'LightArmor', minMonsterLevel: '1', minArmor: '20', maxArmor: '20',
      minStrength: '0', minMagic: '0', minDexterity: '0', value: '100', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'INVENTED_BODY',
    });
    const initialState: DescentInitialState = {
      className: 'warrior',
      level: 1,
      totalExperience: 0,
      strength: 0,
      magic: 0,
      dexterity: 0,
      vitality: 10,
      unspentStatPoints: 0,
      balancedAllocationCursor: 0,
      currentLife: 10,
      maximumLife: 10,
      currentMana: 0,
      maximumMana: 0,
      learnedSpells: [],
      gold: 500,
      potions: { healing: 0, fullHealing: 0, mana: 0, fullMana: 0 },
      diabloKillRank: 0,
      completedDifficulties: [],
    };
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 30,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      gear: 'expected' as const,
      initialState,
      wrappers: [warrior, hardHittingMonster, storeBody, healingPotion, ...curve],
      locations: locationsFor(hardHittingMonster),
    };
    const none = simulateDescent(input);
    const bought = simulateDescent({ ...input, purchases: 'defence' });

    expect(bought.purchases).toBe('defence');
    expect(bought.levels[0].defencePurchases?.bought).toContainEqual(expect.objectContaining({
      store: 'griswold-basic', equipmentSlot: 'body', target: 'armour', expectedPrice: 100,
    }));
    expect(bought.levels[0].defencePurchases?.resultingArmourClass).toBeGreaterThan(0);
    expect(none.levels[0].armourAssumed?.totalArmourClass).toBe(0);
    expect(bought.levels[0].expectedDamageTaken!).toBeLessThan(none.levels[0].expectedDamageTaken!);
    expect(bought.levels[0].defencePurchases?.expectedDamageTakenWithoutPurchases)
      .toBeCloseTo(none.levels[0].expectedDamageTaken!, 12);
    expect(bought.finalState.purchasedDefence?.slots.body).toBeDefined();

    const chain = simulateDifficultyChain({
      className: input.className,
      policy: input.policy,
      tilesPerLevel: input.tilesPerLevel,
      gameMode: input.gameMode,
      gear: input.gear,
      purchases: 'defence',
      initialHeroState: initialState,
      difficulties: ['normal', 'nightmare'],
      wrappers: input.wrappers,
      locations: input.locations,
    });
    expect(chain.legs[0].finalState.purchasedDefence?.slots.body).toBeDefined();
    expect(chain.legs[1].initialState.purchasedDefence)
      .toBe(chain.legs[0].finalState.purchasedDefence);

    const storeUpgrade = wrapper('invented-store-upgrade', 'items', 'items/itemdat.tsv', {
      subtype: 'LightArmor',
      requiredStrength: 0,
      requiredMagic: 0,
      requiredDexterity: 0,
      stats: [
        { label: 'Armor Min', value: 40 },
        { label: 'Armor Max', value: 40 },
        { label: 'Value', value: 200 },
      ],
    }, {
      dropRate: '1', itemType: 'LightArmor', minMonsterLevel: '7', minArmor: '40', maxArmor: '40',
      minStrength: '0', minMagic: '0', minDexterity: '0', value: '200', miscId: 'NONE', spell: 'Null',
      uniqueBaseItem: 'INVENTED_UPGRADE',
    });
    const upgraded = simulateDescent({
      ...input,
      gear: 'expected',
      purchases: 'defence',
      initialState: { ...initialState, gold: 5_000 },
      wrappers: [warrior, hardHittingMonster, storeBody, storeUpgrade, healingPotion, ...curve],
    });
    const bodyPurchases = upgraded.levels.flatMap((level) => level.defencePurchases?.bought ?? [])
      .filter((purchase) => purchase.equipmentSlot === 'body');
    expect(bodyPurchases.length).toBeGreaterThan(1);
    expect(bodyPurchases.some((purchase) => purchase.saleCredit > 0
      && purchase.netPrice < purchase.expectedPrice)).toBe(true);
  });

  it('keeps a single explicit fresh initial state byte-identical to the default start', () => {
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 60,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      wrappers: [warrior, monster, ...curve],
      locations,
    };
    const initialState: DescentInitialState = {
      className: 'warrior',
      level: 1,
      totalExperience: 0,
      strength: 0,
      magic: 0,
      dexterity: 0,
      vitality: 10,
      unspentStatPoints: 0,
      balancedAllocationCursor: 0,
      currentLife: 10,
      maximumLife: 10,
      currentMana: 0,
      maximumMana: 0,
      learnedSpells: [],
      gold: 0,
      potions: { healing: 0, fullHealing: 0, mana: 0, fullMana: 0 },
      diabloKillRank: 0,
      completedDifficulties: [],
    };

    const defaultStart = simulateDescent(input);
    const explicitStart = simulateDescent({ ...input, initialState });

    expect(JSON.stringify(explicitStart)).toBe(JSON.stringify(defaultStart));
    expect(Object.keys(defaultStart)).not.toContain('finalState');
    expect(defaultStart.finalState).toMatchObject({ level: 2, totalExperience: 290, gold: 0 });
  });

  it('carries invented level, XP, and gold exactly through a two-leg chain', () => {
    const initialHeroState: DescentInitialState = {
      className: 'warrior',
      level: 2,
      totalExperience: 123,
      strength: 2,
      magic: 3,
      dexterity: 4,
      vitality: 10,
      unspentStatPoints: 9,
      balancedAllocationCursor: 2,
      currentLife: 7,
      maximumLife: 11,
      currentMana: 0,
      maximumMana: 0,
      learnedSpells: [],
      gold: 456,
      potions: { healing: 1.5, fullHealing: 0.25, mana: 2.5, fullMana: 0.5 },
      diabloKillRank: 0,
      completedDifficulties: [],
    };
    const result = simulateDifficultyChain({
      className: 'warrior',
      policy: 'none',
      tilesPerLevel: 0,
      gameMode: 'single',
      gear: 'none',
      difficulties: ['normal', 'nightmare'],
      initialHeroState,
      wrappers: [warrior, monster, ...curve],
      locations,
    });

    expect(result.legs).toHaveLength(2);
    expect(result.legs[0].initialState).toBe(initialHeroState);
    expect(result.legs[0].finalState).toMatchObject({
      level: 2,
      totalExperience: 123,
      gold: 456,
      diabloKillRank: 1,
      completedDifficulties: ['normal'],
    });
    expect(result.legs[1].initialState).toBe(result.legs[0].finalState);
    expect(result.legs[1].precedingLegCompleted).toBe(true);
    expect(result.finalState).toMatchObject({
      level: 2,
      totalExperience: 123,
      gold: 456,
      diabloKillRank: 2,
      completedDifficulties: ['normal', 'nightmare'],
    });
    expect(result.summary.legs).toEqual([
      { difficulty: 'normal', levelAtEnd: 2, firstUnsustainableDepth: null },
      { difficulty: 'nightmare', levelAtEnd: 2, firstUnsustainableDepth: null },
    ]);
  });

  it('reports opt-in pack placement, simultaneous damage, interruptions, and sustainability', () => {
    const result = simulateDescent({
      className: 'warrior',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      encounter: 'packs',
      adjacentSlots: 8,
      wrappers: [warrior, monster, ...curve],
      locations,
    });

    expect(result).toMatchObject({ encounter: 'packs', adjacentSlots: 8 });
    expect(result.levels[0].pack).toMatchObject({
      adjacentSlots: 8,
      expectedPackSize: 1,
      expectedPacks: 2,
      sustainable: true,
      typePackSizes: [{ monsterId: monster.entity.id, expectedPackSize: 1 }],
      eligibleUniquePacks: [{ monsterId: 'd1-test-unique', requestedPackSize: null }],
    });
    expect(result.levels[0].pack!.damageMultiplierVsDuel).toBeGreaterThan(1);
    expect(result.levels[0].pack!.expectedGotHitInterruptions).toBeGreaterThan(0);
    expect(result.levels[1].pack).toMatchObject({ expectedPackSize: 1.75, expectedPacks: 2 / 1.75 });
    expect(result.assumptions.find((item) => item.id === 'adjacent-slots')).toMatchObject({ value: 8 });
  });

  it('applies invented expected resistance and hit recovery to pack combat from the next depth', () => {
    const defensiveWarrior = {
      ...warrior,
      entity: {
        ...warrior.entity,
        data: {
          ...warrior.entity.data,
          animations: {
            ...animations,
            attack: Object.fromEntries(graphics.map((graphic) => [graphic, { frames: 10, actionFrame: 1 }])),
            hitRecovery: { frames: 4 },
          },
        },
      },
    } satisfies ReferenceWrapper;
    const magicMonster = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:MAGIC',
      key: 'MAGIC',
      rawHash: 'MAGIC',
      raw: { ...monster.raw, _monster_id: 'MAGIC' },
      entity: {
        ...monster.entity,
        id: 'd1-magic-monster',
        name: 'Magic Monster',
        tags: ['AcidUnique'],
        data: {
          ...monster.entity.data,
          derived: {
            attackKinds: ['missile'],
            tilesPerSecond: 2,
            locomotion: { tilesPerSecondWhileWalking: 3 },
          },
          stats: (monster.entity.data.stats as { label: string; value: number }[]).map((stat) =>
            stat.label === 'HP Min' || stat.label === 'HP Max'
              ? { ...stat, value: 40 }
              : stat.label === 'Damage Min' || stat.label === 'Damage Max'
                ? { ...stat, value: 20 }
                : stat),
        },
      },
    } satisfies ReferenceWrapper;
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 3_000,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      gear: 'expected' as const,
      encounter: 'packs' as const,
      adjacentSlots: 8,
      wrappers: [
        defensiveWarrior, magicMonster, acidMissile, expectedSword, expectedRing, expectedDamagePrefix,
        expectedAllResistance, expectedFastRecovery, healingPotion, ...curve,
      ],
      locations: locationsFor(magicMonster),
    };
    const none = simulateDescent(input);
    const explicitNone = simulateDescent({ ...input, defensiveAffixes: 'none' });
    const result = simulateDescent({ ...input, defensiveAffixes: 'expected' });

    expect(JSON.stringify(explicitNone)).toBe(JSON.stringify(none));
    expect(result.defensiveAffixes).toBe('expected');
    expect(result.levels[0].defensiveAffixesAssumed).toMatchObject({
      resistances: { magic: 0, fire: 0, lightning: 0 },
      hitRecoveryTier: 'none',
    });
    expect(result.levels[1].defensiveAffixesAssumed).toMatchObject({
      resistances: { magic: 72, fire: 72, lightning: 72 },
      expectedHitRecoverySkippedFrames: 2,
      hitRecoveryTier: 'faster',
    });
    expect(result.levels[1].expectedDamageTaken!).toBeLessThan(none.levels[1].expectedDamageTaken!);
    expect(result.levels[1].expectedSecondsToClear!).toBeLessThan(none.levels[1].expectedSecondsToClear!);
    expect(result.assumptions.some((assumption) => assumption.id === 'expected-loot-defensive-affixes')).toBe(true);
  });

  it('keeps hybrid missile routines on their melee exchange beside a melee hero', () => {
    const hybridMonster = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:HYBRID',
      key: 'HYBRID',
      rawHash: 'HYBRID',
      raw: { ...monster.raw, _monster_id: 'HYBRID' },
      entity: {
        ...monster.entity,
        id: 'd1-hybrid-monster',
        name: 'Hybrid Monster',
        tags: ['Magma'],
        data: {
          ...monster.entity.data,
          stats: (monster.entity.data.stats as { label: string; value: number }[]).map((stat) =>
            stat.label === 'HP Min' || stat.label === 'HP Max'
              ? { ...stat, value: 40 }
              : stat.label === 'Damage Min' || stat.label === 'Damage Max'
                ? { ...stat, value: 20 }
                : stat),
        },
      },
    } satisfies ReferenceWrapper;
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 3_000,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      gear: 'expected' as const,
      encounter: 'duel' as const,
      wrappers: [
        warrior, hybridMonster, magmaBallMissile, expectedSword, expectedRing, expectedDamagePrefix,
        expectedAllResistance, healingPotion, ...curve,
      ],
      locations: locationsFor(hybridMonster),
    };
    const none = simulateDescent({ ...input, defensiveAffixes: 'none' });
    const expected = simulateDescent({ ...input, defensiveAffixes: 'expected' });

    expect(expected.levels[1].expectedDamageTaken).toBeCloseTo(none.levels[1].expectedDamageTaken!, 12);
    expect(expected.assumptions.find((assumption) => assumption.id === 'ranged-monster-exchange')?.detail)
      .toContain('Magma, Bat, Storm, Acid, Mega, and Diablo');
  });

  it('keeps explicit monster-gold byte-identical to the omitted income policy', () => {
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 600,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      gear: 'expected' as const,
      wrappers: [warrior, monster, expectedSword, expectedDamagePrefix, healingPotion, ...curve],
      locations,
    };

    expect(JSON.stringify(simulateDescent({ ...input, sustainIncome: 'monster-gold' })))
      .toBe(JSON.stringify(simulateDescent(input)));
    expect(JSON.stringify(simulateDescent({ ...input, saleIdentify: 'never' })))
      .toBe(JSON.stringify(simulateDescent(input)));
  });

  it('adds unidentified sales to next-depth sustain and reports derived faucet/sink rates', () => {
    const result = simulateDescent({
      className: 'warrior',
      policy: 'none',
      tilesPerLevel: 600,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'expected',
      sustainIncome: 'gold-and-sales',
      saleItemsPerTrip: 2,
      wrappers: [warrior, monster, expectedSword, expectedDamagePrefix, healingPotion, ...curve],
      locations,
    });

    expect(result.goldFlow).toBeDefined();
    expect(result.goldFlow!.levels[0].sales).toMatchObject({
      expectedItemsKept: 1,
      expectedItemsCarried: 0.1066 * 20 - 1,
      expectedGold: (0.1066 * 20 - 1) * 10,
    });
    expect(result.goldFlow!.levels[0].faucets.sales).toBeCloseTo((0.1066 * 20 - 1) * 10, 12);
    expect(result.levels[0].sustain!.expectedGoldIncome).toBeCloseTo(
      result.goldFlow!.levels[0].faucets.total,
      12,
    );
    expect(result.goldFlow!.levels[1].sinks.potionsBought).toBeCloseTo(
      result.goldFlow!.levels[0].faucets.total,
      12,
    );
    expect(result.goldFlow!.levels[0].sinks).toMatchObject({ identify: 0, repair: 0 });
    expect(result.goldFlow!.levels[0].perHour!.faucets.total).toBeCloseTo(
      result.goldFlow!.levels[0].faucets.total / result.goldFlow!.levels[0].clearHours!,
      12,
    );
    expect(result.assumptions.find((assumption) => assumption.id === 'sale-carry-capacity')?.value)
      .toBe('2 items per depth');
  });

  it('changes sale income when profitable Magic drops are identified', () => {
    const profitablePrefix = wrapper('invented-profitable-prefix', 'affixes', 'items/item_prefixes.tsv', {}, {
      power: 'DAMP',
      'power.value1': '1',
      'power.value2': '1',
      minLevel: '1',
      itemTypes: 'Weapon',
      alignment: 'Any',
      chance: '1',
      useful: 'true',
      minVal: '0',
      maxVal: '0',
      multVal: '20',
    });
    const input = {
      className: 'warrior' as const,
      policy: 'none' as const,
      tilesPerLevel: 600,
      gameMode: 'single' as const,
      difficulty: 'normal' as const,
      gear: 'expected' as const,
      sustainIncome: 'gold-and-sales' as const,
      saleItemsPerTrip: 2,
      wrappers: [warrior, monster, expectedSword, profitablePrefix, healingPotion, ...curve],
      locations,
    };
    const unidentified = simulateDescent(input);
    const identified = simulateDescent({ ...input, saleIdentify: 'when-profitable' });
    const first = identified.goldFlow!.levels[0];

    expect(first.sales.expectedItemsIdentified).toBeGreaterThan(0);
    expect(first.sinks.identify).toBe(first.sales.expectedIdentifyFees);
    expect(first.sales.unidentifiedPolicyExpectedGold)
      .toBeCloseTo(unidentified.goldFlow!.levels[0].faucets.sales, 12);
    expect(first.faucets.sales).toBeGreaterThan(unidentified.goldFlow!.levels[0].faucets.sales);
    expect(first.sales.expectedNetGoldGainVsUnidentified).toBeGreaterThan(0);
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
    expect(result.finalState.expectedGear!.dropHistory[0].drop).toBeDefined();
    expect(JSON.stringify(result.finalState.expectedGear)).not.toContain('"drop"');
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
    expect(result.levels[0].approach).toMatchObject({
      freeShotShare: 1,
      monsterSpeeds: [{ monsterId: monster.entity.id, source: 'effective-routine-cadence' }],
    });
  });

  it('keeps the pure-spell comparison output and carries mana without passive regeneration', () => {
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      sorcererCombatPolicy: 'pure-spell',
      wrappers: [sorcerer, monster, ...learnedSpellRows, ...curve],
      locations,
    });

    expect(result.attackMode).toBe('spell');
    expect(result.sorcererCombatPolicy).toBeUndefined();
    expect(result.levels[0].attackMode).toBe('spell');
    expect(result.levels[0].expectedSpellKills).toBeUndefined();
    expect(result.levels[0].spellAssumed).toMatchObject({ spell: 'Firebolt', spellLevel: 1, manaPerCast: 2 });
    expect(result.levels[0].mana).toMatchObject({ currentManaAtStart: 10, manaPool: 10, sustainable: true });
    expect(result.levels[0].mana!.expectedManaSpent).toBeCloseTo(2 * 2 / 0.95, 12);
    // The depth-1 level-up refills before depth 2; no later level-up occurs, so depth 3 carries the remainder.
    expect(result.levels[1].mana!.currentManaAtStart).toBe(10);
    expect(result.levels[2].mana!.currentManaAtStart).toBeCloseTo(10 - 2 * 2 / 0.95, 12);
    // One HP makes Firebolt tie the newer spells on casts, so its lower mana cost wins.
    expect(result.levels[8].spellAssumed).toMatchObject({ spell: 'Firebolt', spellLevel: 1 });
    expect(result.levels[8].spellsUsed).toEqual([
      expect.objectContaining({ spell: 'Firebolt', killShare: 1 }),
    ]);
    expect(result.assumptions.find((assumption) => assumption.id === 'mana-recovery')?.detail).toContain('Shrines are ignored');
  });

  it('defaults the Sorcerer to mixed combat and never spends more than start-of-depth mana', () => {
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 300,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      wrappers: [sorcerer, startingStaff, monster, ...learnedSpellRows, ...curve],
      locations,
    });

    expect(result.sorcererCombatPolicy).toBe('mixed');
    expect(result.weaponId).toBe(startingStaff.entity.id);
    expect(result.levels[0].expectedSpellKills).toBeCloseTo(10 / (2 / 0.95), 12);
    expect(result.levels[0].expectedMeleeKills).toBeCloseTo(10 - 10 / (2 / 0.95), 12);
    expect(result.levels[0].mana).toMatchObject({
      expectedManaSpent: 10,
      totalManaAvailable: 10,
      sustainable: true,
      deficit: 0,
    });
    expect(result.levels[0].expectedSecondsToClear).toBeGreaterThan(0);
    expect(result.assumptions.find((assumption) => assumption.id === 'sorcerer-spell-progression')?.detail)
      .toContain('time per mana');
  });

  it('resolves a loadout item enum whose itemdat row has no id cell by its enum ordinal row', () => {
    const blankIdStaff = {
      ...startingStaff,
      key: 'row166',
      raw: { ...startingStaff.raw, id: '' },
      entity: { ...startingStaff.entity, id: 'd1-row166', data: { ...startingStaff.entity.data, id: '' } },
    };
    const enumSorcerer = {
      ...sorcerer,
      entity: { ...sorcerer.entity, data: { ...sorcerer.entity.data, startingLoadout: { itemIds: ['IDI_SORCERER_DIABLO'] } } },
    };
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 300,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      wrappers: [enumSorcerer, blankIdStaff, monster, ...learnedSpellRows, ...curve],
      locations,
    });

    expect(result.weaponId).toBe('d1-row166');
  });

  it('switches a fire-immune target to lightning and names a target immune to every learned spell', () => {
    const fireImmune = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:FIRE_IMMUNE',
      key: 'FIRE_IMMUNE',
      rawHash: 'FIRE_IMMUNE',
      raw: { ...monster.raw, _monster_id: 'FIRE_IMMUNE', resistance: 'IMMUNE_FIRE' },
      entity: {
        ...monster.entity,
        id: 'd1-fire-immune',
        name: 'Fire Immune',
        data: {
          ...monster.entity.data,
          stats: (monster.entity.data.stats as { label: string; value: number }[]).map((stat) =>
            stat.label === 'HP Min' || stat.label === 'HP Max' ? { ...stat, value: 40 } : stat),
        },
      },
    } satisfies ReferenceWrapper;
    const fullyImmune = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:FULLY_IMMUNE',
      key: 'FULLY_IMMUNE',
      rawHash: 'FULLY_IMMUNE',
      raw: { ...monster.raw, _monster_id: 'FULLY_IMMUNE', resistance: 'IMMUNE_FIRE,IMMUNE_LIGHTNING' },
      entity: {
        ...monster.entity,
        id: 'd1-fully-immune',
        name: 'Fully Immune',
        data: {
          ...monster.entity.data,
          stats: (monster.entity.data.stats as { label: string; value: number }[]).map((stat) =>
            stat.label === 'HP Min' || stat.label === 'HP Max' ? { ...stat, value: 40 } : stat),
        },
      },
    } satisfies ReferenceWrapper;
    const result = simulateDescent({
      className: 'sorcerer',
      policy: 'none',
      tilesPerLevel: 60,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      sorcererCombatPolicy: 'pure-spell',
      wrappers: [sorcerer, fireImmune, fullyImmune, ...learnedSpellRows, ...curve],
      locations: locationsFor(fireImmune, fullyImmune),
    });

    expect(result.levels[4].spellsUsed).toEqual([
      expect.objectContaining({ spell: 'Lightning', expectedKills: 1, killShare: 1 }),
    ]);
    expect(result.levels[4].unboundedMonsters).toEqual([
      expect.objectContaining({ monsterId: fullyImmune.entity.id, monster: 'Fully Immune' }),
    ]);
    expect(result.levels[4].expectedSecondsToClear).toBeNull();
  });

  it('reports the while-walking speed fallback per monster when effective cadence is unavailable', () => {
    const fallbackMonster = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:FALLBACK',
      key: 'FALLBACK',
      rawHash: 'FALLBACK',
      raw: { ...monster.raw, _monster_id: 'FALLBACK' },
      entity: {
        ...monster.entity,
        id: 'd1-fallback-monster',
        name: 'Fallback Walker',
        data: {
          ...monster.entity.data,
          derived: {
            attackKinds: ['melee'],
            locomotion: { tilesPerSecondWhileWalking: 3 },
          },
        },
      },
    } satisfies ReferenceWrapper;
    const result = simulateDescent({
      className: 'rogue',
      policy: 'none',
      tilesPerLevel: 0,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      wrappers: [rogue, fallbackMonster, ...curve],
      locations: locationsFor(fallbackMonster),
    });

    expect(result.levels[0].approach?.monsterSpeeds).toEqual([
      expect.objectContaining({
        monsterId: fallbackMonster.entity.id,
        tilesPerSecond: 3,
        source: 'while-walking-upper-bound',
      }),
    ]);
  });

  it('lets missile-capable monsters counter at range instead of approaching', () => {
    const rangedMonster = {
      ...monster,
      wrapperId: 'test:monsters/monstdat.tsv:RANGED',
      key: 'RANGED',
      rawHash: 'RANGED',
      raw: { ...monster.raw, _monster_id: 'RANGED' },
      entity: {
        ...monster.entity,
        id: 'd1-ranged-monster',
        name: 'Ranged Monster',
        tags: ['SkeletonRanged'],
        data: {
          ...monster.entity.data,
          derived: {
            attackKinds: ['missile'],
            tilesPerSecond: 2,
            locomotion: { tilesPerSecondWhileWalking: 3 },
          },
        },
      },
    } satisfies ReferenceWrapper;
    const result = simulateDescent({
      className: 'rogue',
      policy: 'none',
      tilesPerLevel: 30,
      gameMode: 'single',
      difficulty: 'normal',
      gear: 'none',
      wrappers: [rogue, rangedMonster, arrowMissile, ...curve],
      locations: locationsFor(rangedMonster),
    });

    expect(result.levels[0].approach).toMatchObject({
      expectedFreeActionsPerKill: 0,
      freeShotShare: 0,
      monsterSpeeds: [{
        monsterId: rangedMonster.entity.id,
        tilesPerSecond: null,
        source: 'ranged-monster-holds-range',
      }],
    });
    // The arrow floor is 10%; after the Rogue's first shot, every remaining expected shot is countered.
    expect(result.levels[0].expectedDamageTaken).toBeCloseTo((1 / 0.88 - 1) * 0.1, 12);
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
      sorcererCombatPolicy: 'pure-spell',
      wrappers: [
        sorcerer, monster, expensiveFirebolt, chargedBolt, lightning, fireball, chainLightning,
        expectedSword, expectedDamagePrefix,
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
  it('funds exactly N of M kills in the hand-computed greedy case', () => {
    expect(allocateMixedSpellKills([{
      id: 'three-identical-kills',
      expectedKills: 3,
      manaPerKill: 2,
      secondsSavedPerKill: 5,
      lifeSavedPerKill: 1,
    }], 4)).toEqual([{
      id: 'three-identical-kills',
      expectedKills: 3,
      manaPerKill: 2,
      secondsSavedPerKill: 5,
      lifeSavedPerKill: 1,
      spellKills: 2,
      manaSpent: 4,
    }]);
  });

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
