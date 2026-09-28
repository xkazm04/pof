/** Cross-check the W34 cadence projection against the independently-authored W44 Stand graphs. */
import {
  D1_AI_DECISION_GRAPHS,
  aiPersonality,
  type AiActionNode,
  type AiDecisionEdge,
  type AiDecisionGraph,
  type AiProfileEntrypoint,
} from '@/lib/catalog/reference/aiDecisionGraphs';
import type { AiGraphActionMode, AiGraphBandRole } from '@/lib/catalog/reference/aiDecisionGraphsData';
import { D1_AI_ROUTINES, isD1AiRoutineId, type AiRollChance, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import {
  aiRoutineCadenceStatus,
  aiRoutineLaw,
  expectedTicks,
  timingLaw,
  walkTicksPerStep,
  type BehaviourInput,
} from '@/lib/catalog/reference/behaviourScale';
import { animationEndTick } from '@/lib/catalog/reference/animationTiming';
import { STATE_GRAPH_SPECS_DATA } from '@/lib/catalog/reference/stateGraphSpecsData';

export type AiConsistencyVerdict = 'agree' | 'disagree' | 'not-comparable';

export interface AiConsistencyMetric {
  /** W34 rate in attacks or approach tiles per real second. */
  behaviourPerSecond: number | null;
  /** W44 rate in attacks or approach tiles per real second. */
  decisionGraphPerSecond: number | null;
  /** `decisionGraphPerSecond / behaviourPerSecond`; null when division by zero is undefined. */
  ratio: number | null;
  verdict: AiConsistencyVerdict;
  reason?: string;
}

export interface AiConsistencyFinding {
  incorrectSide: 'behaviourScale' | 'aiDecisionGraphs' | 'undetermined';
  sourceRefs: readonly string[];
  finding: string;
  requiredFix: string;
}

export interface AiConsistencyReport {
  routine: D1AiRoutineId;
  intelligence: number;
  attack: AiConsistencyMetric;
  approach: AiConsistencyMetric;
  verdict: AiConsistencyVerdict;
  findings: readonly AiConsistencyFinding[];
}

/** One independently timed Stand decision, useful for small hand-computed fixtures. */
export interface SyntheticDecisionOutcome {
  probability: number;
  durationTicks: number;
  attacks?: number;
  approaches?: number;
}

export interface SyntheticDecisionRates {
  decisionsPerSecond: number;
  attacksPerSecond: number;
  approachesPerSecond: number;
}

/** Expected action rate for an iid synthetic Stand-decision routine. */
export function syntheticDecisionRates(
  outcomes: readonly SyntheticDecisionOutcome[],
  ticksPerSecond: number,
): SyntheticDecisionRates {
  if (outcomes.length === 0) throw new Error('a synthetic decision routine needs at least one outcome');
  if (!(ticksPerSecond > 0)) throw new Error('ticksPerSecond must be positive');
  const probability = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (outcomes.some((outcome) => outcome.probability < 0 || outcome.durationTicks < 0)) {
    throw new Error('synthetic decision probabilities and durations cannot be negative');
  }
  if (Math.abs(probability - 1) > 1e-12) throw new Error(`synthetic decision probabilities sum to ${probability}, not 1`);
  const ticksPerDecision = outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.durationTicks, 0);
  if (!(ticksPerDecision > 0)) throw new Error('a synthetic decision routine must consume time');
  const decisionsPerSecond = ticksPerSecond / ticksPerDecision;
  return {
    decisionsPerSecond,
    attacksPerSecond: decisionsPerSecond * outcomes.reduce((sum, outcome) => sum + outcome.probability * (outcome.attacks ?? 0), 0),
    approachesPerSecond: decisionsPerSecond * outcomes.reduce((sum, outcome) => sum + outcome.probability * (outcome.approaches ?? 0), 0),
  };
}

