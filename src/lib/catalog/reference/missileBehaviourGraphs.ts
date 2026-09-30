/** Engine state machines and geometry for missiles created by vanilla player spells. */
import { D1_AI_ROUTINES_DATA } from '@/lib/catalog/reference/aiRoutinesData';
import { D1_MONSTER_ATTACK_LEDGER_DATA } from '@/lib/catalog/reference/monsterAttackLedgerData';
import { MONSTER_MISSILE_DAMAGE_SOURCES_DATA } from '@/lib/catalog/reference/monsterMissileDamageData';
import { PLAYER_SPELL_HIT_SOURCES_DATA } from '@/lib/catalog/reference/playerSpellHitsData';
import { MISSILE_BEHAVIOUR_SPECS_DATA, MISSILE_SPAWNS_DATA } from '@/lib/catalog/reference/missileSpecsData';
import { spriteAnimLen } from '@/lib/catalog/reference/missileSpecs';
import { SPELL_CAST_LEDGER_DATA } from '@/lib/catalog/reference/spellCastLedgerData';
import { scaleSpellEffect } from '@/lib/catalog/reference/spellMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { MISSILE_BEHAVIOUR_GRAPHS_DATA } from '@/lib/catalog/reference/missileBehaviourGraphsData';
import {
  MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA,
  MONSTER_MISSILE_GRAPH_EXCLUSIONS_DATA,
} from '@/lib/catalog/reference/monsterMissileGraphsData';

export type MissileTransitionTrigger =
  | 'add'
  | 'tick-counter'
  | 'collision'
  | 'lifetime'
  | 'target-found'
  | 'target-none'
  | 'wall'
  | 'position-reached'
  | 'placement'
  | 'scan'
  | 'animation'
  | 'external';

export type MissileCheckOrigin =
  | 'caster'
  | 'clicked-point'
  | 'corrected-point'
  | 'current-position'
  | 'start-position';

export type MissileSpeedEvaluation =
  | 'stationary'
  | 'constant-8'
  | 'constant-16'
  | 'constant-18'
  | 'constant-26'
  | 'constant-32'
  | 'firebolt'
  | 'fireball'
  | 'holy-bolt';

export type MissileLifetimeEvaluation =
  | 'immediate'
  | 'exact-1'
  | 'exact-2'
  | 'exact-7'
  | 'exact-19'
  | 'exact-100-sentinel'
  | 'exact-255'
  | 'exact-256'
  | 'animation'
  | 'animation-minus-one'
  | 'lightning-segment'
  | 'fire-wall'
  | 'stone-curse'
  | 'infravision'
  | 'guardian'
  | 'flame-wave-sentinel'
  | 'inferno-segment'
  | 'runtime-scan'
  | 'elemental-phases'
  | 'fireball-phases'
  | 'charged-bolt-phases'
  | 'holy-bolt-phases'
  | 'bone-spirit-phases'
  | 'acid-flight'
  | 'acid-puddle-phases'
  | 'charge-runtime'
  | 'monster-lightning-segment'
  | 'unmanaged';

export type MonsterMissileSpeedEvaluation = MissileSpeedEvaluation;

export type MonsterMissileLifetimeEvaluation = MissileLifetimeEvaluation;

export type MissileDamageUnits = 'whole-hit-points' | 'fixed-point-1/64-hit-point' | 'none';

export interface MissileGraphStateData {
  readonly id: string;
  readonly label: string;
  readonly refs: readonly string[];
  readonly terminal?: boolean;
}

export interface MissileGraphTransitionData {
  readonly from: string;
  readonly nextState: string;
  readonly trigger: MissileTransitionTrigger;
  readonly guard: string;
  readonly effect: string;
  readonly refs: readonly string[];
}

export interface MissileGeometryCheckData {
  readonly check: string;
  readonly origin: MissileCheckOrigin;
  readonly target: string;
  readonly refs: readonly string[];
}

export interface MissileFormulaData<Evaluation extends string> {
  readonly formula: string;
  readonly symbols: Readonly<Record<string, string>>;
  readonly evaluation: Evaluation;
  readonly refs: readonly string[];
  readonly animationGraphic?: string;
}

