// ── EQS Component Catalog ─────────────────────────────────────────────────────
// Single source of truth for EQS component IDENTITY — C++ class, kind, parent
// class, cost and provenance status — keyed by a stable component id. The
// numbers (UPROPERTY defaults / clamps) stay single-sourced in `eqs-defaults.ts`.
//
// Every EQS surface references components by id instead of re-typing classes:
//   - the component inventory lists the `source` entries (EQSComponentInventory),
//   - the reference pipelines resolve their steps here (EQSPipelineDiagram),
//   - squad roles declare `{ component, note }` refs and the director's composed
//     pipeline is derived from them (squad-engine).
// Adding or re-costing a component is a one-place change.

/**
 * Where a component lives:
 *  - `source`   — implemented in `Source/PoF/AI/EQS/` (listed by the inventory),
 *  - `proposed` — emitted by the squad codegen, not in the C++ source yet,
 *  - `engine`   — a built-in UE5 component (not project-authored).
 */
export type EQSComponentStatus = 'source' | 'proposed' | 'engine';

/** A component's role in a query. Tests are split by how they are used. */
export type EQSComponentKind = 'context' | 'generator' | 'test-score' | 'test-filter' | 'director';

/** UE5 `EEnvTestCost` — the engine runs cheap tests before expensive ones. */
export type EQSCost = 'Low' | 'High';

export type EQSComponentId =
  | 'ctx-target-actor' | 'ctx-querier' | 'ctx-squad-allies'
  | 'gen-attack-positions' | 'gen-patrol-points' | 'gen-cover-positions'
  | 'test-flank-angle' | 'test-path-exists' | 'test-line-of-sight'
  | 'test-elevation-advantage' | 'test-distance' | 'test-ally-separation'
  | 'squad-director';

export interface EQSCatalogEntry {
  id: EQSComponentId;
  /** Short pipeline label (e.g. `AttackPositions`). */
  label: string;
  /** Human-facing name (e.g. `Attack Ring Positions`). */
  displayName: string;
  cppClass: string;
  kind: EQSComponentKind;
  parentClass: string;
  status: EQSComponentStatus;
  /** Declared test cost — tests only. */
  cost?: EQSCost;
  /** One-line summary of what the component does in a query. */
  summary: string;
}

/** A reference from a pipeline or role to a catalog component, with an optional usage note. */
export interface EQSComponentRef {
  component: EQSComponentId;
  /** Usage modifier, e.g. `prefer behind`, `outer ring`. */
  note?: string;
}

const CTX = 'UEnvQueryContext';
const TEST = 'UEnvQueryTest';
const PROJECTED = 'UEnvQueryGenerator_ProjectedPoints';

