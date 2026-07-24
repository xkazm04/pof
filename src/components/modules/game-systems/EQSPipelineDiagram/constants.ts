import {
  Target, MapPin, Crosshair, Route, Shield,
  AlertTriangle, Gauge,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS,
} from '@/lib/chart-colors';
import {
  EQS_ATTACK_POSITIONS, EQS_PATROL_POINTS, EQS_COVER_POSITIONS,
  EQS_LINE_OF_SIGHT, EQS_ELEVATION_ADVANTAGE,
  eqsFloat,
} from '@/lib/ai-director/eqs-defaults';
import type { StepKind, PipelineStep, QueryPipeline } from './types';

export const PIPELINES: QueryPipeline[] = [
  {
    id: 'find-attack',
    name: 'FindAttackPosition',
    description: 'Locate flanking positions around the target actor for melee/ranged attacks',
    icon: Crosshair,
    steps: [
      {
        id: 'ctx-target',
        label: 'TargetActor',
        cppClass: 'UEnvQueryContext_TargetActor',
        kind: 'context',
        color: ACCENT_CYAN,
        detail: 'Resolves TargetActor blackboard key → AActor*',
        params: [
          { label: 'Source', value: 'Blackboard: TargetActor' },
        ],
      },
      {
        id: 'gen-attack',
        label: 'AttackPositions',
        cppClass: 'UEnvQueryGenerator_AttackPositions',
        kind: 'generator',
        color: ACCENT_VIOLET,
        detail: 'Generates ring of nav-projected points around center actor',
        params: [
          { label: 'AttackDistance', value: eqsFloat(EQS_ATTACK_POSITIONS.attackDistance) },
          { label: 'NumberOfPoints', value: String(EQS_ATTACK_POSITIONS.numberOfPoints) },
          { label: 'InnerRing', value: String(EQS_ATTACK_POSITIONS.generateInnerRing) },
          { label: 'Output', value: 'TArray<FNavLocation>' },
        ],
      },
      {
        id: 'test-flank',
        label: 'FlankAngle',
        cppClass: 'UEnvQueryTest_FlankAngle',
        kind: 'test-score',
        color: ACCENT_EMERALD,
        detail: 'Scores by angle from target forward vector (0°=front → 180°=behind)',
        cost: 'Low',
        params: [
          { label: 'TargetContext', value: 'TargetActor' },
          { label: 'Score', value: '0° – 180°' },
          { label: 'Best', value: '180° (behind)' },
        ],
      },
      {
        id: 'test-path-attack',
        label: 'PathExists',
        cppClass: 'UEnvQueryTest_PathExists',
        kind: 'test-filter',
        color: ACCENT_ORANGE,
        detail: 'Filters unreachable points via synchronous nav path query',
        cost: 'High',
        params: [
          { label: 'PathFrom', value: 'Querier' },
          { label: 'Result', value: '1.0 / 0.0 (bool)' },
          { label: 'Method', value: 'TestPathSync()' },
        ],
      },
      {
        id: 'result-attack',
        label: 'Best Position',
        cppClass: '',
        kind: 'result',
        color: STATUS_SUCCESS,
        detail: 'Highest-scoring reachable flank point selected',
      },
    ],
  },
  {
    id: 'find-cover',
    name: 'FindCoverPosition',
    description: 'Locate terrain-aware cover positions using geometry traces, LOS exposure scoring, and elevation advantage',
    icon: Shield,
    steps: [
      {
        id: 'ctx-target-cover',
        label: 'TargetActor',
        cppClass: 'UEnvQueryContext_TargetActor',
        kind: 'context',
        color: ACCENT_CYAN,
        detail: 'Resolves TargetActor (threat) blackboard key for cover evaluation',
        params: [
          { label: 'Source', value: 'Blackboard: TargetActor' },
        ],
      },
      {
        id: 'gen-cover',
        label: 'CoverPositions',
        cppClass: 'UEnvQueryGenerator_CoverPositions',
        kind: 'generator',
        color: ACCENT_VIOLET,
        detail: 'Traces geometry in annular rings to find positions behind walls, pillars, and elevation changes',
        params: [
          { label: 'SampleCount', value: String(EQS_COVER_POSITIONS.sampleCount) },
          { label: 'NumberOfRings', value: String(EQS_COVER_POSITIONS.numberOfRings) },
          { label: 'MinRadius', value: eqsFloat(EQS_COVER_POSITIONS.minRadius) },
          { label: 'MaxRadius', value: eqsFloat(EQS_COVER_POSITIONS.maxRadius) },
          { label: 'CoverCheckDistance', value: eqsFloat(EQS_COVER_POSITIONS.coverCheckDistance) },
          { label: 'TraceChannel', value: 'ECC_WorldStatic' },
          { label: 'Output', value: 'TArray<FNavLocation>' },
        ],
      },
      {
        id: 'test-los',
        label: 'LineOfSight',
        cppClass: 'UEnvQueryTest_LineOfSight',
        kind: 'test-score',
        color: ACCENT_EMERALD,
        detail: 'Multi-height trace to threat — scores by occlusion percentage (1.0 = fully hidden)',
        cost: 'High',
        params: [
          { label: 'ThreatContext', value: 'TargetActor' },
          { label: 'TraceHeights', value: `${EQS_LINE_OF_SIGHT.numberOfTraceHeights} (${EQS_LINE_OF_SIGHT.minTraceHeight}-${EQS_LINE_OF_SIGHT.maxTraceHeight} UU)` },
          { label: 'Score', value: '0.0 (exposed) – 1.0 (covered)' },
          { label: 'Best', value: '1.0 (fully occluded)' },
        ],
      },
      {
        id: 'test-elev',
        label: 'ElevationAdvantage',
        cppClass: 'UEnvQueryTest_ElevationAdvantage',
        kind: 'test-score',
        color: ACCENT_EMERALD,
        detail: 'Scores height difference vs threat — prefers high ground positions',
        cost: 'Low',
        params: [
          { label: 'ReferenceContext', value: 'TargetActor' },
          { label: 'MaxElevationBonus', value: `${eqsFloat(EQS_ELEVATION_ADVANTAGE.maxElevationBonus)} UU` },
          { label: 'PenalizeLowGround', value: 'false' },
          { label: 'Score', value: '0.0 – 1.0 (clamped)' },
        ],
      },
      {
        id: 'test-path-cover',
        label: 'PathExists',
        cppClass: 'UEnvQueryTest_PathExists',
        kind: 'test-filter',
        color: ACCENT_ORANGE,
        detail: 'Filters unreachable cover points via synchronous nav path query',
        cost: 'High',
        params: [
          { label: 'PathFrom', value: 'Querier' },
          { label: 'Result', value: '1.0 / 0.0 (bool)' },
          { label: 'Method', value: 'TestPathSync()' },
        ],
      },
      {
        id: 'result-cover',
        label: 'Best Cover',
        cppClass: '',
        kind: 'result',
        color: STATUS_SUCCESS,
        detail: 'Highest-scoring reachable cover position with LOS occlusion + elevation bonus',
      },
    ],
  },
  {
    id: 'find-patrol',
    name: 'FindPatrolPoint',
    description: 'Select random reachable patrol destination for idle wandering',
    icon: Route,
    steps: [
      {
        id: 'ctx-querier',
        label: 'Querier',
        cppClass: 'UEnvQueryContext_Querier',
        kind: 'context',
        color: ACCENT_CYAN,
        builtIn: true,
        detail: 'Built-in context: the AI pawn running the query',
      },
      {
        id: 'gen-patrol',
        label: 'PatrolPoints',
        cppClass: 'UEnvQueryGenerator_PatrolPoints',
        kind: 'generator',
        color: ACCENT_VIOLET,
        detail: 'Random points in annular ring around querier, projected to nav mesh',
        params: [
          { label: 'NumberOfPoints', value: String(EQS_PATROL_POINTS.numberOfPoints) },
          { label: 'MinRadius', value: eqsFloat(EQS_PATROL_POINTS.minRadius) },
          { label: 'MaxRadius', value: eqsFloat(EQS_PATROL_POINTS.maxRadius) },
          { label: 'Output', value: 'TArray<FNavLocation>' },
        ],
      },
      {
        id: 'test-path-patrol',
        label: 'PathExists',
        cppClass: 'UEnvQueryTest_PathExists',
        kind: 'test-filter',
        color: ACCENT_ORANGE,
        detail: 'Filters unreachable points — runs last due to high nav cost',
        cost: 'High',
        params: [
          { label: 'PathFrom', value: 'Querier' },
          { label: 'Result', value: '1.0 / 0.0 (bool)' },
          { label: 'Method', value: 'TestPathSync()' },
        ],
      },
      {
        id: 'result-patrol',
        label: 'Patrol Target',
        cppClass: '',
        kind: 'result',
        color: STATUS_SUCCESS,
        detail: 'Random reachable point selected as patrol destination',
      },
    ],
  },
];