export function compareAiRates(behaviourPerSecond: number, decisionGraphPerSecond: number): AiConsistencyMetric {
  if (!Number.isFinite(behaviourPerSecond) || !Number.isFinite(decisionGraphPerSecond) || behaviourPerSecond < 0 || decisionGraphPerSecond < 0) {
    return {
      behaviourPerSecond: Number.isFinite(behaviourPerSecond) ? behaviourPerSecond : null,
      decisionGraphPerSecond: Number.isFinite(decisionGraphPerSecond) ? decisionGraphPerSecond : null,
      ratio: null,
      verdict: 'not-comparable',
      reason: 'both descriptions must produce finite, non-negative rates',
    };
  }
  const bothZero = behaviourPerSecond === 0 && decisionGraphPerSecond === 0;
  const ratio = bothZero ? 1 : behaviourPerSecond === 0 ? null : decisionGraphPerSecond / behaviourPerSecond;
  const relativeDifference = bothZero ? 0 : Math.abs(decisionGraphPerSecond - behaviourPerSecond) / Math.max(behaviourPerSecond, Number.EPSILON);
  return {
    behaviourPerSecond,
    decisionGraphPerSecond,
    ratio,
    verdict: relativeDifference <= 0.1 ? 'agree' : 'disagree',
  };
}

const notComparable = (reason: string, behaviourPerSecond: number | null = null, decisionGraphPerSecond: number | null = null): AiConsistencyMetric => ({
  behaviourPerSecond,
  decisionGraphPerSecond,
  ratio: null,
  verdict: 'not-comparable',
  reason,
});

interface ActionOutcome {
  action: AiActionNode;
  probability: number;
}

type OutcomeEvaluation =
  | { status: 'evaluated'; outcomes: readonly ActionOutcome[] }
  | { status: 'unevaluated'; reasons: readonly string[] };

const chanceProbability = (chance: AiRollChance, intelligence: number): number | undefined => 'linear' in chance
  ? Math.max(0, Math.min(1, (chance.linear.perIntelligence * intelligence + chance.linear.base) / 100))
  : undefined;

const chanceLabel = (chance: AiRollChance): string => 'linear' in chance
  ? `(${chance.linear.perIntelligence}*intelligence+${chance.linear.base})%`
  : chance.expression;

const mergeOutcomes = (parts: readonly { weight: number; outcomes: readonly ActionOutcome[] }[]): ActionOutcome[] => {
  const merged = new Map<string, ActionOutcome>();
  for (const part of parts) {
    for (const outcome of part.outcomes) {
      const pause = outcome.action.pause;
      const key = [outcome.action.action, outcome.action.category, pause?.base, pause?.perIntelligence, pause?.randomMax].join('|');
      const previous = merged.get(key);
      merged.set(key, { action: outcome.action, probability: (previous?.probability ?? 0) + part.weight * outcome.probability });
    }
  }
  return [...merged.values()].filter((outcome) => outcome.probability > 1e-15);
};

const sameOutcomes = (left: readonly ActionOutcome[], right: readonly ActionOutcome[]): boolean => {
  const normalize = (outcomes: readonly ActionOutcome[]) => mergeOutcomes([{ weight: 1, outcomes }])
    .map((outcome) => [outcome.action.action, outcome.action.category, outcome.probability] as const)
    .sort(([leftAction], [rightAction]) => leftAction.localeCompare(rightAction));
  const a = normalize(left);
  const b = normalize(right);
  return a.length === b.length && a.every((entry, index) => entry[0] === b[index][0]
    && entry[1] === b[index][1] && Math.abs(entry[2] - b[index][2]) < 1e-12);
};

