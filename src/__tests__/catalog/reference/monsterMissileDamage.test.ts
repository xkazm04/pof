import { describe, expect, it } from 'vitest';
import type { MonsterProfile } from '@/lib/catalog/reference/combatMath';
import {
  MONSTER_MISSILE_DAMAGE_SOURCES,
  expectedMonsterMissileHitChecks,
  monsterMissileDamageSource,
  monsterMissileMetadata,
  resolveMonsterMissileDamage,
  selectMonsterMissileAttack,
} from '@/lib/catalog/reference/monsterMissileDamage';
import { spriteAnimLen } from '@/lib/catalog/reference/missileSpecs';
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

const ordinaryMonster = wrapper('d1-test-monster', 'bestiary', 'monsters/monstdat.tsv', {
  intelligence: 1,
  stats: [
    { label: 'Level', value: 10 },
    { label: 'Special Damage Min', value: 5 },
    { label: 'Special Damage Max', value: 7 },
  ],
});

const profile: MonsterProfile = {
  level: 10,
  hitPoints: { min: 20, max: 20 },
  armourClass: 0,
  toHit: 0,
  damage: { min: 2, max: 4 },
  monsterClass: 'demon',
  resist: {},
  immune: {},
  difficulty: 'normal',
};

describe('monster missile damage sources', () => {
  it('counts the Fireball flight target and its one-time terminal blast check', () => {
    const fireball = monsterMissileDamageSource('Fireball', 'Counselor');
    expect(fireball.hitCount).toEqual({ kind: 'fixed', hits: 2 });
    expect(fireball.omittedEffects).toEqual([]);
  });

  it('keeps every source structured and pinned to engine and missile-data lines', () => {
    expect(MONSTER_MISSILE_DAMAGE_SOURCES.length).toBe(17);
    for (const source of MONSTER_MISSILE_DAMAGE_SOURCES) {
      expect(source.refs.length, source.missile).toBeGreaterThan(0);
      expect(source.refs.some((ref) => ref.includes('/Source/')), source.missile).toBe(true);
      expect(source.projectilesPerAttack, source.missile).toBeGreaterThan(0);
    }
    expect(monsterMissileDamageSource('Arrow', 'SkeletonRanged').collision).toBe('ordinary-range');
    expect(monsterMissileDamageSource('MagmaBall', 'Magma').collision).toBe('ordinary-fixed');
    expect(monsterMissileDamageSource('Lightning', 'Bat').collision).toBe('already-shifted');
    expect(MONSTER_MISSILE_DAMAGE_SOURCES.map((source) => source.hitCount.kind)).not.toContain('unresolved');
  });

  it('selects Counselor spells by intelligence and Bat attacks by subtype intelligence', () => {
    expect([0, 1, 2, 3].map((intelligence) =>
      selectMonsterMissileAttack('Counselor', intelligence)?.missile))
      .toEqual(['Firebolt', 'ChargedBolt', 'LightningControl', 'Fireball']);
    expect(selectMonsterMissileAttack('Bat', 0, 'MT_GLOOM')).toMatchObject({ missile: 'Rhino', kind: 'special' });
    expect(selectMonsterMissileAttack('Bat', 0, 'MT_FAMILIAR')).toMatchObject({ missile: 'Lightning', kind: 'missile' });
    expect(selectMonsterMissileAttack('Bat', 0, 'MT_WINGED')).toBeUndefined();
    expect(selectMonsterMissileAttack('Storm', 0)).toMatchObject({ missile: 'ThinLightningControl', kind: 'missile' });
  });

  it('takes element and arrow classification from the promoted missile wrapper', () => {
    const arrow = wrapper('d1-arrow', 'vfx', 'missiles/misdat.tsv', { damageType: 'Physical', arrow: true }, { id: 'Arrow' });
    const acid = wrapper('d1-acid', 'vfx', 'missiles/misdat.tsv', { damageType: 'Acid' }, { id: 'Acid' });
    const staleFire = wrapper('d1-firebolt', 'vfx', 'missiles/misdat.tsv', {}, { id: 'Firebolt', flags: 'Fire' });
    expect(monsterMissileMetadata('Arrow', [arrow, acid])).toEqual({ element: 'physical', arrow: true });
    expect(monsterMissileMetadata('Acid', [arrow, acid])).toEqual({ element: 'acid', arrow: false });
    expect(monsterMissileMetadata('Firebolt', [staleFire])).toEqual({ element: 'fire', arrow: false });
  });

  it('uses special columns for charge and no impact damage for Gloom charge', () => {
    const charge = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Rhino', 'Rhino'), profile, ordinaryMonster, undefined,
    );
    expect(charge.damage.min).toBe(5 * 64);
    expect(charge.damage.max).toBe(7 * 64);
    expect(charge.damage.mean).toBe(6 * 64);

    const gloom = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Rhino', 'Bat'), profile, ordinaryMonster, undefined,
    );
    expect(gloom.damage).toMatchObject({ min: 0, max: 0, mean: 0 });
  });

  it('models fixed, multiplied, level-scaled, and three-projectile sources', () => {
    const familiar = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Lightning', 'Bat'), profile, ordinaryMonster, undefined,
    );
    expect(familiar.damage).toMatchObject({ min: 64, max: 64, mean: 64, expectedDenominator: 10 });
    expect(familiar.alreadyShifted).toBe(true);
    expect(familiar.hitCount).toMatchObject({ kind: 'fixed', hits: 8, persistent: {
      collisionChecks: 8,
      segmentsAtTarget: 1,
      hitDeletesMissile: false,
      repeatChecksSamePlayer: true,
    } });
    expect(familiar.expectedHitChecksPerAttack).toBe(8);

    const storm = resolveMonsterMissileDamage(
      monsterMissileDamageSource('ThinLightningControl', 'Storm'), profile, ordinaryMonster, undefined,
    );
    expect(storm.damage).toMatchObject({ min: 64, max: 64, mean: 64, expectedDenominator: 3 });
    expect(storm.expectedHitChecksPerAttack).toBe(10);
    const strongStorm = resolveMonsterMissileDamage(
      monsterMissileDamageSource('ThinLightningControl', 'Storm'),
      { ...profile, damage: { min: 40, max: 41 } },
      ordinaryMonster,
      undefined,
    );
    expect(strongStorm.damage.outcomes.map((outcome) => outcome.damage)).toEqual([80, 82]);

    const chargedBolt = resolveMonsterMissileDamage(
      monsterMissileDamageSource('ChargedBolt', 'Counselor'), profile, ordinaryMonster, undefined,
    );
    expect(chargedBolt.damage.mean).toBe(15 * 64);
    expect(chargedBolt.projectilesPerAttack).toBe(3);

    const nightmareProfile = { ...profile, difficulty: 'nightmare' as const };
    const flash = resolveMonsterMissileDamage(
      monsterMissileDamageSource('FlashBottom', 'Counselor'), nightmareProfile, ordinaryMonster, undefined,
    );
    expect(flash.damage.mean).toBe(64);
    expect(flash.expectedHitChecksPerAttack).toBe(19);

    const apocalypse = resolveMonsterMissileDamage(
      monsterMissileDamageSource('DiabloApocalypse', 'Diablo'), profile, ordinaryMonster, undefined,
    );
    expect(apocalypse.damage.mean).toBe(40 * 64);
  });

  it('resolves stationary controller geometry and the AcidPuddle child independently', () => {
    const infernoSource = monsterMissileDamageSource('InfernoControl', 'Mega');
    expect(infernoSource.hitCount).toMatchObject({
      kind: 'targeted-path',
      collisionChecksByTargetTile: [20, 25, 30],
      maxSegments: 3,
      hitDeletesMissile: false,
      repeatChecksSamePlayer: true,
    });
    expect([1, 2, 3, 4].map((distance) =>
      resolveMonsterMissileDamage(infernoSource, profile, ordinaryMonster, undefined, 0, distance)
        .expectedHitChecksPerAttack))
      .toEqual([20, 25, 30, 0]);

    const sprite = wrapper(
      'd1-sprite-SyntheticPuddle', 'vfx', 'missiles/missile_sprites.tsv',
      { frameLength: Array.from({ length: 16 }, (_, direction) => direction + 4) },
      { id: 'AcidPuddle' },
    );
    expect(spriteAnimLen([sprite], 'AcidPuddle', 1)).toBe(5);
    const acid = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Acid', 'Acid'), profile, ordinaryMonster, undefined, 0, 4, [sprite],
    );
    expect(acid.damageEvents).toHaveLength(2);
    expect(acid.damageEvents[0]).toMatchObject({ missile: 'Acid', expectedHitChecks: 1, alreadyShifted: false });
    expect(acid.damageEvents[1]).toMatchObject({
      missile: 'AcidPuddle', expectedHitChecks: 92, alreadyShifted: true, missileDistance: 0,
      damage: { min: 64, max: 64, mean: 64 },
    });
    expect(acid.expectedHitChecksPerAttack).toBe(93);
    expect(acid.source.persistentChild?.hitCount).toMatchObject({
      kind: 'random-duration',
      hitDeletesMissile: false,
      repeatChecksSamePlayer: true,
    });
    expect(expectedMonsterMissileHitChecks(acid.source.persistentChild!.hitCount, ordinaryMonster, 4, [sprite])).toBe(92);
  });

  it('uses raw GetHit for shifted sources and shifted bounds for ordinary arrows', () => {
    const familiar = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Lightning', 'Bat'), profile, ordinaryMonster, undefined, 64,
    );
    expect(familiar.damage).toMatchObject({ min: 65, max: 74, mean: 69.5 });

    const arrow = resolveMonsterMissileDamage(
      monsterMissileDamageSource('Arrow', 'SkeletonRanged'), profile, ordinaryMonster, undefined,
    );
    expect(arrow.damage).toMatchObject({ min: 2 * 64, max: 4 * 64, mean: 3 * 64, expectedDenominator: 129 });

    const magma = resolveMonsterMissileDamage(
      monsterMissileDamageSource('MagmaBall', 'Magma'), profile, ordinaryMonster, undefined,
    );
    expect(magma.damage).toMatchObject({ min: 2 * 64, max: 4 * 64, mean: 3 * 64, expectedDenominator: 3 });

    const hork = resolveMonsterMissileDamage(
      monsterMissileDamageSource('HorkSpawn', 'HorkDemon'), profile, ordinaryMonster, undefined,
    );
    expect(hork.damage).toMatchObject({ min: 0, max: 0, mean: 0 });
    expect(hork.hitCount).toEqual({ kind: 'fixed', hits: 0 });
  });
});
