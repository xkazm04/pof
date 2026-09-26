/** Diablo I zone-map projections derived from pinned engine structure and external wrappers. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { DIABLO1_SOURCE } from '@/lib/catalog/ingest/diablo1';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import { LOCATION_LAW_DATA, LOCATION_SPECS_DATA } from '@/lib/catalog/reference/locationSpecsData';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogLink } from '@/lib/catalog/types';

export type LocationKind = 'town' | 'dungeon' | 'set-level' | 'lore-place';
export type DungeonType =
  | 'DTYPE_TOWN'
  | 'DTYPE_CATHEDRAL'
  | 'DTYPE_CATACOMBS'
  | 'DTYPE_CAVES'
  | 'DTYPE_HELL'
  | 'DTYPE_NEST'
  | 'DTYPE_CRYPT';
export type LocationDepth = number | `${number}-${number}` | 'quest-parent';
export type DiabloQuestId = `Q_${string}`;

export interface LocationSpecData {
  id: `d1-${string}`;
  name: string;
  kind: LocationKind;
  dungeonType: DungeonType;
  depth: LocationDepth;
  entry: string;
  procedural: string;
  quests: readonly DiabloQuestId[];
  parentQuest?: DiabloQuestId;
  hellfire: boolean;
  refs: readonly string[];
}

export type LocationSpec = LocationSpecData;
export const LOCATION_SPECS: readonly LocationSpec[] = LOCATION_SPECS_DATA;

export const DIABLO1_LOCATION_LAWS: readonly ProjectRule[] = LOCATION_LAW_DATA.map((law) => ({
  id: law.id,
  profile: 'diablo1',
  category: 'game',
  scope: law.scope,
  title: `${law.title} (engine-derived)`,
  body: law.body,
  refs: [...law.refs],
}));

export interface LocationEntityData {
  kind: LocationKind;
  dungeonType: DungeonType;
  depth: LocationDepth;
  entry: string;
  procedural: string;
  poolSize: number;
  notes: string[];
}

export type LocationCatalogEntity = Omit<IngestedEntity, 'catalogId' | 'data'> & {
  catalogId: 'zone-map';
  data: LocationEntityData;
};

export interface LocationEntityWrapper {
  catalogId: 'zone-map';
  entity: LocationCatalogEntity;
}

const number = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value))) return null;
  return Number(value);
};

const ordinaryMonster = (wrapper: ReferenceWrapper): boolean =>
  wrapper.catalogId === 'bestiary' && wrapper.file === 'monsters/monstdat.tsv';

const uniqueMonster = (wrapper: ReferenceWrapper): boolean =>
  wrapper.catalogId === 'bestiary' && wrapper.file === 'monsters/unique_monstdat.tsv';

/** Retail accepts both Always and Retail rows; Never and unknown values are excluded. */
function admitsVanillaRetail(wrapper: ReferenceWrapper): boolean {
  const availability = wrapper.raw.availability?.trim();
  return availability === 'Always' || availability === 'Retail';
}

function eligibleAtDepth(wrapper: ReferenceWrapper, depth: number): boolean {
  const minimum = number(wrapper.raw.minDunLvl);
  const maximum = number(wrapper.raw.maxDunLvl);
  return ordinaryMonster(wrapper)
    && admitsVanillaRetail(wrapper)
    && minimum != null
    && maximum != null
    && minimum <= depth
    && depth <= maximum;
}

function parentDepth(spec: LocationSpec, wrappers: readonly ReferenceWrapper[]): number | null {
  if (!spec.parentQuest) return null;
  const quest = wrappers.find((wrapper) =>
    wrapper.catalogId === 'quests'
    && wrapper.file === 'quests/questdat.tsv'
    && (wrapper.key === spec.parentQuest || wrapper.entity.id === `d1-${spec.parentQuest}`));
  return number(quest?.raw.qdlvl ?? (quest?.entity.data as { dungeonLevel?: unknown } | undefined)?.dungeonLevel);
}