const graphOutcomes = (graph: AiDecisionGraph, entrypoint: AiProfileEntrypoint, intelligence: number): OutcomeEvaluation => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map<string, AiDecisionEdge[]>();
  for (const edge of graph.edges) edges.set(edge.from, [...(edges.get(edge.from) ?? []), edge]);
  const active = new Set<string>();

  const evaluate = (nodeId: string): OutcomeEvaluation => {
    if (active.has(nodeId)) throw new Error(`AI graph ${graph.routine} contains a cycle at ${nodeId}`);
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`AI graph ${graph.routine} references missing node ${nodeId}`);
    if (node.kind !== 'decision') return { status: 'evaluated', outcomes: [{ action: node, probability: 1 }] };
    active.add(nodeId);
    const outgoing = edges.get(nodeId) ?? [];
    let result: OutcomeEvaluation;
    if (node.decision === 'roll') {
      const success = outgoing.find((edge) => edge.chanceOutcome === 'success');
      const failure = outgoing.find((edge) => edge.chanceOutcome === 'failure');
      if (!success?.chance || !failure) throw new Error(`AI graph ${graph.routine} has malformed roll ${node.id}`);
      const successResult = evaluate(success.to);
      const failureResult = evaluate(failure.to);
      const probability = chanceProbability(success.chance, intelligence);
      if (successResult.status === 'evaluated' && failureResult.status === 'evaluated' && probability !== undefined) {
        result = { status: 'evaluated', outcomes: mergeOutcomes([
          { weight: probability, outcomes: successResult.outcomes },
          { weight: 1 - probability, outcomes: failureResult.outcomes },
        ]) };
      } else if (successResult.status === 'evaluated' && failureResult.status === 'evaluated' && sameOutcomes(successResult.outcomes, failureResult.outcomes)) {
        result = successResult;
      } else {
        result = { status: 'unevaluated', reasons: [
          ...(probability === undefined ? [chanceLabel(success.chance)] : []),
          ...(successResult.status === 'unevaluated' ? successResult.reasons : []),
          ...(failureResult.status === 'unevaluated' ? failureResult.reasons : []),
        ] };
      }
    } else if (node.decision === 'roll-bands') {
      const bands = outgoing.filter((edge) => edge.chanceOutcome === 'absolute-band');
      const remainder = outgoing.find((edge) => edge.chanceOutcome === 'remainder');
      if (!remainder || bands.some((edge) => !edge.chance)) throw new Error(`AI graph ${graph.routine} has malformed roll bands ${node.id}`);
      const probabilities = bands.map((edge) => chanceProbability(edge.chance!, intelligence));
      const evaluations = [...bands.map((edge) => evaluate(edge.to)), evaluate(remainder.to)];
      if (probabilities.every((value) => value !== undefined) && evaluations.every((value) => value.status === 'evaluated')) {
        const numeric = probabilities as number[];
        result = { status: 'evaluated', outcomes: mergeOutcomes([
          ...numeric.map((weight, index) => ({ weight, outcomes: (evaluations[index] as Extract<OutcomeEvaluation, { status: 'evaluated' }>).outcomes })),
          {
            weight: Math.max(0, 1 - numeric.reduce((sum, value) => sum + value, 0)),
            outcomes: (evaluations.at(-1) as Extract<OutcomeEvaluation, { status: 'evaluated' }>).outcomes,
          },
        ]) };
      } else {
        result = { status: 'unevaluated', reasons: [
          ...bands.flatMap((edge, index) => probabilities[index] === undefined ? [chanceLabel(edge.chance!)] : []),
          ...evaluations.flatMap((evaluation) => evaluation.status === 'unevaluated' ? evaluation.reasons : []),
        ] };
      }
    } else {
      const evaluations = outgoing.map((edge) => evaluate(edge.to));
      const first = evaluations[0];
      if (first?.status === 'evaluated' && evaluations.every((evaluation) => evaluation.status === 'evaluated'
        && sameOutcomes(first.outcomes, evaluation.outcomes))) {
        result = first;
      } else {
        result = { status: 'unevaluated', reasons: [
          `${node.decision}: ${node.label}`,
          ...evaluations.flatMap((evaluation) => evaluation.status === 'unevaluated' ? evaluation.reasons : []),
        ] };
      }
    }
    active.delete(nodeId);
    return result;
  };

  return evaluate(entrypoint.nodeId);
};