export interface MissileSpawnData {
  readonly missile: string;
  readonly trigger: string;
  readonly refs: readonly string[];
}

export interface MissileTerminationData {
  readonly cause: string;
  readonly refs: readonly string[];
}

export interface MissileBehaviourGraphData {
  readonly missile: string;
  readonly addFn: string | null;
  readonly processFn: string | null;
  readonly initialState: string;
  readonly states: readonly MissileGraphStateData[];
  readonly transitions: readonly MissileGraphTransitionData[];
  readonly geometryChecks: readonly MissileGeometryCheckData[];
  readonly speed: MissileFormulaData<MissileSpeedEvaluation>;
  readonly lifetime: MissileFormulaData<MissileLifetimeEvaluation>;
  readonly ends: readonly MissileTerminationData[];
  readonly spawns: readonly MissileSpawnData[];
  readonly refs: readonly string[];
}

export interface MissileBehaviourGraph extends MissileBehaviourGraphData {
  readonly id: string;
}

export interface MonsterMissileKineticsBranchData {
  readonly source: 'player' | 'monster' | 'trap';
  readonly routines?: readonly string[];
  readonly speed: MissileFormulaData<MonsterMissileSpeedEvaluation>;
  readonly lifetime: MissileFormulaData<MonsterMissileLifetimeEvaluation>;
  readonly refs: readonly string[];
}

export interface MonsterMissileDamageBranchData {
  readonly source: 'player' | 'monster' | 'trap' | 'none';
  readonly routines?: readonly string[];
  /** Missile whose collision consumes this value; controllers name their spawned child. */
  readonly target: string;
  readonly formula: string;
  readonly units: MissileDamageUnits;
  readonly isDamageShifted: boolean | null;
  readonly landedFloor: string | null;
  readonly refs: readonly string[];
}

export interface MonsterMissileSpawnOwnerData {
  readonly missile: string;
  readonly routines: readonly string[];
  readonly refs: readonly string[];
}

export interface MonsterMissileBehaviourGraphSpecData {
  readonly missile: string;
  readonly baseMissile?: string;
  readonly graph?: MissileBehaviourGraphData;
  readonly directRoutines: readonly string[];
  readonly spawnedBy: readonly MonsterMissileSpawnOwnerData[];
  readonly projectilesPerAttack: number;
  readonly kinetics: readonly MonsterMissileKineticsBranchData[];
  readonly damage: readonly MonsterMissileDamageBranchData[];
  readonly refs: readonly string[];
}

export interface MonsterMissileGraphExclusionData {
  readonly routine: string;
  readonly missile: string;
  readonly reason: string;
  readonly refs: readonly string[];
}

export interface MonsterMissileBehaviourGraph extends MissileBehaviourGraph {
  readonly directRoutines: readonly string[];
  readonly spawnedBy: readonly MonsterMissileSpawnOwnerData[];
  readonly routines: readonly string[];
  readonly projectilesPerAttack: number;
  readonly kinetics: readonly MonsterMissileKineticsBranchData[];
  readonly damage: readonly MonsterMissileDamageBranchData[];
}

export interface ResolvedMissileKinetics {
  readonly spellLevel: number;
  readonly speed: {
    readonly formula: string;
    readonly tilesPerTick: number;
  };
  readonly lifetime: {
    readonly formula: string;
    readonly ticks: number | null;
    readonly kind: 'exact' | 'maximum' | 'phase-maximum' | 'runtime' | 'sentinel';
  };
}

export interface MissileBehaviourGraphFinding {
  readonly dataset: 'missileSpecsData' | 'playerSpellHitsData';
  readonly owner: string;
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
  readonly refs: readonly string[];
}

