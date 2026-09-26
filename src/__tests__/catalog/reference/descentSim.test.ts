import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  simulateDescent,
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
});
