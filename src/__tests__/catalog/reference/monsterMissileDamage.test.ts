import { describe, expect, it } from 'vitest';
import type { MonsterProfile } from '@/lib/catalog/reference/combatMath';
import {
  MONSTER_MISSILE_DAMAGE_SOURCES,
  monsterMissileDamageSource,
  monsterMissileMetadata,
  resolveMonsterMissileDamage,
  selectMonsterMissileAttack,
} from '@/lib/catalog/reference/monsterMissileDamage';
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
  stats: [
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
  it('keeps every source structured and pinned to engine and missile-data lines', () => {
    expect(MONSTER_MISSILE_DAMAGE_SOURCES.length).toBe(17);
    for (const source of MONSTER_MISSILE_DAMAGE_SOURCES) {
      expect(source.refs.length, source.missile).toBeGreaterThan(0);
      expect(source.refs.some((ref) => ref.includes('/Source/')), source.missile).toBe(true);
      expect(source.projectilesPerAttack, source.missile).toBeGreaterThan(0);
    }
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
    expect(familiar.damage).toMatchObject({ min: 64, max: 10 * 64, mean: 5.5 * 64 });
    expect(familiar.alreadyShifted).toBe(true);

    const storm = resolveMonsterMissileDamage(
      monsterMissileDamageSource('ThinLightningControl', 'Storm'), profile, ordinaryMonster, undefined,
    );
    expect(storm.damage.outcomes.map((outcome) => outcome.damage)).toEqual([4 * 64, 6 * 64, 8 * 64]);

    const chargedBolt = resolveMonsterMissileDamage(
      monsterMissileDamageSource('ChargedBolt', 'Counselor'), profile, ordinaryMonster, undefined,
    );
    expect(chargedBolt.damage.mean).toBe(15 * 64);
    expect(chargedBolt.projectilesPerAttack).toBe(3);

    const nightmareProfile = { ...profile, difficulty: 'nightmare' as const };
    const flash = resolveMonsterMissileDamage(
      monsterMissileDamageSource('FlashBottom', 'Counselor'), nightmareProfile, ordinaryMonster, undefined,
    );
    expect(flash.damage.mean).toBe(2 * (10 + 15) * 64);

    const apocalypse = resolveMonsterMissileDamage(
      monsterMissileDamageSource('DiabloApocalypse', 'Diablo'), profile, ordinaryMonster, undefined,
    );
    expect(apocalypse.damage.mean).toBe(40 * 64);
  });
});