export interface MonsterMissileBehaviourGraphFinding {
  readonly dataset: 'monsterAttackLedgerData' | 'monsterMissileDamageData' | 'missileSpecsData';
  readonly owner: string;
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
  readonly refs: readonly string[];
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function compileGraph(data: MissileBehaviourGraphData): MissileBehaviourGraph {
  const stateIds = new Set(data.states.map((state) => state.id));
  if (stateIds.size !== data.states.length) throw new Error(`missile graph ${data.missile} has duplicate state ids`);
  if (!stateIds.has(data.initialState)) throw new Error(`missile graph ${data.missile} has no initial state ${data.initialState}`);
  for (const state of data.states) {
    if (state.refs.length === 0) throw new Error(`missile graph ${data.missile} state ${state.id} has no source ref`);
  }
  for (const transition of data.transitions) {
    if (!stateIds.has(transition.from)) throw new Error(`missile graph ${data.missile} transition starts at missing state ${transition.from}`);
    if (!stateIds.has(transition.nextState)) throw new Error(`missile graph ${data.missile} transition ends at missing state ${transition.nextState}`);
    if (transition.refs.length === 0) throw new Error(`missile graph ${data.missile} transition ${transition.from} -> ${transition.nextState} has no source ref`);
  }
  for (const check of data.geometryChecks) {
    if (check.refs.length === 0) throw new Error(`missile graph ${data.missile} geometry check has no source ref`);
  }
  return { ...data, id: `d1-missile-graph-${data.missile}` };
}

const requiredMissiles = unique(SPELL_CAST_LEDGER_DATA.flatMap((ledger) => [
  ...ledger.initialMissiles,
  ...ledger.spawnedMissiles,
]));
const graphMissiles = MISSILE_BEHAVIOUR_GRAPHS_DATA.map((graph) => graph.missile);
const missingGraphs = requiredMissiles.filter((missile) => !graphMissiles.includes(missile));
const extraGraphs = graphMissiles.filter((missile) => !requiredMissiles.includes(missile));
if (missingGraphs.length > 0 || extraGraphs.length > 0 || new Set(graphMissiles).size !== graphMissiles.length) {
  throw new Error(`player-spell missile graph coverage mismatch; missing=${missingGraphs.join(',') || '(none)'} extra=${extraGraphs.join(',') || '(none)'}`);
}

export const D1_MISSILE_BEHAVIOUR_GRAPHS: readonly MissileBehaviourGraph[] =
  MISSILE_BEHAVIOUR_GRAPHS_DATA.map(compileGraph);

const GRAPH_BY_MISSILE = new Map(D1_MISSILE_BEHAVIOUR_GRAPHS.map((graph) => [graph.missile, graph]));

const splitMissiles = (value: string): string[] =>
  value.split(/[|+]/).map((missile) => missile.trim()).filter((missile) => missile !== '' && missile !== 'none');

function compileMonsterGraph(spec: MonsterMissileBehaviourGraphSpecData): MonsterMissileBehaviourGraph {
  if ((spec.graph === undefined) === (spec.baseMissile === undefined)) {
    throw new Error(`monster missile graph ${spec.missile} must provide exactly one graph or baseMissile`);
  }
  const source = spec.graph ?? GRAPH_BY_MISSILE.get(spec.baseMissile!);
  if (!source) throw new Error(`monster missile graph ${spec.missile} reuses missing player graph ${spec.baseMissile}`);
  if (spec.kinetics.length === 0) throw new Error(`monster missile graph ${spec.missile} has no kinetics branch`);
  if (spec.damage.length === 0) throw new Error(`monster missile graph ${spec.missile} has no damage branch`);
  for (const branch of spec.kinetics) {
    if (branch.refs.length === 0 || branch.speed.refs.length === 0 || branch.lifetime.refs.length === 0) {
      throw new Error(`monster missile graph ${spec.missile} has an unreferenced kinetics branch`);
    }
  }
  for (const branch of spec.damage) {
    if (branch.refs.length === 0) throw new Error(`monster missile graph ${spec.missile} has an unreferenced damage branch`);
  }
  for (const owner of spec.spawnedBy) {
    if (owner.refs.length === 0) throw new Error(`monster missile graph ${spec.missile} has an unreferenced spawn owner`);
  }
  const monsterKinetics = spec.kinetics.find((branch) => branch.source === 'monster') ?? spec.kinetics[0];
  const graph = compileGraph({
    ...source,
    missile: spec.missile,
    speed: monsterKinetics.speed,
    lifetime: monsterKinetics.lifetime,
  });
  return {
    ...graph,
    directRoutines: spec.directRoutines,
    spawnedBy: spec.spawnedBy,
    routines: unique([
      ...spec.directRoutines,
      ...spec.spawnedBy.flatMap((owner) => owner.routines),
    ]),
    projectilesPerAttack: spec.projectilesPerAttack,
    kinetics: spec.kinetics,
    damage: spec.damage,
  };
}

const monsterGraphMissiles = MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA.map((graph) => graph.missile);
if (new Set(monsterGraphMissiles).size !== monsterGraphMissiles.length) {
  throw new Error('monster missile behaviour graph data has duplicate missile ids');
}

const excludedRoutines = new Set(MONSTER_MISSILE_GRAPH_EXCLUSIONS_DATA.map((entry) => entry.routine));
const attackLedgerMissiles = D1_MONSTER_ATTACK_LEDGER_DATA as Readonly<Record<string, {
  readonly sequences: readonly { readonly missile?: string }[];
}>>;
const expectedDirectPairs = Object.entries(attackLedgerMissiles).flatMap(([routine, ledger]) => {
  if (D1_AI_ROUTINES_DATA[routine as keyof typeof D1_AI_ROUTINES_DATA]?.hellfire || excludedRoutines.has(routine)) return [];
  return unique(ledger.sequences.flatMap((sequence) => sequence.missile ? splitMissiles(sequence.missile) : []))
    .map((missile) => `${routine}\u0000${missile}`);
});
const actualDirectPairs = MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA.flatMap((graph) =>
  graph.directRoutines.map((routine) => `${routine}\u0000${graph.missile}`));
const missingMonsterGraphs = expectedDirectPairs.filter((pair) => !actualDirectPairs.includes(pair));
const extraMonsterGraphs = actualDirectPairs.filter((pair) => !expectedDirectPairs.includes(pair));
if (missingMonsterGraphs.length > 0 || extraMonsterGraphs.length > 0) {
  throw new Error(`monster missile graph coverage mismatch; missing=${missingMonsterGraphs.join(',') || '(none)'} extra=${extraMonsterGraphs.join(',') || '(none)'}`);
}

export const D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS: readonly MonsterMissileBehaviourGraph[] =
  MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA.map(compileMonsterGraph);

const MONSTER_GRAPH_BY_ROUTINE = new Map<string, MonsterMissileBehaviourGraph[]>();
const MONSTER_GRAPH_BY_MISSILE = new Map(
  D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS.map((graph) => [graph.missile, graph]),
);
const monsterMissileRoutines = unique(D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS
  .flatMap((graph) => graph.directRoutines));
for (const routine of monsterMissileRoutines) {
  const ordered: MonsterMissileBehaviourGraph[] = [];
  const queue = D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS
    .filter((graph) => graph.directRoutines.includes(routine));
  for (let index = 0; index < queue.length; index++) {
    const graph = queue[index];
    if (ordered.includes(graph)) continue;
    ordered.push(graph);
    for (const spawn of graph.spawns) {
      const child = MONSTER_GRAPH_BY_MISSILE.get(spawn.missile);
      if (child?.routines.includes(routine)) queue.push(child);
    }
  }
  MONSTER_GRAPH_BY_ROUTINE.set(routine, ordered);
}

export function missileBehaviourGraph(missile: string): MissileBehaviourGraph | undefined {
  return GRAPH_BY_MISSILE.get(missile);
}

export function missileBehaviourGraphsForSpell(spell: string): readonly MissileBehaviourGraph[] {
  const ledger = SPELL_CAST_LEDGER_DATA.find((candidate) => candidate.spell === spell);
  if (!ledger) return [];
  return unique([...ledger.initialMissiles, ...ledger.spawnedMissiles])
    .map((missile) => GRAPH_BY_MISSILE.get(missile))
    .filter((graph): graph is MissileBehaviourGraph => graph !== undefined);
}

export function missileBehaviourGraphsForMonsterRoutine(routine: string): readonly MonsterMissileBehaviourGraph[] {
  return MONSTER_GRAPH_BY_ROUTINE.get(routine) ?? [];
}

export function missileBehaviourGraphsForMonster(
  wrapper: ReferenceWrapper,
): readonly MonsterMissileBehaviourGraph[] {
  if (wrapper.catalogId !== 'bestiary'
    || (wrapper.file !== 'monsters/monstdat.tsv' && wrapper.file !== 'monsters/unique_monstdat.tsv')) return [];
  const routine = wrapper.raw.ai ?? wrapper.entity.tags?.[0];
  return routine ? missileBehaviourGraphsForMonsterRoutine(routine) : [];
}

/** Attach immutable routine graphs during bestiary promotion; source wrappers remain unchanged. */
export function withMonsterMissileGraphs(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'bestiary'
      || (wrapper.file !== 'monsters/monstdat.tsv' && wrapper.file !== 'monsters/unique_monstdat.tsv')) return wrapper;
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: { ...wrapper.entity.data, missileGraphs: missileBehaviourGraphsForMonster(wrapper) },
      },
    };
  });
}

