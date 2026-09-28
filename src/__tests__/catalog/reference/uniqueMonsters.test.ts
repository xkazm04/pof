import { describe, expect, it } from 'vitest';
import {
  effectiveUnique,
  effectiveUniqueMonstersForPromotion,
} from '@/lib/catalog/reference/uniqueMonsters';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const, sourceGame: 'Synthetic', sourceProject: 'tests', sourceFile: 'synthetic.tsv',
  sourceRow: 'row=1', licenceNote: 'invented test values', ingestedAt: 't0', canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  file: string,
  raw: Record<string, string>,
  data: Record<string, unknown> = {},
  links?: ReferenceWrapper['entity']['links'],
): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file, technique: 'test', key: id, keyKind: 'column',
    raw, rawHash: 'raw', catalogId: 'bestiary', mappingVersion: 'test',
    entity: { id, catalogId: 'bestiary', name: id, categoryPath: [], lifecycle: 'planned', tags: [], data, links, provenance },
  };
}

const base = wrapper('d1-MT_SYNTH', 'monsters/monstdat.tsv', {
  _monster_id: 'MT_SYNTH', level: '4', toHit: '27', armorClass: '13', resistance: 'RESIST_FIRE', resistanceHell: 'IMMUNE_FIRE',
});

describe('effectiveUniqueMonstersForPromotion', () => {
  it('adds effective stats and reprojects base animations with the unique AI and intelligence', () => {
    const baseWithTiming = wrapper('d1-MT_SYNTH', 'monsters/monstdat.tsv', base.raw, {
      animFrames: '10,20,12,6,16,8',
      animRates: '3,1,1,1,1,1',
      attackActionFrame: '8',
      intelligence: '0',
      derived: {
        byDifficulty: { normal: { level: 4 } },
        laws: ['d1-timing-law', 'd1-ai-zombie-law'],
        locomotion: { laws: ['d1-timing-law'], walkTicksPerStep: 21, tilesPerSecondWhileWalking: 0.95 },
        walkTicksPerStep: 42,
        tilesPerSecond: 0.48,
        attackCycleTicks: 60,
        attackCycleSeconds: 3,
        hitDelaySeconds: 0.4,
      },
    });
    const named = wrapper('d1-uniq-synthetic', 'monsters/unique_monstdat.tsv', {
      ...unique({ ai: 'Bat' }).raw,
    }, {}, [{ catalogId: 'bestiary', entityId: baseWithTiming.entity.id, role: 'base' }]);

    const result = effectiveUniqueMonstersForPromotion([named], [named, baseWithTiming]);
    expect(result.unresolved).toEqual([]);
    const data = result.wrappers[0].entity.data;
    expect(data.effective).toMatchObject({
      gameMode: 'single',
      byDifficulty: {
        normal: { armorClass: { value: 13, source: 'base' } },
        nightmare: { armorClass: { value: 63, source: 'base' } },
        hell: { armorClass: { value: 93, source: 'base' } },
      },
    });
    expect(data.derived).toMatchObject({
      inheritedFrom: {
        entityId: 'd1-MT_SYNTH',
        role: 'base type',
        reason: 'unique monsters use their base type animations',
      },
      laws: ['d1-timing-law', 'd1-ai-bat-law'],
      attackKinds: ['melee', 'special', 'missile'],
      locomotion: { laws: ['d1-timing-law'], walkTicksPerStep: 21, tilesPerSecondWhileWalking: 20 / 21 },
      attackCycleTicks: 15,
      attackCycleSeconds: 0.75,
      hitDelaySeconds: 0.35,
    });
    expect((data.derived as Record<string, number>).walkTicksPerStep).toBeCloseTo(29.925, 12);
    expect((data.derived as Record<string, number>).tilesPerSecond).toBeCloseTo(20 / 29.925, 12);
    expect((data.derived as Record<string, unknown>).walkTicksPerStep).not.toBe(42);
    expect((data.derived as Record<string, unknown>).byDifficulty).toBeUndefined();
  });

  it('reports a missing base and keeps the orphan promotable without effective data', () => {
    const orphan = unique({ type: 'MT_MISSING', ai: 'Bat' });
    orphan.entity.links = [{ catalogId: 'bestiary', entityId: 'd1-MT_MISSING', role: 'base' }];

    const result = effectiveUniqueMonstersForPromotion([orphan], [orphan]);
    expect(result.unresolved).toEqual([{
      entityId: orphan.entity.id,
      reason: 'base-type link d1-MT_MISSING does not resolve to an available wrapper',
    }]);
    expect(result.wrappers).toEqual([orphan]);
    expect(result.wrappers[0].entity.data.effective).toBeUndefined();
  });
});

function unique(overrides: Record<string, string> = {}): ReferenceWrapper {
  return wrapper('d1-uniq-synthetic', 'monsters/unique_monstdat.tsv', {
    type: 'MT_SYNTH', level: '0', maxHp: '201', ai: 'SyntheticAI', intelligence: '3',
    minDamage: '7', maxDamage: '12', resistance: 'IMMUNE_MAGIC,RESIST_LIGHTNING',
    customToHit: '0', customArmorClass: '0', ...overrides,
  });
}

describe('effectiveUnique', () => {
  it('uses base + 5 for level zero and inherits zero custom combat stats', () => {
    const effective = effectiveUnique(unique(), base, 'normal', { gameMode: 'multi' });
    expect(effective.level).toEqual({ value: 9, source: 'engine rule' });
    expect(effective.toHit).toEqual({ value: 27, source: 'base' });
    expect(effective.armorClass).toEqual({ value: 13, source: 'base' });
    expect(effective.hitPoints).toMatchObject({ value: { min: 201, max: 201 }, source: 'unique override' });
    expect(effectiveUnique(unique(), base, 'normal').hitPoints.value)
      .toMatchObject({ min: 100.5, max: 100.5 });
    expect(effective.resistances.value).toEqual(['IMMUNE_MAGIC', 'RESIST_LIGHTNING']);
  });

  it('applies nonzero overrides and the engine difficulty transforms', () => {
    const effective = effectiveUnique(unique({ level: '6', customToHit: '44', customArmorClass: '21' }), base, 'nightmare', { gameMode: 'multi' });
    expect(effective.level).toEqual({ value: 27, source: 'unique override' });
    expect(effective.toHit).toEqual({ value: 129, source: 'unique override' });
    expect(effective.armorClass).toEqual({ value: 71, source: 'unique override' });
    expect(effective.damage.value).toEqual({ min: 18, max: 28 });
    expect(effective.hitPoints.value).toMatchObject({ min: 703, max: 703 });
    expect(effectiveUnique(unique(), base, 'nightmare').hitPoints.value)
      .toMatchObject({ min: 401.5, max: 401.5 });
    expect(effectiveUnique(unique(), base, 'nightmare', { gameMode: 'single', hellfire: true }).hitPoints.value)
      .toMatchObject({ min: 351.5, max: 351.5 });
    expect(effective.ai).toEqual({ value: 'SyntheticAI', source: 'unique override' });
    expect(effective.intelligence).toEqual({ value: 3, source: 'unique override' });
    expect(effectiveUnique(unique(), base, 'hell').resistances)
      .toEqual({ value: ['IMMUNE_MAGIC', 'RESIST_LIGHTNING'], source: 'unique override' });
  });
});
