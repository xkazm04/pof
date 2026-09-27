/** Per-routine Diablo I decisions made while MonsterMode::Stand is active. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import {
  D1_AI_DECISION_GRAPHS_DATA,
  type AiDecisionGraphData,
  type AiGraphActionCategory,
  type AiGraphActionMode,
  type AiGraphBandRole,
  type AiGraphRollRef,
  type AiGraphTree,
} from '@/lib/catalog/reference/aiDecisionGraphsData';
import {
  D1_AI_ROUTINES,
  isD1AiRoutineId,
  type AiRollChance,
  type D1AiRoutineId,
} from '@/lib/catalog/reference/aiRoutines';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type AiDecisionKind = 'distance' | 'roll' | 'roll-bands' | 'previous-mode' | 'condition';

export interface AiDecisionNode {
  id: string;
  kind: 'decision';
  decision: AiDecisionKind;
  label: string;
}

export interface AiActionNode {
  id: string;
  kind: 'action';
  label: string;
  action: AiGraphActionMode;
  category: AiGraphActionCategory;
  terminal: true;
  pause?: { readonly base: number; readonly perIntelligence: number; readonly randomMax: number };
  pauseSource?: { routine: D1AiRoutineId; rollIndex: number };
}

export type AiDecisionGraphNode = AiDecisionNode | AiActionNode;
export type AiChanceOutcome = 'success' | 'failure' | 'absolute-band' | 'remainder';

export interface AiDecisionEdge {
  from: string;
  to: string;
  label: string;
  condition: string;
  /** The exact object owned by D1_AI_ROUTINES; no probability is copied into graph data. */
  chance?: AiRollChance;
  chanceOutcome?: AiChanceOutcome;
  /** Other table chances subtracted by a shared-roll remainder edge. */
  relatedChances?: readonly AiRollChance[];
  rollSource?: { routine: D1AiRoutineId; rollIndex: number };
}

export interface AiProfileEntrypoint {
  nodeId: string;
  band: string;
  context: string;
  role: AiGraphBandRole;
  primary: boolean;
}

export interface AiDecisionGraph {
  id: string;
  routine: D1AiRoutineId;
  lawId: string;
  root: 'Stand';
  nodes: readonly AiDecisionGraphNode[];
  edges: readonly AiDecisionEdge[];
  profileEntrypoints: readonly AiProfileEntrypoint[];
  sourceRefs: readonly string[];
  findings: readonly string[];
}

const chanceText = (chance: AiRollChance): string => {
  if ('linear' in chance) {
    const { perIntelligence, base } = chance.linear;
    return `(${perIntelligence}*intelligence+${base})%`;
  }
  return chance.expression;
};

const slugRoutine = (routine: string): string => routine === 'FireMan'
  ? 'fireman'
  : routine.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function aiDecisionGraphEntityId(routine: D1AiRoutineId): string {
  return `d1-ai-${slugRoutine(routine)}`;
}

const resolveRoll = (owner: D1AiRoutineId, rollRef: AiGraphRollRef) => {
  const routineName = rollRef.routine ?? owner;
  if (!isD1AiRoutineId(routineName)) throw new Error(`AI graph ${owner} references unknown routine ${routineName}`);
  const entry = D1_AI_ROUTINES[routineName].rolls[rollRef.index];
  if (!entry) throw new Error(`AI graph ${owner} references missing ${routineName} roll ${rollRef.index}`);
  return { routine: routineName, index: rollRef.index, entry };
};