function animationLength(
  graph: MissileBehaviourGraph,
  wrappers: readonly ReferenceWrapper[],
): number | undefined {
  const graphic = graph.lifetime.animationGraphic
    ?? wrappers.find((wrapper) => wrapper.file === 'missiles/misdat.tsv'
      && wrapper.raw.id === graph.missile)?.raw.graphic;
  if (!graphic) return undefined;
  try {
    return spriteAnimLen(wrappers, graphic, 0);
  } catch {
    return undefined;
  }
}

function speedAt(evaluation: MissileSpeedEvaluation, spellLevel: number): number {
  switch (evaluation) {
  case 'stationary': return 0;
  case 'constant-8': return 8 / 16;
  case 'constant-16': return 16 / 16;
  case 'constant-18': return 18 / 16;
  case 'constant-26': return 26 / 16;
  case 'constant-32': return 32 / 16;
  case 'firebolt': return (16 + Math.min(2 * spellLevel, 47)) / 16;
  case 'fireball': return (16 + Math.min(2 * spellLevel, 34)) / 16;
  case 'holy-bolt': return (16 + Math.min(2 * spellLevel, 47)) / 16;
  }
}

function lifetimeAt(
  graph: MissileBehaviourGraph,
  spellLevel: number,
  characterLevel: number,
  wrappers: readonly ReferenceWrapper[],
): ResolvedMissileKinetics['lifetime'] {
  const formula = graph.lifetime.formula;
  const animation = animationLength(graph, wrappers);
  switch (graph.lifetime.evaluation) {
  case 'immediate': return { formula, ticks: 0, kind: 'exact' };
  case 'exact-1': return { formula, ticks: 1, kind: 'exact' };
  case 'exact-2': return { formula, ticks: 2, kind: 'exact' };
  case 'exact-7': return { formula, ticks: 7, kind: 'exact' };
  case 'exact-19': return { formula, ticks: 19, kind: 'exact' };
  case 'exact-100-sentinel': return { formula, ticks: null, kind: 'sentinel' };
  case 'exact-255': return { formula, ticks: 255, kind: 'maximum' };
  case 'exact-256': return { formula, ticks: 256, kind: 'maximum' };
  case 'animation': return { formula, ticks: animation ?? null, kind: 'exact' };
  case 'animation-minus-one': return { formula, ticks: animation === undefined ? null : animation - 1, kind: 'exact' };
  case 'lightning-segment': return { formula, ticks: Math.trunc(spellLevel / 2) + 6, kind: 'exact' };
  case 'fire-wall': return { formula, ticks: 160 * (spellLevel + 1), kind: 'exact' };
  case 'stone-curse': return { formula, ticks: 16 * Math.min(spellLevel + 6, 15), kind: 'exact' };
  case 'infravision': return { formula, ticks: scaleSpellEffect(1584, spellLevel), kind: 'exact' };
  case 'guardian': return { formula, ticks: Math.max(30, 16 * Math.min(spellLevel + Math.trunc(characterLevel / 2), 30)), kind: 'exact' };
  case 'flame-wave-sentinel': return { formula, ticks: null, kind: 'sentinel' };
  case 'inferno-segment': return { formula, ticks: 30, kind: 'maximum' };
  case 'runtime-scan': return { formula, ticks: null, kind: 'runtime' };
  case 'elemental-phases': return { formula, ticks: animation === undefined ? null : 256 + 255 + animation - 1, kind: 'phase-maximum' };
  case 'fireball-phases': return { formula, ticks: animation === undefined ? null : 256 + animation - 1, kind: 'phase-maximum' };
  case 'charged-bolt-phases': return { formula, ticks: animation === undefined ? null : 256 + animation, kind: 'phase-maximum' };
  case 'holy-bolt-phases': return { formula, ticks: animation === undefined ? null : 256 + animation - 1, kind: 'phase-maximum' };
  case 'bone-spirit-phases': return { formula, ticks: 256 + 255 + 7, kind: 'phase-maximum' };
  case 'acid-flight':
  case 'acid-puddle-phases':
  case 'charge-runtime':
  case 'monster-lightning-segment': return { formula, ticks: null, kind: 'runtime' };
  case 'unmanaged': return { formula, ticks: null, kind: 'runtime' };
  }
}

