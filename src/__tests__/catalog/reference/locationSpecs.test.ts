import { describe, expect, it } from 'vitest';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import {
  DIABLO1_LOCATION_LAWS,
  LOCATION_SPECS,
  locationEntities,
  seedLocationSteps,
} from '@/lib/catalog/reference/locationSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic',
  sourceProject: 'tests',
  sourceFile: 'synthetic.tsv',
  sourceRow: 'row=synthetic',
  licenceNote: 'invented test values',
  ingestedAt: 't0',
  canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  catalogId: string,
  file: string,
  raw: Record<string, string>,
  data: Record<string, unknown> = {},
): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`,
    sourceId: 'test',
    file,
    technique: 'test',
    key: raw._monster_id ?? raw.name ?? id.replace(/^d1-/, ''),
    keyKind: 'column',
    raw,
    rawHash: 'raw',
    catalogId,
    mappingVersion: 'test',
    entity: { id, catalogId, name: id, categoryPath: [], lifecycle: 'planned', tags: [], data, provenance },
  };
}

const ordinary = (id: string, availability: string, min: number, max: number) => wrapper(
  `d1-${id}`,
  'bestiary',
  'monsters/monstdat.tsv',
  { _monster_id: id, availability, minDunLvl: String(min), maxDunLvl: String(max) },
);

const unique = (id: string, type: string, level: number) => wrapper(
  `d1-uniq-${id}`,
  'bestiary',
  'monsters/unique_monstdat.tsv',
  { name: id, type, level: String(level) },
);

describe('Diablo I location specs', () => {
  it('keeps all 35 engine locations while promoting only the 25 vanilla records', () => {
    expect(LOCATION_SPECS).toHaveLength(35);
    const entities = locationEntities([]);
    expect(entities).toHaveLength(25);
    expect(entities.some((item) => item.entity.id === 'd1-level-17')).toBe(false);
    expect(entities.some((item) => item.entity.id === 'd1-region-hive')).toBe(false);
    expect(entities[0].entity.provenance.sourceFile).toMatch(/Source\/.*monstdat\.tsv/);
    expect(entities.find((item) => item.entity.id === 'd1-level-02')?.entity.links)
      .toContainEqual({ catalogId: 'quests', entityId: 'd1-Q_PWATER', role: 'hosts-quest' });
  });

  it('builds a depth pool from vanilla-retail availability and inclusive bounds', () => {
    const wrappers = [
      ordinary('MT_SYNTH_ALWAYS', 'Always', 10, 12),
      ordinary('MT_SYNTH_RETAIL', 'Retail', 11, 13),
      ordinary('MT_SYNTH_NEVER', 'Never', 10, 12),
      ordinary('MT_SYNTH_SHALLOW', 'Always', 2, 10),
      ordinary('MT_SYNTH_DEEP', 'Always', 12, 16),
    ];
    const level = locationEntities(wrappers).find((item) => item.entity.id === 'd1-level-11')!.entity;
    expect(level.links?.filter((link) => link.role === 'spawns').map((link) => link.entityId)).toEqual([
      'd1-MT_SYNTH_ALWAYS',
      'd1-MT_SYNTH_RETAIL',
    ]);
    expect(level.data.poolSize).toBe(2);
    expect(level.data.notes.join(' ')).toMatch(/eligible table pool.*not the roster/i);
  });

  it('links only same-depth uniques whose base type belongs to the eligible pool', () => {
    const wrappers = [
      ordinary('MT_SYNTH_BASE', 'Always', 9, 13),
      ordinary('MT_SYNTH_BLOCKED', 'Never', 9, 13),
      unique('right', 'MT_SYNTH_BASE', 11),
      unique('blocked-base', 'MT_SYNTH_BLOCKED', 11),
      unique('wrong-depth', 'MT_SYNTH_BASE', 10),
    ];
    const level = locationEntities(wrappers).find((item) => item.entity.id === 'd1-level-11')!.entity;
    expect(level.links?.filter((link) => link.role === 'unique')).toEqual([
      { catalogId: 'bestiary', entityId: 'd1-uniq-right', role: 'unique' },
    ]);
  });

  it('resolves a set-level parent from the supplied quest wrapper rather than a checked-in table value', () => {
    const quest = wrapper(
      'd1-Q_SKELKING',
      'quests',
      'quests/questdat.tsv',
      { qdlvl: '7' },
      { dungeonLevel: '7' },
    );
    quest.key = 'Q_SKELKING';
    const setLevel = locationEntities([quest]).find((item) => item.entity.id === 'd1-set-skeleton-king')!.entity;
    expect(setLevel.data.depth).toBe(7);
    expect(setLevel.links).toContainEqual({ catalogId: 'zone-map', entityId: 'd1-level-07', role: 'entered-from' });
  });

  it('generates four concise pinned laws without engine identifiers in their bodies', () => {
    expect(DIABLO1_LOCATION_LAWS).toHaveLength(4);
    for (const law of DIABLO1_LOCATION_LAWS) {
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.body).not.toMatch(/DTYPE_|_setlevels|currlevel|Monster::level/);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
    }
    expect(DIABLO1_LOCATION_LAWS.every((law) => DIABLO1_CANON.some((candidate) => candidate.id === law.id))).toBe(true);
  });

  it('seeds only sourced engine-held briefs, topology, pools, and quests while naming gaps', () => {
    const level = locationEntities([ordinary('MT_SYNTH_SEED', 'Always', 11, 11)])
      .find((item) => item.entity.id === 'd1-level-11')!.entity;
    const seeds = seedLocationSteps(level);
    expect(seeds.map((seed) => seed.step)).toEqual(['Concept Brief', 'Macro Layout & POIs', 'Encounter Placement']);
    expect(String(seeds[0].data.brief).length).toBeGreaterThanOrEqual(300);
    expect(seeds.every((seed) => seed.data[SOURCED_FIELD] != null)).toBe(true);
    expect((seeds[2].data.encounters as { populationRule: { registeredTypeCap: number; cumulativeImageBudget: number } }).populationRule)
      .toMatchObject({ registeredTypeCap: 24, cumulativeImageBudget: 4000 });
    expect(seeds.flatMap((seed) => seed.gaps).join(' ')).toMatch(/sector geometry|coordinates|hostedArena/);
  });
});