/** Source entries are listed in the inventory's display order. */
export const EQS_CATALOG: readonly EQSCatalogEntry[] = [
  // ── Source (Source/PoF/AI/EQS) ──
  { id: 'ctx-target-actor', label: 'TargetActor', displayName: 'TargetActor', cppClass: 'UEnvQueryContext_TargetActor', kind: 'context', parentClass: CTX, status: 'source', summary: 'Resolve the target actor from the blackboard' },
  { id: 'gen-attack-positions', label: 'AttackPositions', displayName: 'Attack Ring Positions', cppClass: 'UEnvQueryGenerator_AttackPositions', kind: 'generator', parentClass: PROJECTED, status: 'source', summary: 'Ring of nav-projected candidates around the target' },
  { id: 'gen-patrol-points', label: 'PatrolPoints', displayName: 'Patrol Points', cppClass: 'UEnvQueryGenerator_PatrolPoints', kind: 'generator', parentClass: PROJECTED, status: 'source', summary: 'Random navigable points in an annulus around the querier' },
  { id: 'gen-cover-positions', label: 'CoverPositions', displayName: 'Cover Positions', cppClass: 'UEnvQueryGenerator_CoverPositions', kind: 'generator', parentClass: PROJECTED, status: 'source', summary: 'Geometry-traced positions behind cover from the threat' },
  { id: 'test-flank-angle', label: 'FlankAngle', displayName: 'Flank Angle', cppClass: 'UEnvQueryTest_FlankAngle', kind: 'test-score', parentClass: TEST, status: 'source', cost: 'Low', summary: 'Score by angle from the target forward vector' },
  { id: 'test-path-exists', label: 'PathExists', displayName: 'Path Exists To Querier', cppClass: 'UEnvQueryTest_PathExists', kind: 'test-filter', parentClass: TEST, status: 'source', cost: 'High', summary: 'Filter unreachable positions via synchronous nav path query' },
  { id: 'test-line-of-sight', label: 'LineOfSight', displayName: 'Line of Sight Exposure', cppClass: 'UEnvQueryTest_LineOfSight', kind: 'test-score', parentClass: TEST, status: 'source', cost: 'High', summary: 'Score by multi-height LOS occlusion from the threat' },
  { id: 'test-elevation-advantage', label: 'ElevationAdvantage', displayName: 'Elevation Advantage', cppClass: 'UEnvQueryTest_ElevationAdvantage', kind: 'test-score', parentClass: TEST, status: 'source', cost: 'Low', summary: 'Score by height advantage over the reference actor' },
  // ── Proposed (emitted by the squad codegen) ──
  { id: 'ctx-squad-allies', label: 'SquadAllies', displayName: 'Squad Allies', cppClass: 'UEnvQueryContext_SquadAllies', kind: 'context', parentClass: CTX, status: 'proposed', summary: 'Resolve the positions already claimed by squad allies' },
  { id: 'test-ally-separation', label: 'AllySeparation', displayName: 'Ally Separation', cppClass: 'UEnvQueryTest_AllySeparation', kind: 'test-score', parentClass: TEST, status: 'proposed', cost: 'Low', summary: 'Score by minimum distance to already-allocated allies' },
  { id: 'squad-director', label: 'Director Allocate', displayName: 'Squad Director', cppClass: 'UARPGSquadDirector', kind: 'director', parentClass: 'UWorldSubsystem', status: 'proposed', summary: 'Sequentially allocate positions by role priority' },
  // ── Engine built-ins ──
  { id: 'ctx-querier', label: 'Querier', displayName: 'Querier', cppClass: 'UEnvQueryContext_Querier', kind: 'context', parentClass: CTX, status: 'engine', summary: 'Built-in context: the AI pawn running the query' },
  { id: 'test-distance', label: 'Distance', displayName: 'Distance', cppClass: 'UEnvQueryTest_Distance', kind: 'test-score', parentClass: TEST, status: 'engine', cost: 'Low', summary: 'Score by distance to the target' },
];

const BY_ID = new Map<EQSComponentId, EQSCatalogEntry>(EQS_CATALOG.map((c) => [c.id, c]));

/** Look a component up by id. Ids are a closed union, so a miss is a catalog defect. */
export function eqsComponent(id: EQSComponentId): EQSCatalogEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`EQS catalog has no component "${id}"`);
  return entry;
}

/** Render a ref the way the views show it: `FlankAngle (prefer behind)`. */
export function formatComponentRef(ref: EQSComponentRef): string {
  const { label } = eqsComponent(ref.component);
  return ref.note ? `${label} (${ref.note})` : label;
}

// ── Runtime (cost-sorted) test order ───────────────────────────────────────
// Shared by the reference pipeline diagram and the squad composed pipeline.

interface TestLikeStep {
  kind: string;
  cost?: EQSCost;
}

export const isTestStep = (step: TestLikeStep): boolean =>
  step.kind === 'test-score' || step.kind === 'test-filter';

const COST_RANK: Record<EQSCost, number> = { Low: 0, High: 1 };

/**
 * The order UE5 *actually* runs a pipeline's tests in. The engine sorts EQS
 * tests by declared `EEnvTestCost` before execution, so cheap tests get to
 * eliminate candidates before expensive ones run — independent of the order the
 * tests are authored in. Sorting is stable: equal-cost tests keep authored order.
 */
export function runtimeTestOrder<S extends TestLikeStep>(steps: readonly S[]): S[] {
  return steps
    .filter(isTestStep)
    .map((step, index) => ({ step, index }))
    .sort((a, b) =>
      (COST_RANK[a.step.cost ?? 'Low'] - COST_RANK[b.step.cost ?? 'Low']) || (a.index - b.index))
    .map(({ step }) => step);
}

/**
 * True when a pipeline lists its tests in an order the engine will not follow —
 * the cue for surfacing the real execution order instead of letting a diagram
 * imply top-to-bottom is what runs.
 */
export function testOrderDiffers(steps: readonly TestLikeStep[]): boolean {
  const runtime = runtimeTestOrder(steps);
  return steps.filter(isTestStep).some((step, i) => step !== runtime[i]);
}