function engineFiles(spec: LocationSpec): string[] {
  return spec.refs.map((ref) => {
    const match = /\/Source\/(.+?)(?:#L\d+)?$/.exec(ref);
    return match ? `Source/${match[1]}` : ref;
  });
}

function uniqueLinks(links: CatalogLink[]): CatalogLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.catalogId}:${link.entityId}:${link.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build the 25 vanilla location pseudo-wrappers. Hellfire specs remain inspectable above but
 * cannot be promoted. Monster and quest values are read from wrappers supplied at runtime.
 */
export function locationEntities(wrappers: readonly ReferenceWrapper[]): LocationEntityWrapper[] {
  return LOCATION_SPECS.filter((spec) => !spec.hellfire).map((spec) => {
    const depth = typeof spec.depth === 'number' ? spec.depth : null;
    const pool = spec.kind === 'dungeon' && depth != null
      ? wrappers.filter((wrapper) => eligibleAtDepth(wrapper, depth))
      : [];
    const poolTypes = new Set(pool.map((wrapper) => wrapper.raw._monster_id));
    const uniques = spec.kind === 'dungeon' && depth != null
      ? wrappers.filter((wrapper) =>
          uniqueMonster(wrapper)
          && number(wrapper.raw.level) === depth
          && poolTypes.has(wrapper.raw.type))
      : [];
    const resolvedParentDepth = parentDepth(spec, wrappers);
    const links = uniqueLinks([
      ...spec.quests.map((quest): CatalogLink => ({ catalogId: 'quests', entityId: `d1-${quest}`, role: 'hosts-quest' })),
      ...pool.map((wrapper): CatalogLink => ({ catalogId: 'bestiary', entityId: wrapper.entity.id, role: 'spawns' })),
      ...uniques.map((wrapper): CatalogLink => ({ catalogId: 'bestiary', entityId: wrapper.entity.id, role: 'unique' })),
      ...(resolvedParentDepth == null ? [] : [{
        catalogId: 'zone-map',
        entityId: `d1-level-${String(resolvedParentDepth).padStart(2, '0')}`,
        role: 'entered-from',
      }]),
    ]);
    const sourceFiles = [
      ...engineFiles(spec),
      'assets/txtdata/monsters/monstdat.tsv',
      'assets/txtdata/monsters/unique_monstdat.tsv',
    ];
    const notes = spec.kind === 'dungeon' && depth != null
      ? [
          'The spawn links are the complete vanilla-retail eligible table pool at this depth, not the roster drawn for one game.',
          'The engine draws distinct candidates from this pool after forced types, stopping when exhausted, at 24 registered types total, or at the 4000 image budget.',
          ...(depth === 16 ? ['Depth 16 skips the random draw and uses its fixed engine roster; the linked pool remains the range-eligible table set.'] : []),
        ]
      : ['No ordinary per-floor random monster draw applies to this location record.'];
    if (spec.kind === 'set-level' && resolvedParentDepth == null) {
      notes.push('Parent depth is a named gap until the matching quest table wrapper supplies its configured dungeon level.');
    }

    return {
      catalogId: 'zone-map',
      entity: {
        id: `d1-${spec.id.replace(/^d1-/, '')}`,
        catalogId: 'zone-map',
        name: spec.name,
        categoryPath: [],
        lifecycle: 'planned',
        tags: ['diablo-location', spec.kind],
        links,
        data: {
          kind: spec.kind,
          dungeonType: spec.dungeonType,
          depth: resolvedParentDepth ?? spec.depth,
          entry: spec.entry,
          procedural: spec.procedural,
          poolSize: pool.length,
          notes,
        },
        provenance: {
          kind: 'ingest',
          sourceGame: DIABLO1_SOURCE.sourceGame,
          sourceProject: `${DIABLO1_SOURCE.sourceProject}; engine pinned at 4138a82`,
          sourceFile: [...new Set(sourceFiles)].join(', '),
          sourceRow: spec.id,
          licenceNote: DIABLO1_SOURCE.licenceNote,
          ingestedAt: new Date().toISOString(),
          canonProfile: 'diablo1',
        },
      },
    };
  });
}

function stamp(entity: LocationCatalogEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: entity.provenance.sourceFile,
    sourceRow: entity.provenance.sourceRow,
    columns,
  };
}

