import { describe, expect, it } from 'vitest';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import {
  seedBestiaryCombatSteps,
  seedCharacterCombatSteps,
  seedProgressionCurveSteps,
} from '@/lib/catalog/reference/combatSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic', sourceProject: 'tests', sourceFile: 'synthetic.tsv', sourceRow: 'row=1',
  licenceNote: 'invented test values', ingestedAt: 't0', canonProfile: 'diablo1',
};

function wrapper(id: string, catalogId: string, data: Record<string, unknown>, raw: Record<string, string> = {}, file = 'synthetic.tsv'): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file, technique: 'test', key: id, keyKind: 'column',
    raw, rawHash: 'raw', catalogId, mappingVersion: 'test',
    entity: { id, catalogId, name: id, categoryPath: [], lifecycle: 'planned', tags: [], links: [], data, provenance },
  };
}

const warrior = wrapper('d1-class-warrior', 'characters', {
  classFlags: [],
  baseStrength: '10', baseMagic: '11', baseDexterity: '12', baseVitality: '13',
  maxStrength: '80', maxMagic: '81', maxDexterity: '82', maxVitality: '83', blockBonus: '6',
  lifeAdjustment: '1', manaAdjustment: '2', lifePerLevel: '1', manaPerLevel: '1',
  lifePerBaseVitality: '1', manaPerBaseMagic: '1', lifePerItemVitality: '1', manaPerItemMagic: '1',
  baseMagicToHit: '7', baseMeleeToHit: '8', baseRangedToHit: '9',
});

const monster = wrapper('d1-test-monster', 'bestiary', {
  category: 'Demon',
  stats: [
    { label: 'Level', value: '2' }, { label: 'HP Min', value: '9' }, { label: 'HP Max', value: '15' },
    { label: 'Armor Class', value: '4' }, { label: 'To Hit', value: '12' },
    { label: 'Damage Min', value: '2' }, { label: 'Damage Max', value: '4' },
  ],
}, { resistance: '' }, 'monsters/monstdat.tsv');

describe('combat-derived SOURCED seeds', () => {
  it('reproduces every synthetic XP threshold exactly instead of fitting a curve', () => {
    const curve = {
      catalogId: 'progression-curves' as const,
      entity: {
        id: 'd1-xp-curve', catalogId: 'progression-curves', name: 'Synthetic curve', categoryPath: [], lifecycle: 'planned' as const, tags: [], links: [], provenance,
        data: { levels: [{ level: 1, experience: 17 }, { level: 3, experience: 91 }] },
      },
    };
    const [seed] = seedProgressionCurveSteps(curve);
    expect((seed.data.curveFormula as Record<string, unknown>).levels).toEqual(curve.entity.data.levels);
    expect((seed.data.curveFormula as Record<string, unknown>).thresholds).toEqual([17, 2 ** 32 - 1, 91]);
    expect(seed.data.sourced).toMatchObject({ sourceGame: 'Synthetic', sourceRow: 'row=1' });
    expect(seed.gaps.join(' ')).toMatch(/exponent.*softCap/);
  });

  it('builds the class Stat Block from laws and names unsupported movement speed', () => {
    const [seed] = seedCharacterCombatSteps(warrior);
    expect(seed.step).toBe('Stat Block');
    expect(seed.data.sourced).toBeDefined();
    expect(seed.data.stats).toMatchObject({ health: 15, mana: 14, armor: 2, moveSpeed: REFERENCE_GAP });
    expect(seed.gaps.join(' ')).toMatch(/moveSpeed/);
  });

  it('carries duel outputs into Encounter Balance and gaps the unrelated threat score', () => {
    const [seed] = seedBestiaryCombatSteps(monster, warrior);
    const balance = seed.data.balance as Record<string, unknown>;
    expect(seed.step).toBe('Encounter Balance');
    expect(seed.data.sourced).toBeDefined();
    expect(balance.playerHitChance).toEqual(expect.any(Number));
    expect(balance.expectedPlayerSwingsToKill).toEqual(expect.any(Number));
    expect(balance.gameMode).toBe('single');
    expect((seed.data.sourced as { columns: string[] }).columns).toContain('(gameMode single)');
    expect(seed.data.threat).toBe(REFERENCE_GAP);
    expect(seed.gaps.join(' ')).toMatch(/threat.*duel/);
  });
});