/**
 * Number of distinct project-authored EQS components across every pipeline —
 * derived rather than written into the intro copy, so adding or removing a
 * pipeline can never leave the headline count quietly wrong. Engine-provided
 * components (`builtIn`) and terminal Result steps (no `cppClass`) don't count.
 */
export const CUSTOM_COMPONENT_COUNT = new Set(
  PIPELINES
    .flatMap((pipeline) => pipeline.steps)
    .filter((step) => step.cppClass && !step.builtIn)
    .map((step) => step.cppClass),
).size;

// ── Kind styling ───────────────────────────────────────────────────────────

export const KIND_LABELS: Record<StepKind, string> = {
  'context': 'Context',
  'generator': 'Generator',
  'test-score': 'Test (Score)',
  'test-filter': 'Test (Filter)',
  'result': 'Result',
};

export const KIND_ICONS: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  'context': Target,
  'generator': MapPin,
  'test-score': Gauge,
  'test-filter': AlertTriangle,
  'result': Crosshair,
};

/**
 * Legend entries for the stage-kind colors, **derived from the steps actually
 * rendered** rather than a second hand-maintained color table — so the key can
 * never claim a hue the cards don't use. Kinds absent from every pipeline are
 * omitted instead of shown as a dead entry.
 */
export const KIND_LEGEND: { kind: StepKind; label: string; color: string }[] =
  (Object.keys(KIND_LABELS) as StepKind[]).flatMap((kind) => {
    const step = PIPELINES.flatMap((p) => p.steps).find((s) => s.kind === kind);
    return step ? [{ kind, label: KIND_LABELS[kind], color: step.color }] : [];
  });

