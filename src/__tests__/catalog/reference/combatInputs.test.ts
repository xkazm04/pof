import { describe, expect, it } from 'vitest';
import { classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic',
  sourceProject: 'tests',
  sourceFile: 'synthetic.tsv',
  sourceRow: 'row=1',
  licenceNote: 'invented test values',
  ingestedAt: 't0',
  canonProfile: 'diablo1',
};

function wrapper(id: string, catalogId: string, data: Record<string, unknown>, raw: Record<string, string> = {}, file = 'synthetic.tsv'): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file, technique: 'test', key: id, keyKind: 'column',
    raw, rawHash: 'raw', catalogId, mappingVersion: 'test',
    entity: { id, catalogId, name: id, categoryPath: [], lifecycle: 'planned', tags: [], links: [], data, provenance },
  };
}

const classData = {
  classFlags: ['SyntheticFlag'],
  baseStrength: '11', baseMagic: '12', baseDexterity: '13', baseVitality: '14',
  maxStrength: '81', maxMagic: '82', maxDexterity: '83', maxVitality: '84',
  blockBonus: '5', lifeAdjustment: '64', manaAdjustment: '128', lifePerLevel: '192', manaPerLevel: '256',
  lifePerBaseVitality: '32', manaPerBaseMagic: '16', lifePerItemVitality: '48', manaPerItemMagic: '24',
  baseMagicToHit: '7', baseMeleeToHit: '8', baseRangedToHit: '9',
};
const warrior = wrapper('d1-class-warrior', 'characters', classData);

describe('combat wrapper adapters', () => {
  it('reads every class coefficient from the projected wrapper', () => {
    expect(classCoefficients(warrior)).toMatchObject({
      classFlags: ['SyntheticFlag'], baseStrength: 11, baseMagic: 12, baseDexterity: 13, baseVitality: 14,
      lifeAdjustment: 64 * 64, baseMeleeToHit: 8,
    });
  });

  it('makes a base-attribute, no-stat-points build and only adds the supplied weapon', () => {
    const bare = referenceBuild(warrior, 4);
    expect(bare).toMatchObject({
      class: 'Warrior', level: 4, strength: 11, magic: 12, dexterity: 13, vitality: 14,
      weaponDamage: { min: 1, max: 1 }, weaponType: 'other', armourClass: 0, hasShield: false,
    });
    const sword = wrapper('d1-test-sword', 'items', {
      subtype: 'Sword', stats: [{ label: 'Damage Min', value: '6' }, { label: 'Damage Max', value: '10' }],
    });
    expect(referenceBuild(warrior, 4, sword)).toMatchObject({ weaponDamage: { min: 6, max: 10 }, weaponType: 'sword' });
  });

  it('translates projected monster stats and raw resistance flags', () => {
    const monster = wrapper('d1-test-monster', 'bestiary', {
      category: 'Undead',
      stats: [
        { label: 'Level', value: '3' }, { label: 'HP Min', value: '20' }, { label: 'HP Max', value: '30' },
        { label: 'Armor Class', value: '7' }, { label: 'To Hit', value: '17' },
        { label: 'Damage Min', value: '2' }, { label: 'Damage Max', value: '5' },
      ],
    }, { resistance: 'IMMUNE_MAGIC,RESIST_FIRE' }, 'monsters/monstdat.tsv');
    expect(monsterProfile(monster, 'nightmare')).toEqual({
      level: 3, hitPoints: { min: 20, max: 30 }, armourClass: 7, toHit: 17,
      damage: { min: 2, max: 5 }, monsterClass: 'undead',
      resist: { fire: true }, immune: { magic: true }, difficulty: 'nightmare',
    });
  });

  it('resolves a unique monster over its base wrapper', () => {
    const base = wrapper('d1-MT_SYNTH', 'bestiary', {
      category: 'Demon',
      stats: [
        { label: 'Level', value: '2' }, { label: 'HP Min', value: '10' }, { label: 'HP Max', value: '12' },
        { label: 'Armor Class', value: '8' }, { label: 'To Hit', value: '19' },
        { label: 'Damage Min', value: '2' }, { label: 'Damage Max', value: '4' },
      ],
    }, { _monster_id: 'MT_SYNTH', level: '2', armorClass: '8', toHit: '19' }, 'monsters/monstdat.tsv');
    const unique = wrapper('d1-uniq-synthetic', 'bestiary', {}, {
      type: 'MT_SYNTH', level: '0', maxHp: '150', ai: 'SyntheticAI', intelligence: '2',
      minDamage: '5', maxDamage: '9', resistance: 'IMMUNE_FIRE', customToHit: '0', customArmorClass: '0',
    }, 'monsters/unique_monstdat.tsv');
    expect(monsterProfile(unique, 'normal', base)).toEqual({
      level: 7, hitPoints: { min: 150, max: 150 }, armourClass: 8, toHit: 19,
      damage: { min: 5, max: 9 }, monsterClass: 'demon', resist: {}, immune: { fire: true },
      difficulty: 'normal', difficultyAdjusted: true,
    });
  });

  it('refuses Hellfire class wrappers', () => {
    expect(() => classCoefficients(wrapper('d1-class-monk', 'characters', classData))).toThrow(/Hellfire/);
  });
});