const MONSTER_MODE_IDS = new Set(
  STATE_GRAPH_SPECS_DATA.find((spec) => spec.actor === 'monster')?.states.map((state) => state.id) ?? [],
);

const MODE_GRAPH_ID: Record<AiGraphActionMode, string> = {
  Walk: 'MoveNorthwards',
  MeleeAttack: 'MeleeAttack',
  RangedAttack: 'RangedAttack',
  SpecialMeleeAttack: 'SpecialMeleeAttack',
  SpecialRangedAttack: 'SpecialRangedAttack',
  SpecialStand: 'SpecialStand',
  Delay: 'Delay',
  'Stand-idle': 'Stand',
  FadeIn: 'FadeIn',
  FadeOut: 'FadeOut',
  Charge: 'Charge',
  Heal: 'Heal',
  Death: 'Death',
};

const OFFENSIVE_MODES = new Set<AiGraphActionMode>([
  'MeleeAttack', 'RangedAttack', 'SpecialMeleeAttack', 'SpecialRangedAttack', 'Charge',
]);

interface GraphTiming {
  walk: number;
  attack: number;
  special: number;
  intelligence: number;
}

const actionDuration = (action: AiActionNode, timing: GraphTiming): number | undefined => {
  const mode = MODE_GRAPH_ID[action.action];
  if (!MONSTER_MODE_IDS.has(mode)) throw new Error(`W37 monster mode graph has no ${mode} state for ${action.action}`);
  switch (action.action) {
  case 'Stand-idle': return 1;
  case 'Walk': return timing.walk;
  case 'MeleeAttack':
  case 'RangedAttack': return timing.attack;
  case 'SpecialMeleeAttack':
  case 'SpecialRangedAttack':
  case 'SpecialStand':
  case 'FadeIn':
  case 'FadeOut': return timing.special;
  case 'Delay':
    return action.pause
      ? Math.max(0, action.pause.base - action.pause.perIntelligence * timing.intelligence) + action.pause.randomMax / 2
      : undefined;
  case 'Charge':
  case 'Heal':
  case 'Death': return undefined;
  }
};

interface GraphRates {
  attacksPerSecond: number;
  approachesPerSecond: number;
}

type GraphRateEvaluation =
  | { status: 'evaluated'; rates: GraphRates }
  | { status: 'unevaluated'; reason: string };

const stationaryDistribution = (matrix: readonly (readonly number[])[], initial: readonly number[]): number[] | undefined => {
  const size = matrix.length;
  if (size === 1) return [1];
  const augmented = Array.from({ length: size }, (_, row) => [
    ...Array.from({ length: size }, (_, column) => row === size - 1
      ? 1
      : matrix[column][row] - (column === row ? 1 : 0)),
    row === size - 1 ? 1 : 0,
  ]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) {
      // A reducible graph can have several stationary distributions. The Cesaro mean selects the one reachable
      // from the primary entrypoint and also converges for periodic previous-mode cycles.
      let distribution = [...initial];
      const average = distribution.map(() => 0);
      const iterations = 100_000;
      for (let iteration = 0; iteration < iterations; iteration++) {
        distribution.forEach((value, index) => { average[index] += value / iterations; });
        const next = distribution.map(() => 0);
        for (let from = 0; from < size; from++) {
          for (let to = 0; to < size; to++) next[to] += distribution[from] * matrix[from][to];
        }
        distribution = next;
      }
      return average;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let entry = column; entry <= size; entry++) augmented[column][entry] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry++) augmented[row][entry] -= factor * augmented[column][entry];
    }
  }
  const result = augmented.map((row) => row[size]);
  return result.every((value) => Number.isFinite(value) && value >= -1e-10)
    ? result.map((value) => Math.max(0, value))
    : undefined;
};

const contextHasPreviousMode = (entrypoint: AiProfileEntrypoint, mode: 'delay' | 'charge' | 'rangedattack' | 'specialrangedattack'): boolean => {
  const context = entrypoint.context.toLowerCase().replaceAll(' ', '');
  if (context.includes(`not${mode}`) || context.includes('neither')) return false;
  return context.includes(`previousmodewas${mode}`) || context.includes(`previousmodeis${mode}`);
};

