/** Diablo I object operations derived from engine dispatch rather than from objdat.tsv values. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { DIABLO1_OBJECT_LAWS, OBJECT_SPECS_DATA, SHRINE_EFFECTS_DATA } from '@/lib/catalog/reference/objectSpecsData';

export type ObjectId = `OBJ_${string}`;

export interface ObjectSpecData {
  kind: string;
  objects: readonly ObjectId[];
  operate: string;
  drops: string;
  trap: string;
  /** Whether the ordinary operation/destruction consumes this object after one use. */
  once: boolean;
  refs: readonly string[];
}

export interface ShrineEffectData {
  shrine: string;
  effect: string;
  duration: 'permanent' | 'timed' | 'instant';
  refs: readonly string[];
}

export const OBJECT_SPECS: readonly ObjectSpecData[] = OBJECT_SPECS_DATA;
export const SHRINE_EFFECTS: readonly ShrineEffectData[] = SHRINE_EFFECTS_DATA;

const specByObject = new Map<string, ObjectSpecData>();
for (const spec of OBJECT_SPECS) {
  for (const object of spec.objects) {
    const prior = specByObject.get(object);
    if (prior) throw new Error(`${object} belongs to both object kinds ${prior.kind} and ${spec.kind}`);
    specByObject.set(object, spec);
  }
}

export function objectSpecFor(objectId: string): ObjectSpecData | undefined {
  return specByObject.get(objectId);
}

/** Add the engine-derived kind only at promotion; the reusable wrapper remains a table projection. */
export function withObjectSpecs(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'props' || wrapper.file !== 'objects/objdat.tsv') return wrapper;
    const objectId = wrapper.raw.id;
    const spec = objectSpecFor(objectId);
    if (!spec) throw new Error(`${wrapper.wrapperId}: no engine-derived object spec for ${objectId || '(blank id)'}`);
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: { ...wrapper.entity.data, kind: spec.kind },
      },
    };
  });
}

export { DIABLO1_OBJECT_LAWS };

const BREAKABLE_KINDS = new Set(['barrel', 'explosive-container', 'crucifix']);

function stamp(wrapper: ReferenceWrapper, spec: ObjectSpecData, columns: string[]): SourcedStamp {
  const provenance = wrapper.entity.provenance;
  return {
    sourceGame: provenance.sourceGame,
    sourceFile: `${provenance.sourceFile}; Source/objects.cpp`,
    sourceRow: provenance.sourceRow,
    columns: [...columns, ...spec.refs.map((ref) => `(engine ${ref})`)],
  };
}

/** Seed only the prop steps stated by objdat plus the engine-derived operation specification. */
export function seedObjectSteps(wrapper: ReferenceWrapper): StepSeed[] {
  if (wrapper.catalogId !== 'props' || wrapper.file !== 'objects/objdat.tsv') return [];
  const spec = objectSpecFor(wrapper.raw.id);
  if (!spec) throw new Error(`${wrapper.wrapperId}: no engine-derived object spec for ${wrapper.raw.id || '(blank id)'}`);

  const seeds: StepSeed[] = [{
    catalogId: 'props', entityId: wrapper.entity.id, step: 'Interaction',
    data: {
      interaction: {
        interactType: spec.kind,
        triggerCondition: spec.operate,
        prompt: REFERENCE_GAP,
        healthThreshold: BREAKABLE_KINDS.has(spec.kind)
          ? 'One qualifying hit breaks it; Diablo I objects do not use a hit-point threshold.'
          : 'Not governed by object hit points.',
        once: spec.once,
        drops: spec.drops,
        trap: spec.trap,
      },
      [SOURCED_FIELD]: stamp(wrapper, spec, ['id', 'flags', '(law d1-object-operation-law)', '(law d1-object-trap-law)']),
    },
    gaps: [
      'prompt: objdat has a selection region but no player-facing input prompt',
      'wiringContract: the reference engine does not define PoF components, input bindings, dependencies, or verification',
    ],
  }];

  if (BREAKABLE_KINDS.has(spec.kind)) {
    seeds.push({
      catalogId: 'props', entityId: wrapper.entity.id, step: 'Destruction States',
      data: {
        destructionStates: {
          intact: { selectable: true, behavior: 'The engine accepts a qualifying break attack.' },
          damaged: REFERENCE_GAP,
          destroyed: { selectable: false, behavior: spec.operate, drops: spec.drops },
        },
        [SOURCED_FIELD]: stamp(wrapper, spec, ['flags[Breakable]', '(engine break dispatch)']),
      },
      gaps: [
        'damaged: Diablo I has only intact and broken object states, with no partial-health state',
        'wiringContract: the reference engine has no PoF destruction actor, gameplay tags, geometry collection, or verification path',
      ],
    });
  }

  if (spec.drops !== 'None.') {
    seeds.push({
      catalogId: 'props', entityId: wrapper.entity.id, step: 'Loot on Destroy',
      data: {
        lootOnDestroy: {
          lootTable: 'engine-owned item-generation procedure',
          ilvlSource: 'Current dungeon context, except where the object specification names a fixed quest item.',
          dropCount: spec.drops,
          trigger: spec.operate,
        },
        links: [],
        [SOURCED_FIELD]: stamp(wrapper, spec, ['(law d1-container-drop-law)', '(engine drop routine)']),
      },
      gaps: [
        'lootTable: Diablo I calls item-generation procedures and has no source row that maps to a PoF loot-tables entity',
        'links: no resolvable PoF loot-table link can be inferred from an engine procedure',
        'wiringContract: the reference engine does not define PoF loot components, activation wiring, dependencies, or verification',
        ...(BREAKABLE_KINDS.has(spec.kind) ? [] : ['step trigger: this prop drops on operation, but the PoF pipeline names the step Loot on Destroy']),
      ],
    });
  }

  return seeds;
}