// ── Runtime (cost-sorted) test order ───────────────────────────────────────

const TEST_KINDS: StepKind[] = ['test-score', 'test-filter'];

export const isTestStep = (step: PipelineStep): boolean => TEST_KINDS.includes(step.kind);

const COST_RANK: Record<NonNullable<PipelineStep['cost']>, number> = { Low: 0, High: 1 };

/**
 * The order UE5 *actually* runs a pipeline's tests in. The engine sorts EQS
 * tests by declared `EEnvTestCost` before execution, so cheap tests get to
 * eliminate candidates before expensive ones run — independent of the order the
 * tests are authored in. Sorting is stable: equal-cost tests keep authored order.
 */
export function runtimeTestOrder(steps: PipelineStep[]): PipelineStep[] {
  return steps
    .filter(isTestStep)
    .map((step, index) => ({ step, index }))
    .sort((a, b) =>
      (COST_RANK[a.step.cost ?? 'Low'] - COST_RANK[b.step.cost ?? 'Low']) || (a.index - b.index))
    .map(({ step }) => step);
}

/**
 * True when a pipeline lists its tests in an order the engine will not follow —
 * the cue for surfacing the real execution order instead of letting the diagram
 * imply top-to-bottom is what runs.
 */
export function testOrderDiffers(steps: PipelineStep[]): boolean {
  const runtime = runtimeTestOrder(steps);
  return steps.filter(isTestStep).some((step, i) => step.id !== runtime[i]?.id);
}