const isTransitionEntrypoint = (entrypoint: AiProfileEntrypoint): boolean => /immediately after/i.test(entrypoint.context)
  || (['delay', 'charge', 'rangedattack', 'specialrangedattack'] as const)
    .some((mode) => contextHasPreviousMode(entrypoint, mode));

const primaryEntrypoint = (entrypoints: readonly AiProfileEntrypoint[]): AiProfileEntrypoint | undefined =>
  entrypoints.find((entrypoint) => entrypoint.primary) ?? entrypoints[0];

/** Long-run action rate for a fixed graph distance slice, following its previous-mode branches. */
const graphRates = (
  graph: AiDecisionGraph,
  role: AiGraphBandRole,
  input: BehaviourInput,
  walkExtraTicks: number,
  ticksPerSecond: number,
): GraphRateEvaluation => {
  const roleEntrypoints = graph.profileEntrypoints.filter((entrypoint) => entrypoint.role === role);
  const primary = primaryEntrypoint(roleEntrypoints);
  if (!primary) return { status: 'unevaluated', reason: `W44 has no ${role} action band` };
  const related = roleEntrypoints.filter((entrypoint) => entrypoint.band === primary.band);
  const states = [...new Set([primary, ...related.filter((entrypoint) =>
    isTransitionEntrypoint(entrypoint))])];
  const stateIndex = new Map(states.map((entrypoint, index) => [entrypoint, index]));
  const primaryIndex = stateIndex.get(primary)!;
  const specialAttackFrames = input.specialAttackFrames ?? input.attackFrames;
  const timing: GraphTiming = {
    walk: walkTicksPerStep(input, walkExtraTicks),
    attack: animationEndTick(input.attackFrames, input.attackRate ?? 1),
    special: specialAttackFrames === 0
      ? 0
      : animationEndTick(specialAttackFrames, input.specialAttackRate ?? input.attackRate ?? 1),
    intelligence: input.intelligence,
  };
  const transition = (state: AiProfileEntrypoint, action: AiActionNode): { next: number; extraTicks: number } => {
    const sameBand = states.filter((entrypoint) => entrypoint.band === state.band);
    let candidate: AiProfileEntrypoint | undefined;
    if (action.action === 'Delay') candidate = sameBand.find((entrypoint) => contextHasPreviousMode(entrypoint, 'delay'));
    else if (action.action === 'Charge') candidate = sameBand.find((entrypoint) => contextHasPreviousMode(entrypoint, 'charge'));
    else if (action.action === 'RangedAttack') candidate = sameBand.find((entrypoint) => contextHasPreviousMode(entrypoint, 'rangedattack'));
    else if (action.action === 'SpecialRangedAttack') candidate = sameBand.find((entrypoint) => contextHasPreviousMode(entrypoint, 'specialrangedattack'));
    else if (action.action === 'Walk') candidate = sameBand.find((entrypoint) => /immediately after/i.test(entrypoint.context));
    const next = candidate === undefined ? primaryIndex : (stateIndex.get(candidate) ?? primaryIndex);
    // A failed immediate-after-movement Stand decision is the first of the 21 ticks required by `var2 > 20`.
    const extraTicks = /immediately after/i.test(state.context) && action.action === 'Stand-idle' ? 20 : 0;
    return { next, extraTicks };
  };

  const matrix = states.map(() => states.map(() => 0));
  const durations = states.map(() => 0);
  const attacks = states.map(() => 0);
  const approaches = states.map(() => 0);
  for (let index = 0; index < states.length; index++) {
    const state = states[index];
    const evaluation = graphOutcomes(graph, state, input.intelligence);
    if (evaluation.status === 'unevaluated') {
      return { status: 'unevaluated', reason: `${state.band} / ${state.context}: ${[...new Set(evaluation.reasons)].join(' | ')}` };
    }
    for (const outcome of evaluation.outcomes) {
      const duration = actionDuration(outcome.action, timing);
      if (duration === undefined) return { status: 'unevaluated', reason: `${outcome.action.action} has no finite duration for this comparison` };
      const target = transition(state, outcome.action);
      matrix[index][target.next] += outcome.probability;
      durations[index] += outcome.probability * (duration + target.extraTicks);
      if (OFFENSIVE_MODES.has(outcome.action.action)) attacks[index] += outcome.probability;
      if (outcome.action.category === 'approach') approaches[index] += outcome.probability;
    }
  }

  const initial = states.map((_, index) => index === primaryIndex ? 1 : 0);
  const distribution = stationaryDistribution(matrix, initial);
  if (!distribution) return { status: 'unevaluated', reason: 'previous-mode state distribution has no finite solution' };
  const expectedDuration = distribution.reduce((sum, probability, index) => sum + probability * durations[index], 0);
  if (!(expectedDuration > 0)) return { status: 'unevaluated', reason: 'the selected graph slice consumes no time' };
  const decisionsPerSecond = ticksPerSecond / expectedDuration;
  return {
    status: 'evaluated',
    rates: {
      attacksPerSecond: decisionsPerSecond * distribution.reduce((sum, probability, index) => sum + probability * attacks[index], 0),
      approachesPerSecond: decisionsPerSecond * distribution.reduce((sum, probability, index) => sum + probability * approaches[index], 0),
    },
  };
};