export function resolveMissileKinetics(
  missile: string,
  spellLevel: number,
  characterLevel: number,
  wrappers: readonly ReferenceWrapper[] = [],
): ResolvedMissileKinetics {
  const graph = GRAPH_BY_MISSILE.get(missile);
  if (!graph) throw new Error(`no player-spell missile behaviour graph for ${missile}`);
  return {
    spellLevel,
    speed: {
      formula: graph.speed.formula,
      tilesPerTick: speedAt(graph.speed.evaluation, spellLevel),
    },
    lifetime: lifetimeAt(graph, spellLevel, characterLevel, wrappers),
  };
}

/** Compare the graph truth with older prose datasets without changing either dataset. */
export function auditMissileBehaviourGraphs(
  graphs: readonly MissileBehaviourGraph[] = D1_MISSILE_BEHAVIOUR_GRAPHS,
  specs: readonly { readonly missileIds: readonly string[]; readonly lifetime: string; readonly refs: readonly string[] }[] = MISSILE_BEHAVIOUR_SPECS_DATA,
  hits: readonly { readonly spell: string; readonly collisionChecks: string; readonly refs: readonly string[] }[] = PLAYER_SPELL_HIT_SOURCES_DATA,
): MissileBehaviourGraphFinding[] {
  const findings: MissileBehaviourGraphFinding[] = [];
  const flameWave = graphs.find((graph) => graph.missile === 'FlameWave');
  const flameWaveSpec = specs.find((spec) => spec.missileIds.includes('FlameWave'));
  if (flameWave && flameWaveSpec && /maximum/i.test(flameWaveSpec.lifetime)
    && flameWave.lifetime.evaluation === 'flame-wave-sentinel') {
    findings.push({
      dataset: 'missileSpecsData', owner: 'FlameWave', field: 'lifetime',
      expected: flameWave.lifetime.formula, actual: flameWaveSpec.lifetime,
      refs: unique([...flameWave.lifetime.refs, ...flameWaveSpec.refs]),
    });
  }
  const fireball = graphs.find((graph) => graph.missile === 'Fireball');
  const fireballHits = hits.find((source) => source.spell === 'Fireball');
  if (fireball && fireballHits && /only after a successful direct impact/i.test(fireballHits.collisionChecks)) {
    findings.push({
      dataset: 'playerSpellHitsData', owner: 'Fireball', field: 'blastTrigger',
      expected: 'actor collision, blocking terrain, or flight lifetime expiry',
      actual: fireballHits.collisionChecks,
      refs: unique([...fireball.refs, ...fireballHits.refs]),
    });
  }
  return findings;
}