/** Seed only engine-held description, topology/quest facts, and encounter-pool facts. */
export function seedLocationSteps(entity: LocationCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'zone-map' || !entity.tags.includes('diablo-location')) return [];
  const questLinks = (entity.links ?? []).filter((link) => link.role === 'hosts-quest');
  const parentLinks = (entity.links ?? []).filter((link) => link.role === 'entered-from');
  const poolLinks = (entity.links ?? []).filter((link) => link.role === 'spawns');
  const uniqueMonsterLinks = (entity.links ?? []).filter((link) => link.role === 'unique');
  const encounterLinks = [...poolLinks, ...uniqueMonsterLinks, ...questLinks];
  const brief = `${entity.name} is an engine-derived Diablo I ${entity.data.kind} location in ${entity.data.dungeonType}, at ${String(entity.data.depth)}. ${entity.data.entry} ${entity.data.procedural} It hosts ${questLinks.length} cataloged quest link${questLinks.length === 1 ? '' : 's'} and exposes ${entity.data.poolSize} range-eligible ordinary monster type${entity.data.poolSize === 1 ? '' : 's'} as the candidate pool, not a guaranteed per-game roster. The source establishes entry, generation mode, quest association, and population eligibility; it does not establish PoF sector geometry, authored encounter coordinates, presentation, streaming, audio, minimap, icon, test, or packaging data.`;

  return [
    {
      catalogId: 'zone-map', entityId: entity.id, step: 'Concept Brief',
      data: {
        brief,
        [SOURCED_FIELD]: stamp(entity, ['kind', 'dungeonType', 'depth', 'entry', 'procedural', 'links', '(law d1-level-structure)']),
      },
      gaps: ['visual identity and mood: the engine location sources do not specify a PoF art brief'],
    },
    {
      catalogId: 'zone-map', entityId: entity.id, step: 'Macro Layout & POIs',
      data: {
        layout: {
          sectors: REFERENCE_GAP,
          pois: questLinks.map((link) => ({ type: 'quest', catalogRef: `quests::${link.entityId}`, placement: REFERENCE_GAP })),
          navigationContract: {
            entry: entity.data.entry,
            enteredFrom: parentLinks.map((link) => `zone-map::${link.entityId}`),
          },
        },
        links: [...questLinks, ...parentLinks],
        [SOURCED_FIELD]: stamp(entity, ['entry', 'procedural', 'links[role=hosts-quest]', 'links[role=entered-from]']),
      },
      gaps: [
        'sectors: engine sources name generation and entry topology but this projection does not contain tile or sector geometry',
        'quest POI placement: a hosted quest link does not state an authored coordinate',
        'wiringContract: the reference engine does not define PoF registration, activation, dependencies, or verification',
      ],
    },
    {
      catalogId: 'zone-map', entityId: entity.id, step: 'Encounter Placement',
      data: {
        encounters: {
          hostedArena: REFERENCE_GAP,
          packPlacements: REFERENCE_GAP,
          populationRule: entity.data.kind === 'dungeon' ? {
            eligiblePoolSize: entity.data.poolSize,
            eligiblePool: poolLinks.map((link) => `bestiary::${link.entityId}`),
            uniques: uniqueMonsterLinks.map((link) => `bestiary::${link.entityId}`),
            selection: 'Distinct eligible types are drawn without replacement after forced types.',
            registeredTypeCap: 24,
            cumulativeImageBudget: 4000,
            depth16Exception: entity.data.depth === 16 ? 'The random draw is skipped in favor of a fixed roster.' : 'not applicable',
          } : REFERENCE_GAP,
          quests: questLinks.map((link) => `quests::${link.entityId}`),
        },
        links: encounterLinks,
        [SOURCED_FIELD]: stamp(entity, ['poolSize', 'links[role=spawns]', 'links[role=unique]', 'links[role=hosts-quest]', '(law d1-monster-type-selection)', '(law d1-unique-placement)']),
      },
      gaps: [
        'hostedArena: Diablo I locations do not declare PoF combat-map arena entities',
        'packPlacements: the table pool and engine rules do not choose one game seed or provide stable encounter coordinates',
        'wiringContract: the reference engine does not define PoF registration, activation, dependencies, or verification',
      ],
    },
  ];
}
