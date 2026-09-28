/** Engine state machines and geometry for missiles created by vanilla player spells. */
import { PLAYER_SPELL_HIT_SOURCES_DATA } from '@/lib/catalog/reference/playerSpellHitsData';
import { MISSILE_BEHAVIOUR_SPECS_DATA } from '@/lib/catalog/reference/missileSpecsData';
import { spriteAnimLen } from '@/lib/catalog/reference/missileSpecs';
import { SPELL_CAST_LEDGER_DATA } from '@/lib/catalog/reference/spellCastLedgerData';
import { scaleSpellEffect } from '@/lib/catalog/reference/spellMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { MISSILE_BEHAVIOUR_GRAPHS_DATA } from '@/lib/catalog/reference/missileBehaviourGraphsData';

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
  | 'unmanaged';

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

export { MISSILE_BEHAVIOUR_GRAPHS_DATA };