export const MISSILE_BEHAVIOUR_GRAPH_FINDINGS: readonly MissileBehaviourGraphFinding[] =
  auditMissileBehaviourGraphs();

/** Compare monster graphs with the three older missile/attack datasets without mutating them. */
export function auditMonsterMissileBehaviourGraphs(
  graphs: readonly MonsterMissileBehaviourGraph[] = D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS,
): MonsterMissileBehaviourGraphFinding[] {
  const findings: MonsterMissileBehaviourGraphFinding[] = [];
  for (const graph of graphs) {
    const specification = MISSILE_BEHAVIOUR_SPECS_DATA.find((candidate) => candidate.missileIds.includes(graph.missile));
    if (specification && (specification.addFn !== graph.addFn || specification.processFn !== graph.processFn)) {
      findings.push({
        dataset: 'missileSpecsData', owner: graph.missile, field: 'dispatch',
        expected: `${graph.addFn ?? '(none)'}/${graph.processFn ?? '(none)'}`,
        actual: `${specification.addFn ?? '(none)'}/${specification.processFn ?? '(none)'}`,
        refs: unique([...graph.refs, ...specification.refs]),
      });
    }
    const graphChildren = unique(graph.spawns.map((spawn) => spawn.missile)).sort();
    const recordedChildren = unique(MISSILE_SPAWNS_DATA
      .filter((spawn) => spawn.parent === graph.missile)
      .map((spawn) => spawn.child)).sort();
    if (graphChildren.join('\u0000') !== recordedChildren.join('\u0000')) {
      findings.push({
        dataset: 'missileSpecsData', owner: graph.missile, field: 'spawnedMissiles',
        expected: graphChildren.join(', ') || '(none)',
        actual: recordedChildren.join(', ') || '(none)',
        refs: unique([
          ...graph.spawns.flatMap((spawn) => spawn.refs),
          ...MISSILE_SPAWNS_DATA.filter((spawn) => spawn.parent === graph.missile).flatMap((spawn) => spawn.refs),
        ]),
      });
    }
  }

  const rhino = graphs.find((graph) => graph.missile === 'Rhino');
  const rhinoSpec = MISSILE_BEHAVIOUR_SPECS_DATA.find((specification) => specification.missileIds.includes('Rhino'));
  if (rhino && rhinoSpec && /256/.test(rhinoSpec.lifetime)
    && rhino.lifetime.evaluation === 'charge-runtime') {
    findings.push({
      dataset: 'missileSpecsData', owner: 'Rhino', field: 'lifetime',
      expected: rhino.lifetime.formula, actual: rhinoSpec.lifetime,
      refs: unique([...rhino.lifetime.refs, ...rhinoSpec.refs]),
    });
  }

  const fireball = graphs.find((graph) => graph.missile === 'Fireball');
  const fireballDamage = MONSTER_MISSILE_DAMAGE_SOURCES_DATA.find((source) => source.missile === 'Fireball');
  if (fireball && fireballDamage && fireballDamage.omittedEffects.length > 0) {
    findings.push({
      dataset: 'monsterMissileDamageData', owner: 'Fireball', field: 'hitCount',
      expected: 'one stopping flight check plus the one-time line-visible 3x3 blast checks; the direct target can be checked again by the blast',
      actual: `fixed primary hit count with omission: ${fireballDamage.omittedEffects.join(' ')}`,
      refs: unique([...fireball.refs, ...fireballDamage.refs]),
    });
  }

  const counselorLedger = D1_MONSTER_ATTACK_LEDGER_DATA.Counselor;
  const counselorProjectile = counselorLedger.sequences.find((sequence) => sequence.missile?.includes('Fireball'));
  const counselorMissileStep = counselorProjectile?.steps.find((step) => step.phase === 'missile');
  if (fireball && counselorMissileStep && !/blast|3x3/i.test(counselorMissileStep.what)) {
    findings.push({
      dataset: 'monsterAttackLedgerData', owner: 'Counselor/Zhar/Lazarus Fireball', field: 'terminalCollision',
      expected: 'flight termination performs one line-visible 3x3 blast pass before the animation-only phase',
      actual: counselorMissileStep.what,
      refs: unique([...fireball.refs, ...counselorMissileStep.refs]),
    });
  }

  for (const exclusion of MONSTER_MISSILE_GRAPH_EXCLUSIONS_DATA) {
    findings.push({
      dataset: 'monsterAttackLedgerData', owner: `${exclusion.routine}/${exclusion.missile}`, field: 'scope',
      expected: 'vanilla monster-fired missile graph coverage', actual: exclusion.reason, refs: exclusion.refs,
    });
  }
  return findings;
}

export const MONSTER_MISSILE_BEHAVIOUR_GRAPH_FINDINGS: readonly MonsterMissileBehaviourGraphFinding[] =
  auditMonsterMissileBehaviourGraphs();

export { MISSILE_BEHAVIOUR_GRAPHS_DATA };
export { MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA, MONSTER_MISSILE_GRAPH_EXCLUSIONS_DATA };