function compileGraph(routine: D1AiRoutineId, data: AiDecisionGraphData): AiDecisionGraph {
  const nodes: AiDecisionGraphNode[] = [{ id: 'Stand', kind: 'decision', decision: 'distance', label: 'Stand' }];
  const edges: AiDecisionEdge[] = [];
  const profileEntrypoints: AiProfileEntrypoint[] = [];
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${sequence++}`;

  const compileTree = (tree: AiGraphTree): string => {
    if (tree.kind === 'action') {
      const id = nextId(`action-${tree.mode.toLowerCase()}`);
      const pauseSource = tree.pause ? resolveRoll(routine, tree.pause) : undefined;
      nodes.push({
        id,
        kind: 'action',
        label: tree.note ? `${tree.mode} — ${tree.note}` : tree.mode,
        action: tree.mode,
        category: tree.category,
        terminal: true,
        ...(pauseSource?.entry.pause ? { pause: pauseSource.entry.pause } : {}),
        ...(pauseSource ? { pauseSource: { routine: pauseSource.routine, rollIndex: pauseSource.index } } : {}),
      });
      return id;
    }

    if (tree.kind === 'test') {
      const id = nextId(`test-${tree.test}`);
      nodes.push({ id, kind: 'decision', decision: tree.test, label: tree.label });
      for (const branch of tree.branches) {
        const to = compileTree(branch.result);
        edges.push({ from: id, to, label: branch.condition, condition: branch.condition });
      }
      return id;
    }

    if (tree.kind === 'roll') {
      const source = resolveRoll(routine, tree.roll);
      const id = nextId('roll');
      nodes.push({ id, kind: 'decision', decision: 'roll', label: source.entry.when });
      const success = compileTree(tree.success);
      const failure = compileTree(tree.failure);
      const rollSource = { routine: source.routine, rollIndex: source.index };
      edges.push({
        from: id,
        to: success,
        label: `${source.entry.onSuccess} [${chanceText(source.entry.chance)}]`,
        condition: source.entry.onSuccess,
        chance: source.entry.chance,
        chanceOutcome: 'success',
        rollSource,
      });
      edges.push({
        from: id,
        to: failure,
        label: `${source.entry.onFail} [not ${chanceText(source.entry.chance)}]`,
        condition: source.entry.onFail,
        chance: source.entry.chance,
        chanceOutcome: 'failure',
        rollSource,
      });
      return id;
    }

    const sources = tree.bands.map((band) => resolveRoll(routine, band.roll));
    if (sources.length === 0) throw new Error(`AI graph ${routine} has an empty shared-roll band`);
    const id = nextId('roll-bands');
    nodes.push({ id, kind: 'decision', decision: 'roll-bands', label: sources.map((source) => source.entry.when).join(' / ') });
    for (let index = 0; index < tree.bands.length; index++) {
      const source = sources[index];
      const to = compileTree(tree.bands[index].result);
      edges.push({
        from: id,
        to,
        label: `${source.entry.onSuccess} [band ${chanceText(source.entry.chance)}]`,
        condition: source.entry.onSuccess,
        chance: source.entry.chance,
        chanceOutcome: 'absolute-band',
        rollSource: { routine: source.routine, rollIndex: source.index },
      });
    }
    const remainder = compileTree(tree.remainder);
    edges.push({
      from: id,
      to: remainder,
      label: `No shared-roll band matched [remainder after ${sources.map((source) => chanceText(source.entry.chance)).join(' + ')}]`,
      condition: 'No shared-roll band matched',
      chance: sources[0].entry.chance,
      relatedChances: sources.slice(1).map((source) => source.entry.chance),
      chanceOutcome: 'remainder',
      rollSource: { routine: sources[0].routine, rollIndex: sources[0].index },
    });
    return id;
  };

  for (let bandIndex = 0; bandIndex < data.bands.length; bandIndex++) {
    const band = data.bands[bandIndex];
    const distanceRoutine = band.distanceRoutine ?? routine;
    if (!isD1AiRoutineId(distanceRoutine)) throw new Error(`AI graph ${routine} references unknown distance routine ${distanceRoutine}`);
    const distance = band.distance === undefined ? undefined : D1_AI_ROUTINES[distanceRoutine].distances[band.distance];
    if (band.distance !== undefined && !distance) throw new Error(`AI graph ${routine} references missing distance ${band.distance}`);
    const bandLabel = distance ? `${distance.name}: ${distance.tiles}` : band.label;
    if (!bandLabel) throw new Error(`AI graph ${routine} band ${bandIndex} has no label`);
    const bandNodeId = nextId('band');
    nodes.push({
      id: bandNodeId,
      kind: 'decision',
      decision: band.scenarioTest ?? 'condition',
      label: bandLabel,
    });
    edges.push({ from: 'Stand', to: bandNodeId, label: bandLabel, condition: bandLabel });
    for (const scenario of band.scenarios) {
      const treeNodeId = compileTree(scenario.tree);
      edges.push({ from: bandNodeId, to: treeNodeId, label: scenario.context, condition: scenario.context });
      profileEntrypoints.push({
        nodeId: treeNodeId,
        band: bandLabel,
        context: scenario.context,
        role: band.role,
        primary: scenario.primary ?? false,
      });
    }
  }

  return {
    id: aiDecisionGraphEntityId(routine),
    routine,
    lawId: D1_AI_ROUTINES[routine].lawId,
    root: 'Stand',
    nodes,
    edges,
    profileEntrypoints,
    sourceRefs: data.sourceRefs,
    findings: data.findings ?? [],
  };
}

const dataRoutineIds = Object.keys(D1_AI_DECISION_GRAPHS_DATA);
const tableRoutineIds = Object.keys(D1_AI_ROUTINES);
if (dataRoutineIds.length !== tableRoutineIds.length || tableRoutineIds.some((routine) => !Object.hasOwn(D1_AI_DECISION_GRAPHS_DATA, routine))) {
  throw new Error('D1_AI_DECISION_GRAPHS_DATA must define exactly one graph for every D1 AI routine');
}

export const D1_AI_DECISION_GRAPHS = Object.fromEntries(
  tableRoutineIds.map((routine) => {
    if (!isD1AiRoutineId(routine)) throw new Error(`unexpected AI routine ${routine}`);
    return [routine, compileGraph(routine, D1_AI_DECISION_GRAPHS_DATA[routine])];
  }),
) as Record<D1AiRoutineId, AiDecisionGraph>;

export const D1_AI_DECISION_GRAPH_FINDINGS = Object.values(D1_AI_DECISION_GRAPHS)
  .flatMap((graph) => graph.findings.map((finding) => ({ routine: graph.routine, finding })));

export type EvaluatedValue =
  | { status: 'evaluated'; value: number }
  | { status: 'unevaluated'; expressions: readonly string[] };

export type AiActionMix = Record<AiGraphActionCategory, number>;

export interface AiDistancePersonality {
  band: string;
  context: string;
  role: AiGraphBandRole;
  primary: boolean;
  actionMix: { status: 'evaluated'; value: AiActionMix } | { status: 'unevaluated'; expressions: readonly string[] };
  /** Normal and special offensive actions; tactical/healing `special` actions are excluded. */
  attackProbability: EvaluatedValue;
  expectedPauseTicks: EvaluatedValue;
}

export interface AiPersonalityProfile {
  routine: D1AiRoutineId;
  intelligence: number;
  bands: readonly AiDistancePersonality[];
  aggression: EvaluatedValue;
  approachRate: EvaluatedValue;
  patienceTicks: EvaluatedValue;
}

interface InternalEvaluation {
  mix?: AiActionMix;
  offensive?: number;
  pause?: number;
  mixUnknown: string[];
  offensiveUnknown: string[];
  pauseUnknown: string[];
}

const emptyMix = (): AiActionMix => ({ attack: 0, approach: 0, wait: 0, special: 0 });
const unique = (values: readonly string[]) => [...new Set(values)];
const equalNumber = (left: number | undefined, right: number | undefined) => left !== undefined && right !== undefined && Math.abs(left - right) < 1e-12;
const equalMix = (left: AiActionMix | undefined, right: AiActionMix | undefined) => left !== undefined && right !== undefined
  && (Object.keys(left) as AiGraphActionCategory[]).every((key) => equalNumber(left[key], right[key]));

const chanceProbability = (chance: AiRollChance, intelligence: number): number | undefined => {
  if (!('linear' in chance)) return undefined;
  return Math.max(0, Math.min(1, (chance.linear.perIntelligence * intelligence + chance.linear.base) / 100));
};

const weighted = (parts: readonly { weight: number; result: InternalEvaluation }[]): InternalEvaluation => {
  const mixAvailable = parts.every((part) => part.result.mix !== undefined);
  const offensiveAvailable = parts.every((part) => part.result.offensive !== undefined);
  const pauseAvailable = parts.every((part) => part.result.pause !== undefined);
  const mix = mixAvailable ? emptyMix() : undefined;
  if (mix) {
    for (const part of parts) {
      for (const key of Object.keys(mix) as AiGraphActionCategory[]) mix[key] += part.weight * part.result.mix![key];
    }
  }
  return {
    ...(mix ? { mix } : {}),
    ...(offensiveAvailable ? { offensive: parts.reduce((sum, part) => sum + part.weight * part.result.offensive!, 0) } : {}),
    ...(pauseAvailable ? { pause: parts.reduce((sum, part) => sum + part.weight * part.result.pause!, 0) } : {}),
    mixUnknown: unique(parts.flatMap((part) => part.result.mixUnknown)),
    offensiveUnknown: unique(parts.flatMap((part) => part.result.offensiveUnknown)),
    pauseUnknown: unique(parts.flatMap((part) => part.result.pauseUnknown)),
  };
};

const OFFENSIVE_ACTIONS = new Set<AiGraphActionMode>([
  'MeleeAttack', 'RangedAttack', 'SpecialMeleeAttack', 'SpecialRangedAttack', 'Charge',
]);

/** Evaluate graph branches only; expression chances and unweighted condition forks stay explicitly unevaluated. */
export function evaluateAiDecisionGraph(graph: AiDecisionGraph, intelligence: number): AiDistancePersonality[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByFrom = new Map<string, AiDecisionEdge[]>();
  for (const edge of graph.edges) edgesByFrom.set(edge.from, [...(edgesByFrom.get(edge.from) ?? []), edge]);
  const active = new Set<string>();

  const evaluateNode = (nodeId: string): InternalEvaluation => {
    if (active.has(nodeId)) throw new Error(`AI graph ${graph.routine} contains a cycle at ${nodeId}`);
    const node = nodeById.get(nodeId);
    if (!node) throw new Error(`AI graph ${graph.routine} references missing node ${nodeId}`);
    if (node.kind === 'action') {
      const mix = emptyMix();
      mix[node.category] = 1;
      const offensive = OFFENSIVE_ACTIONS.has(node.action) ? 1 : 0;
      if (node.action !== 'Delay') return { mix, offensive, pause: 0, mixUnknown: [], offensiveUnknown: [], pauseUnknown: [] };
      if (!node.pause) return { mix, offensive, mixUnknown: [], offensiveUnknown: [], pauseUnknown: [`${node.label}: no structured pause in D1_AI_ROUTINES`] };
      const pause = Math.max(0, node.pause.base - node.pause.perIntelligence * intelligence) + node.pause.randomMax / 2;
      return { mix, offensive, pause, mixUnknown: [], offensiveUnknown: [], pauseUnknown: [] };
    }

    active.add(nodeId);
    const outgoing = edgesByFrom.get(nodeId) ?? [];
    let result: InternalEvaluation;
    if (node.decision === 'roll') {
      const success = outgoing.find((edge) => edge.chanceOutcome === 'success');
      const failure = outgoing.find((edge) => edge.chanceOutcome === 'failure');
      if (!success?.chance || !failure) throw new Error(`AI graph ${graph.routine} has malformed roll node ${nodeId}`);
      const successResult = evaluateNode(success.to);
      const failureResult = evaluateNode(failure.to);
      const probability = chanceProbability(success.chance, intelligence);
      if (probability !== undefined) {
        result = weighted([{ weight: probability, result: successResult }, { weight: 1 - probability, result: failureResult }]);
      } else {
        const expression = chanceText(success.chance);
        result = {
          ...(equalMix(successResult.mix, failureResult.mix) ? { mix: successResult.mix } : {}),
          ...(equalNumber(successResult.offensive, failureResult.offensive) ? { offensive: successResult.offensive } : {}),
          ...(equalNumber(successResult.pause, failureResult.pause) ? { pause: successResult.pause } : {}),
          mixUnknown: equalMix(successResult.mix, failureResult.mix) ? [] : unique([expression, ...successResult.mixUnknown, ...failureResult.mixUnknown]),
          offensiveUnknown: equalNumber(successResult.offensive, failureResult.offensive) ? [] : unique([expression, ...successResult.offensiveUnknown, ...failureResult.offensiveUnknown]),
          pauseUnknown: equalNumber(successResult.pause, failureResult.pause) ? [] : unique([expression, ...successResult.pauseUnknown, ...failureResult.pauseUnknown]),
        };
      }
    } else if (node.decision === 'roll-bands') {
      const bandEdges = outgoing.filter((edge) => edge.chanceOutcome === 'absolute-band');
      const remainder = outgoing.find((edge) => edge.chanceOutcome === 'remainder');
      if (!remainder || bandEdges.some((edge) => !edge.chance)) throw new Error(`AI graph ${graph.routine} has malformed shared-roll node ${nodeId}`);
      const probabilities = bandEdges.map((edge) => chanceProbability(edge.chance!, intelligence));
      if (probabilities.every((probability) => probability !== undefined)) {
        const numeric = probabilities as number[];
        const remainderProbability = Math.max(0, 1 - numeric.reduce((sum, probability) => sum + probability, 0));
        result = weighted([
          ...bandEdges.map((edge, index) => ({ weight: numeric[index], result: evaluateNode(edge.to) })),
          { weight: remainderProbability, result: evaluateNode(remainder.to) },
        ]);
      } else {
        const expressions = bandEdges.filter((edge) => edge.chance).map((edge) => chanceText(edge.chance!));
        result = { mixUnknown: expressions, offensiveUnknown: expressions, pauseUnknown: expressions };
      }
    } else {
      const branches = outgoing.map((edge) => evaluateNode(edge.to));
      if (branches.length === 1) result = branches[0];
      else {
        const first = branches[0];
        const label = `${node.decision}: ${node.label}`;
        result = {
          ...(branches.length > 0 && branches.every((branch) => equalMix(first.mix, branch.mix)) ? { mix: first.mix } : {}),
          ...(branches.length > 0 && branches.every((branch) => equalNumber(first.offensive, branch.offensive)) ? { offensive: first.offensive } : {}),
          ...(branches.length > 0 && branches.every((branch) => equalNumber(first.pause, branch.pause)) ? { pause: first.pause } : {}),
          mixUnknown: branches.length > 0 && branches.every((branch) => equalMix(first.mix, branch.mix)) ? [] : unique([label, ...branches.flatMap((branch) => branch.mixUnknown)]),
          offensiveUnknown: branches.length > 0 && branches.every((branch) => equalNumber(first.offensive, branch.offensive)) ? [] : unique([label, ...branches.flatMap((branch) => branch.offensiveUnknown)]),
          pauseUnknown: branches.length > 0 && branches.every((branch) => equalNumber(first.pause, branch.pause)) ? [] : unique([label, ...branches.flatMap((branch) => branch.pauseUnknown)]),
        };
      }
    }
    active.delete(nodeId);
    return result;
  };

  return graph.profileEntrypoints.map((entrypoint) => {
    const result = evaluateNode(entrypoint.nodeId);
    return {
      ...entrypoint,
      actionMix: result.mix
        ? { status: 'evaluated' as const, value: result.mix }
        : { status: 'unevaluated' as const, expressions: unique(result.mixUnknown) },
      attackProbability: result.offensive !== undefined
        ? { status: 'evaluated' as const, value: result.offensive }
        : { status: 'unevaluated' as const, expressions: unique(result.offensiveUnknown) },
      expectedPauseTicks: result.pause !== undefined
        ? { status: 'evaluated' as const, value: result.pause }
        : { status: 'unevaluated' as const, expressions: unique(result.pauseUnknown) },
    };
  });
}

const unknownMetric = (reason: string): EvaluatedValue => ({ status: 'unevaluated', expressions: [reason] });

const primaryBand = (bands: readonly AiDistancePersonality[], role: AiGraphBandRole): AiDistancePersonality | undefined =>
  bands.find((band) => band.role === role && band.primary) ?? bands.find((band) => band.role === role);

/** Designer-facing expected action mix, conditional on each graph distance/context entrypoint. */
export function aiPersonality(routine: D1AiRoutineId | string, intelligence: number): AiPersonalityProfile {
  if (!isD1AiRoutineId(routine)) throw new Error(`AI routine "${routine}" is not in the engine-derived routine table`);
  if (!Number.isInteger(intelligence) || intelligence < 0 || intelligence > 3) throw new Error('AI intelligence must be an integer from 0 through 3');
  const bands = evaluateAiDecisionGraph(D1_AI_DECISION_GRAPHS[routine], intelligence);
  const adjacent = primaryBand(bands, 'adjacent');
  const range = primaryBand(bands, 'range');
  const aggression = adjacent?.attackProbability ?? unknownMetric('no adjacent action band');
  const approachRate = range?.actionMix.status === 'evaluated'
    ? { status: 'evaluated' as const, value: range.actionMix.value.approach }
    : range?.actionMix ?? unknownMetric('no range action band');
  const patienceTicks = range?.expectedPauseTicks ?? adjacent?.expectedPauseTicks ?? unknownMetric('no combat distance band');
  return { routine, intelligence, bands, aggression, approachRate, patienceTicks };
}

export type AiDecisionGraphCatalogEntity = IngestedEntity;
export interface AiDecisionGraphEntityWrapper { catalogId: 'state-graph'; entity: AiDecisionGraphCatalogEntity }

const AI_STEP_GAPS = {
  'Blackboard Schema': 'The routine reads Monster fields directly; the pinned engine declares no generic typed blackboard schema.',
  'Hook Points': 'Animation, missile, sound, and quest effects are imperative calls rather than generic graph hook bindings.',
  Persistence: 'The Stand decision routine supplies no independent persistence contract beyond the enclosing monster state machine.',
  'Icon 2D Art': 'The engine routine has no generated icon candidates or selected graph texture.',
  'Test Gate': 'The pinned engine supplies behavior, not a registered PoF UE automation test for this routine graph.',
  'UE Packaging': 'The reference has no PoF StateTree asset, BlackboardData asset, DataTable row, or UE package path.',
} as const;

const sourceFiles = (graph: AiDecisionGraph): string => [...new Set(graph.sourceRefs.map((reference) => {
  const match = /^\.reference\/devilutionX\/(Source\/.+?)(?::\d+)$/.exec(reference);
  return match ? `engine: ${match[1]}` : reference;
}))].join(', ');

const MONSTER_FILES = new Set(['monsters/monstdat.tsv', 'monsters/unique_monstdat.tsv']);

/** Graph-owned host links let each bestiary entity discover the routine it runs via an incoming first hop. */
export function aiDecisionGraphEntities(wrappers: readonly ReferenceWrapper[] = []): AiDecisionGraphEntityWrapper[] {
  const monstersByRoutine = new Map<D1AiRoutineId, ReferenceWrapper[]>();
  for (const wrapper of wrappers) {
    if (wrapper.catalogId !== 'bestiary' || !MONSTER_FILES.has(wrapper.file)) continue;
    const routine = wrapper.raw.ai;
    if (!isD1AiRoutineId(routine)) continue;
    monstersByRoutine.set(routine, [...(monstersByRoutine.get(routine) ?? []), wrapper]);
  }

  return Object.values(D1_AI_DECISION_GRAPHS).map((graph) => ({
    catalogId: 'state-graph',
    entity: {
      id: graph.id,
      catalogId: 'state-graph',
      name: `${graph.routine} AI decision graph`,
      categoryPath: ['Diablo I', 'AI decision routines'],
      tags: ['diablo-state-graph', 'monster-ai', 'engine-derived', ...(D1_AI_ROUTINES[graph.routine].hellfire ? ['hellfire'] : [])],
      lifecycle: 'planned',
      links: (monstersByRoutine.get(graph.routine) ?? []).map((monster) => ({
        catalogId: 'bestiary',
        entityId: monster.entity.id,
        role: 'host',
      })),
      data: {
        routine: graph.routine,
        lawId: graph.lawId,
        rootState: graph.root,
        graph,
        findings: graph.findings,
        stepGaps: AI_STEP_GAPS,
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1.game,
        sourceProject: DIABLO1.project,
        sourceFile: sourceFiles(graph),
        sourceRow: `${graph.routine} Stand-mode AI control flow (engine-derived)`,
        licenceNote: DIABLO1.licenceNote,
        ingestedAt: '2026-09-27T00:00:00.000Z',
        canonProfile: DIABLO1.canonProfile,
      },
    },
  }));
}

const graphForEntity = (entity: AiDecisionGraphCatalogEntity): AiDecisionGraph => {
  const routine = entity.data.routine;
  if (typeof routine !== 'string' || !isD1AiRoutineId(routine)) throw new Error(`no Diablo I AI graph for ${entity.id}`);
  return D1_AI_DECISION_GRAPHS[routine];
};

const stamp = (entity: AiDecisionGraphCatalogEntity, columns: string[]): SourcedStamp => ({
  sourceGame: entity.provenance.sourceGame,
  sourceFile: entity.provenance.sourceFile,
  sourceRow: entity.provenance.sourceRow,
  columns,
});

/** State-graph pipeline seeds for the source-owned graph and guards; generic UE fields remain named gaps. */
export function seedAiDecisionGraphSteps(entity: AiDecisionGraphCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'state-graph' || !entity.id.startsWith('d1-ai-')) return [];
  const graph = graphForEntity(entity);
  const sourceStamp = (columns: string[]) => ({ [SOURCED_FIELD]: stamp(entity, columns) });
  const shape = {
    nodes: graph.nodes.map((node) => ({ id: node.id, label: node.label, ...(node.kind === 'action' ? { terminal: true } : {}) })),
    edges: graph.edges.map((edge) => ({ from: edge.from, to: edge.to, label: edge.label })),
  };
  return [
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'Concept Brief',
      data: {
        brief: `${graph.routine} is the engine-derived decision graph evaluated inside MonsterMode::Stand. Distance, prior-mode, goal, and roll tests preserve source order; action nodes are terminal for this one Stand decision. Its probabilities are references to ${graph.lawId}, not copied constants.`,
        ...sourceStamp(['AI dispatch', 'Stand guard', `(law ${graph.lawId})`]),
      },
      gaps: [],
    },
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'State Graph',
      data: {
        graph: shape,
        decisionGraph: graph,
        ...sourceStamp(['decision order', 'distance tests', 'previous-mode tests', 'terminal mode calls']),
      },
      gaps: ['wiringContract: the reference engine evaluates this C++ routine directly and has no PoF UStateTree asset binding'],
    },
    {
      catalogId: 'state-graph', entityId: entity.id, step: 'Transition Rules',
      data: {
        transitions: graph.edges.map((edge) => ({
          from: edge.from,
          to: edge.to,
          guard: edge.chance ? `${edge.condition}; chance ${chanceText(edge.chance)} (${edge.chanceOutcome})` : edge.condition,
          chance: edge.chance ?? REFERENCE_GAP,
          priority: REFERENCE_GAP,
          ueConditionType: REFERENCE_GAP,
          refs: graph.sourceRefs,
        })),
        ...sourceStamp(['branch conditions', 'GenerateRnd/FlipCoin thresholds', 'action calls']),
      },
      gaps: [
        'priority: imperative source order is preserved by the graph, but the engine declares no generic transition-priority field',
        'ueConditionType: C++ branches are not UStateTreeCondition classes',
        'wiringContract: the reference engine has no PoF transition DataTable or UStateTreeComponent evaluator',
      ],
    },
  ];
}
