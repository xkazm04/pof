/** Diablo I behavior state graphs derived from engine enums and transition call sites. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { DIABLO1_STATE_GRAPH_LAWS, STATE_GRAPH_SPECS_DATA } from '@/lib/catalog/reference/stateGraphSpecsData';

export interface StateGraphStateData {
  id: string;
  meaning: string;
  durationRule: string;
  refs: readonly string[];
  terminal?: boolean;
}

export interface StateGraphTransitionData {
  from: string;
  to: string;
  trigger: string;
  refs: readonly string[];
}

export interface StateGraphOverlayData {
  rootState: string;
  states: readonly StateGraphStateData[];
  transitions: readonly StateGraphTransitionData[];
}

export interface StateGraphPersistenceData {
  field: string;
  saved: boolean;
  rationale: string;
  refs: readonly string[];
}

export interface StateGraphSpecData {
  id: 'd1-state-monster' | 'd1-state-player';
  name: string;
  actor: 'monster' | 'player';
  rootState: string;
  states: readonly StateGraphStateData[];
  transitions: readonly StateGraphTransitionData[];
  goalOverlay?: StateGraphOverlayData;
  persistence: readonly StateGraphPersistenceData[];
  lawBody: string;
  refs: readonly string[];
  hellfireNote: string;
}

export type StateGraphSpec = StateGraphSpecData;
export const STATE_GRAPH_SPECS: readonly StateGraphSpec[] = STATE_GRAPH_SPECS_DATA;

export { DIABLO1_STATE_GRAPH_LAWS };

const NON_FILLABLE_STEP_GAPS = {
  'Blackboard Schema': 'Diablo I stores actor fields and per-AI variables directly; it has no generic seven-key typed blackboard with declared writers and readers.',
  'Hook Points': 'Mode functions call animation, sound, missile, and quest operations imperatively; the engine has no generalized five-hook ENTER/EXIT binding layer.',
  'Icon 2D Art': 'The mode enums and transition code provide no generated icon candidates or selected state-graph texture.',
  'Test Gate': 'The pinned engine supplies update behavior, not a registered PoF UE automation test.',
  'UE Packaging': 'The reference has no PoF StateTree, BlackboardData, DataTable row, UE asset paths, or wiring contract.',
} as const;

export interface PipelineGraphShape {
  nodes: Array<{ id: string; label: string; terminal?: boolean }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

/** Project an engine graph into the exact node/edge shape read by state-graph's graphValid checker. */
export function stateGraphShape(
  graph: Pick<StateGraphSpecData, 'states' | 'transitions'>,
): PipelineGraphShape {
  return {
    nodes: graph.states.map((candidate) => ({
      id: candidate.id,
      label: `${candidate.id} — ${candidate.meaning} Duration: ${candidate.durationRule}`,
      ...(candidate.terminal ? { terminal: true } : {}),
    })),
    edges: graph.transitions.map((candidate) => ({
      from: candidate.from,
      to: candidate.to,
      label: candidate.trigger,
    })),
  };
}

const sourceFiles = (spec: StateGraphSpec): string => [...new Set([
  ...spec.refs,
  ...spec.states.flatMap((candidate) => candidate.refs),
  ...spec.transitions.flatMap((candidate) => candidate.refs),
  ...(spec.goalOverlay?.states.flatMap((candidate) => candidate.refs) ?? []),
  ...(spec.goalOverlay?.transitions.flatMap((candidate) => candidate.refs) ?? []),
  ...spec.persistence.flatMap((candidate) => candidate.refs),
])].map((reference) => {
  const match = /^\.reference\/devilutionX\/(Source\/.+?)(?::\d+)$/.exec(reference);
  return match ? `engine: ${match[1]}` : reference;
}).filter((value, index, all) => all.indexOf(value) === index).join(', ');

export type StateGraphCatalogEntity = IngestedEntity;
export interface StateGraphEntityWrapper { catalogId: 'state-graph'; entity: StateGraphCatalogEntity }

