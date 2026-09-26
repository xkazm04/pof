import { describe, expect, it } from 'vitest';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import {
  DIABLO1_OBJECT_LAWS,
  OBJECT_SPECS,
  SHRINE_EFFECTS,
  objectSpecFor,
  seedObjectSteps,
  withObjectSpecs,
} from '@/lib/catalog/reference/objectSpecs';

function inventedWrapper(id = 'OBJ_CHEST1'): ReferenceWrapper {
  return {
    wrapperId: `invented:objects:${id}`,
    sourceId: 'diablo1',
    file: 'objects/objdat.tsv',
    technique: 'tsv@1',
    key: id,
    keyKind: 'column',
    raw: { id, flags: 'Solid,Trap' },
    rawHash: 'invented',
    catalogId: 'props',
    mappingVersion: 'invented',
    entity: {
      id: `d1-${id}`,
      catalogId: 'props',
      name: 'Invented object',
      categoryPath: [],
      tags: [],
      lifecycle: 'planned',
      data: { flags: ['Solid', 'Trap'] },
      provenance: {
        kind: 'ingest', sourceGame: 'Invented', sourceProject: 'Test',
        sourceFile: 'objects/invented.tsv', sourceRow: `id=${id}`,
        licenceNote: 'Invented fixture', ingestedAt: '2026-01-01T00:00:00.000Z', canonProfile: 'diablo1',
      },
    },
  };
}

describe('engine-derived object specifications', () => {
  it('classifies every object enum exactly once into shared kinds', () => {
    const objects = OBJECT_SPECS.flatMap((spec) => spec.objects);
    expect(objects).toHaveLength(109);
    expect(new Set(objects).size).toBe(objects.length);
    expect(OBJECT_SPECS.some((spec) => spec.objects.length > 10)).toBe(true);
    for (const spec of OBJECT_SPECS) {
      expect(spec.refs.length).toBeGreaterThan(0);
      expect(spec.refs.every((ref) => /^\.reference\/devilutionX\/Source\/objects\.cpp:\d+$/.test(ref))).toBe(true);
    }
  });

  it('promotes a row with the kind that links it to its shared specification', () => {
    const [wrapper] = withObjectSpecs([inventedWrapper()]);
    expect(wrapper.entity.data.kind).toBe('chest');
    expect(objectSpecFor(String(wrapper.raw.id))).toBe(objectSpecFor('OBJ_CHEST1'));
    expect(() => withObjectSpecs([inventedWrapper('OBJ_SYNTH')])).toThrow(/no engine-derived object spec/);
  });

  it('has exactly 26 vanilla shrine slots with effects, duration class and pinned refs', () => {
    expect(SHRINE_EFFECTS).toHaveLength(26);
    expect(SHRINE_EFFECTS.filter((effect) => effect.shrine === 'Magical')).toHaveLength(2);
    for (const effect of SHRINE_EFFECTS) {
      expect(['permanent', 'timed', 'instant']).toContain(effect.duration);
      expect(effect.effect.length).toBeGreaterThan(10);
      expect(effect.refs.length).toBeGreaterThan(0);
    }
  });

  it('generates four short, plain-English prop laws without engine identifiers', () => {
    expect(DIABLO1_OBJECT_LAWS.map((law) => law.id)).toEqual([
      'd1-object-operation-law',
      'd1-shrine-selection-law',
      'd1-object-trap-law',
      'd1-container-drop-law',
    ]);
    for (const law of DIABLO1_OBJECT_LAWS) {
      expect(law.scope).toBe('props');
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.body).not.toMatch(/\b(?:OBJ_|Operate[A-Z]|Create[A-Z]|_[a-zA-Z]\w*)/);
    }
  });

  it('seeds only engine-known prop facts as SOURCED and names every target-side gap', () => {
    const chestSeeds = seedObjectSteps(inventedWrapper());
    expect(chestSeeds.map((seed) => seed.step)).toEqual(['Interaction', 'Loot on Destroy']);
    for (const seed of chestSeeds) {
      expect(seed.data.sourced).toBeDefined();
      expect(seed.gaps.length).toBeGreaterThan(0);
    }

    const barrelSeeds = seedObjectSteps(inventedWrapper('OBJ_BARREL'));
    expect(barrelSeeds.map((seed) => seed.step)).toEqual([
      'Interaction', 'Destruction States', 'Loot on Destroy',
    ]);
    expect(barrelSeeds.find((seed) => seed.step === 'Destruction States')?.gaps)
      .toContain('damaged: Diablo I has only intact and broken object states, with no partial-health state');
  });
});