const KNOWN_FINDINGS: Partial<Record<D1AiRoutineId, AiConsistencyFinding>> = {
  SkeletonRanged: {
    incorrectSide: 'behaviourScale',
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2161', '.reference/devilutionX/Source/monster.cpp:2170'],
    finding: 'The pinned routine attempts its close-range retreat before the independent shot roll; W34 times shots as if retreat never consumed an adjacent decision cycle.',
    requiredFix: 'In behaviourScale.ts, make the SkeletonRanged adjacent attack cadence include the settled/post-move retreat branches and their walk durations.',
  },
  GoatRanged: {
    incorrectSide: 'behaviourScale',
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1987', '.reference/devilutionX/Source/monster.cpp:1989', '.reference/devilutionX/Source/monster.cpp:1993'],
    finding: 'The pinned shared ranged routine delays after a normal shot and attempts a retreat below four tiles before it can shoot again; W34 includes the delay but omits adjacent retreat time.',
    requiredFix: 'In behaviourScale.ts, include the shared ranged retreat probability and walk duration in adjacent attack cadence.',
  },
  Succubus: {
    incorrectSide: 'behaviourScale',
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1987', '.reference/devilutionX/Source/monster.cpp:1989', '.reference/devilutionX/Source/monster.cpp:1993'],
    finding: 'The pinned shared ranged routine delays after a normal shot and attempts a retreat below four tiles before it can shoot again; W34 includes the delay but omits adjacent retreat time.',
    requiredFix: 'In behaviourScale.ts, include the shared ranged retreat probability and walk duration in adjacent attack cadence.',
  },
  AcidUnique: {
    incorrectSide: 'behaviourScale',
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1987', '.reference/devilutionX/Source/monster.cpp:1989', '.reference/devilutionX/Source/monster.cpp:1996'],
    finding: 'The pinned delay gate recognizes only RangedAttack, while AcidUnique starts SpecialRangedAttack; W34 adds the shared post-shot pause and also omits the close-range retreat time.',
    requiredFix: 'In behaviourScale.ts, suppress AcidUnique post-shot delay and include the shared ranged retreat probability and walk duration in adjacent attack cadence.',
  },
  LazarusSuccubus: {
    incorrectSide: 'behaviourScale',
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1987', '.reference/devilutionX/Source/monster.cpp:1989', '.reference/devilutionX/Source/monster.cpp:1993', '.reference/devilutionX/Source/monster.cpp:2947'],
    finding: 'The hostile minion delegates to the shared ranged routine, which delays after a shot and attempts a close-range retreat before shooting; W34 omits the adjacent retreat time.',
    requiredFix: 'In behaviourScale.ts, include the shared ranged retreat probability and walk duration in adjacent attack cadence after the quest gate opens.',
  },
};