/** Two code-owned pseudo-wrappers: runtime state machines, not authored generic graph assets. */
export function stateGraphEntities(): StateGraphEntityWrapper[] {
  return STATE_GRAPH_SPECS.map((spec) => ({
    catalogId: 'state-graph',
    entity: {
      id: spec.id,
      catalogId: 'state-graph',
      name: spec.name,
      categoryPath: ['Diablo I', 'Engine state machines'],
      tags: ['diablo-state-graph', spec.actor, 'engine-derived'],
      lifecycle: 'planned',
      data: {
        actor: spec.actor,
        rootState: spec.rootState,
        states: spec.states,
        transitions: spec.transitions,
        ...(spec.goalOverlay ? { goalOverlay: spec.goalOverlay } : {}),
        persistence: spec.persistence,
        hellfireNote: spec.hellfireNote,
        stepGaps: NON_FILLABLE_STEP_GAPS,
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1.game,
        sourceProject: DIABLO1.project,
        sourceFile: sourceFiles(spec),
        sourceRow: `${spec.actor} mode enum and transition call sites (engine-derived)`,
        licenceNote: DIABLO1.licenceNote,
        ingestedAt: '2026-09-27T00:00:00.000Z',
        canonProfile: DIABLO1.canonProfile,
      },
    },
  }));
}

const specFor = (entityId: string): StateGraphSpec => {
  const spec = STATE_GRAPH_SPECS.find((candidate) => candidate.id === entityId);
  if (!spec) throw new Error(`no Diablo I state-graph specification for ${entityId}`);
  return spec;
};

const stamp = (entity: StateGraphCatalogEntity, columns: string[]): SourcedStamp => ({
  sourceGame: entity.provenance.sourceGame,
  sourceFile: entity.provenance.sourceFile,
  sourceRow: entity.provenance.sourceRow,
  columns,
});

const briefFor = (spec: StateGraphSpec): string =>
  `${spec.name} is an engine-derived runtime state machine, reconstructed from the pinned enum, `
  + `mode assignments, start functions, and per-mode update dispatch rather than from an authored generic graph asset. `
  + `${spec.lawBody} Each state records its engine meaning and duration rule, and every transition names the event or condition `
  + `at its call site. Save/load behavior is recorded separately so runtime persistence is not guessed from the graph shape.`;

/** Seed only the state-graph steps whose data shapes the engine graph can actually fill. */
export function seedStateGraphSteps(entity: StateGraphCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'state-graph' || !entity.id.startsWith('d1-state-')) return [];
  const spec = specFor(entity.id);
  const sourceStamp = (columns: string[]) => ({ [SOURCED_FIELD]: stamp(entity, columns) });
  const graph = stateGraphShape(spec);
  const goalOverlay = spec.goalOverlay ? stateGraphShape(spec.goalOverlay) : undefined;

  return [
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'Concept Brief',
      data: { brief: briefFor(spec), ...sourceStamp(['enum', 'start functions', 'mode update dispatch', `(law ${spec.id}-law)`]) },
      gaps: [],
    },
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'State Graph',
      data: {
        graph,
        ...(goalOverlay ? { goalOverlay } : {}),
        ...sourceStamp(['states[].id', 'states[].meaning', 'states[].durationRule', 'transitions[]']),
      },
      gaps: [
        'wiringContract: Diablo I owns this imperative runtime graph directly; it has no PoF UStateTreeComponent, BlackboardData asset, or UE verification binding',
      ],
    },
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'Transition Rules',
      data: {
        transitions: spec.transitions.map((candidate) => ({
          from: candidate.from,
          to: candidate.to,
          guard: candidate.trigger,
          priority: REFERENCE_GAP,
          ueConditionType: REFERENCE_GAP,
          refs: candidate.refs,
        })),
        ...(spec.goalOverlay ? {
          goalTransitions: spec.goalOverlay.transitions.map((candidate) => ({
            from: candidate.from,
            to: candidate.to,
            guard: candidate.trigger,
            priority: REFERENCE_GAP,
            ueConditionType: REFERENCE_GAP,
            refs: candidate.refs,
          })),
        } : {}),
        ...sourceStamp(['transitions[].from', 'transitions[].to', 'transitions[].trigger', 'transitions[].refs']),
      },
      gaps: [
        'ueConditionType: these transitions are C++ assignments and function calls, not UStateTreeCondition classes',
        'priority: event dispatch and imperative call order do not provide one declarative priority field shared by every transition',
        'wiringContract: the reference engine has no PoF transition DataTable or UStateTreeComponent evaluator',
      ],
    },
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'Persistence',
      data: {
        persistence: spec.persistence.map((candidate) => ({
          field: candidate.field,
          saved: candidate.saved,
          rationale: candidate.rationale,
          refs: candidate.refs,
        })),
        ...sourceStamp(['save/load mode fields', 'animation cursor', 'action/goal companions']),
      },
      gaps: [
        'wiringContract: persistence is the engine save format, not AARPGWorldStateComponent or a PoF SaveGame mutation',
      ],
    },
  ];
}
