import { describe, expect, it } from 'vitest';
import { effectiveUnique } from '@/lib/catalog/reference/uniqueMonsters';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const, sourceGame: 'Synthetic', sourceProject: 'tests', sourceFile: 'synthetic.tsv',
  sourceRow: 'row=1', licenceNote: 'invented test values', ingestedAt: 't0', canonProfile: 'diablo1',
};

function wrapper(id: string, file: string, raw: Record<string, string>, data: Record<string, unknown> = {}): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file, technique: 'test', key: id, keyKind: 'column',
    raw, rawHash: 'raw', catalogId: 'bestiary', mappingVersion: 'test',
    entity: { id, catalogId: 'bestiary', name: id, categoryPath: [], lifecycle: 'planned', tags: [], data, provenance },
  };
}

const base = wrapper('d1-MT_SYNTH', 'monsters/monstdat.tsv', {
  _monster_id: 'MT_SYNTH', level: '4', toHit: '27', armorClass: '13', resistance: 'RESIST_FIRE',
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
    expect(effective.hitPoints).toEqual({ value: { min: 201, max: 201 }, source: 'unique override' });
    expect(effectiveUnique(unique(), base, 'normal').hitPoints.value)
      .toEqual({ min: 100.5, max: 100.5 });
    expect(effective.resistances.value).toEqual(['IMMUNE_MAGIC', 'RESIST_LIGHTNING']);
  });

  it('applies nonzero overrides and the engine difficulty transforms', () => {
    const effective = effectiveUnique(unique({ level: '6', customToHit: '44', customArmorClass: '21' }), base, 'nightmare', { gameMode: 'multi' });
    expect(effective.level).toEqual({ value: 27, source: 'unique override' });
    expect(effective.toHit).toEqual({ value: 129, source: 'unique override' });
    expect(effective.armorClass).toEqual({ value: 71, source: 'unique override' });
    expect(effective.damage.value).toEqual({ min: 18, max: 28 });
    expect(effective.hitPoints.value).toEqual({ min: 703, max: 703 });
    expect(effectiveUnique(unique(), base, 'nightmare').hitPoints.value)
      .toEqual({ min: 401.5, max: 401.5 });
    expect(effectiveUnique(unique(), base, 'nightmare', { gameMode: 'single', hellfire: true }).hitPoints.value)
      .toEqual({ min: 351.5, max: 351.5 });
    expect(effective.ai).toEqual({ value: 'SyntheticAI', source: 'unique override' });
    expect(effective.intelligence).toEqual({ value: 3, source: 'unique override' });
  });
});