const overallVerdict = (metrics: readonly AiConsistencyMetric[]): AiConsistencyVerdict => {
  if (metrics.some((metric) => metric.verdict === 'disagree')) return 'disagree';
  return metrics.every((metric) => metric.verdict === 'agree') ? 'agree' : 'not-comparable';
};

/** Compare one animation set and AI/intelligence pair without copying any reference table row. */
export function aiConsistency(input: BehaviourInput): AiConsistencyReport {
  if (!isD1AiRoutineId(input.ai)) throw new Error(`AI routine "${input.ai}" is not in the engine-derived routine table`);
  if (!Number.isInteger(input.intelligence) || input.intelligence < 0 || input.intelligence > 3) {
    throw new Error('AI intelligence must be an integer from 0 through 3');
  }
  const routine = input.ai;
  const cadenceStatus = aiRoutineCadenceStatus(routine);
  if (!cadenceStatus.modelled) {
    const metric = notComparable(`W34 has no stationary cadence: ${cadenceStatus.reason}`);
    return { routine, intelligence: input.intelligence, attack: metric, approach: metric, verdict: 'not-comparable', findings: [] };
  }
  const timing = timingLaw();
  const ticks = expectedTicks(input, timing.walkExtraTicks);
  const personality = aiPersonality(routine, input.intelligence);
  const attackFromGraph = graphRates(D1_AI_DECISION_GRAPHS[routine], 'adjacent', input, timing.walkExtraTicks, timing.ticksPerSecond);
  const approachFromGraph = graphRates(D1_AI_DECISION_GRAPHS[routine], 'range', input, timing.walkExtraTicks, timing.ticksPerSecond);
  const attack = personality.aggression.status === 'unevaluated'
    ? notComparable(`W44 adjacent action mix is unevaluated: ${personality.aggression.expressions.join(' | ')}`, timing.ticksPerSecond / ticks.attack)
    : attackFromGraph.status === 'evaluated'
    ? compareAiRates(timing.ticksPerSecond / ticks.attack, attackFromGraph.rates.attacksPerSecond)
    : notComparable(attackFromGraph.reason, timing.ticksPerSecond / ticks.attack);
  const law = aiRoutineLaw(routine);
  const behaviourApproach = law.approaches ? timing.ticksPerSecond / ticks.step : 0;
  const approach = personality.approachRate.status === 'unevaluated'
    ? notComparable(`W44 range action mix is unevaluated: ${personality.approachRate.expressions.join(' | ')}`, behaviourApproach)
    : approachFromGraph.status === 'evaluated'
    ? compareAiRates(behaviourApproach, approachFromGraph.rates.approachesPerSecond)
    : notComparable(approachFromGraph.reason, behaviourApproach);
  const verdict = overallVerdict([attack, approach]);
  const knownFinding = verdict === 'disagree' ? KNOWN_FINDINGS[routine] : undefined;
  const findings: AiConsistencyFinding[] = knownFinding ? [knownFinding] : verdict === 'disagree' ? [{
    incorrectSide: 'undetermined',
    sourceRefs: D1_AI_DECISION_GRAPHS[routine].sourceRefs,
    finding: 'The two derived rates differ by more than 10%; this path needs source adjudication before either implementation changes.',
    requiredFix: 'Inspect the cited routine and correct the side whose decision ordering, chance, or mode duration differs from the pinned source.',
  }] : [];
  return { routine, intelligence: input.intelligence, attack, approach, verdict, findings };
}

/** Stable routine order for callers that need a complete matrix. */
export const AI_CONSISTENCY_ROUTINES = Object.keys(D1_AI_ROUTINES) as D1AiRoutineId[];
