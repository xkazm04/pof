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
import { eqsComponent, type EQSComponentId } from '@/lib/ai-director/eqs-catalog';
import type { StepKind, PipelineStep, QueryPipeline } from './types';

// The runtime test order is shared with the squad composed pipeline, so it lives
// with the catalog; re-exported here for the diagram's existing imports.
export { isTestStep, runtimeTestOrder, testOrderDiffers } from '@/lib/ai-director/eqs-catalog';

/** Stage color per kind — one table, so a kind can never render two hues. */
const KIND_COLORS: Record<StepKind, string> = {
  'context': ACCENT_CYAN,
  'generator': ACCENT_VIOLET,
  'test-score': ACCENT_EMERALD,
  'test-filter': ACCENT_ORANGE,
  'result': STATUS_SUCCESS,
};

/** A pipeline step that instantiates a catalog component: identity comes from the catalog. */
function componentStep(
  id: string,
  componentId: EQSComponentId,
  detail: string,
  params?: PipelineStep['params'],
): PipelineStep {
  const entry = eqsComponent(componentId);
  if (entry.kind === 'director') throw new Error(`"${componentId}" is not an EQS query step`);
  return {
    id,
    componentId,
    label: entry.label,
    cppClass: entry.cppClass,
    kind: entry.kind,
    color: KIND_COLORS[entry.kind],
    detail,
    ...(entry.cost ? { cost: entry.cost } : {}),
    ...(entry.status === 'engine' ? { builtIn: true } : {}),
    ...(params ? { params } : {}),
  };
}

function resultStep(id: string, label: string, detail: string): PipelineStep {
  return { id, label, cppClass: '', kind: 'result', color: KIND_COLORS.result, detail };
}

const PATH_EXISTS_PARAMS = [
  { label: 'PathFrom', value: 'Querier' },
  { label: 'Result', value: '1.0 / 0.0 (bool)' },
  { label: 'Method', value: 'TestPathSync()' },
];

export const PIPELINES: QueryPipeline[] = [
  {
    id: 'find-attack',
    name: 'FindAttackPosition',
    description: 'Locate flanking positions around the target actor for melee/ranged attacks',
    icon: Crosshair,
    steps: [
      componentStep('ctx-target', 'ctx-target-actor', 'Resolves TargetActor blackboard key → AActor*', [
        { label: 'Source', value: 'Blackboard: TargetActor' },
      ]),
      componentStep('gen-attack', 'gen-attack-positions', 'Generates ring of nav-projected points around center actor', [
        { label: 'AttackDistance', value: eqsFloat(EQS_ATTACK_POSITIONS.attackDistance) },
        { label: 'NumberOfPoints', value: String(EQS_ATTACK_POSITIONS.numberOfPoints) },
        { label: 'InnerRing', value: String(EQS_ATTACK_POSITIONS.generateInnerRing) },
        { label: 'Output', value: 'TArray<FNavLocation>' },
      ]),
      componentStep('test-flank', 'test-flank-angle', 'Scores by angle from target forward vector (0°=front → 180°=behind)', [
        { label: 'TargetContext', value: 'TargetActor' },
        { label: 'Score', value: '0° – 180°' },
        { label: 'Best', value: '180° (behind)' },
      ]),
      componentStep('test-path-attack', 'test-path-exists', 'Filters unreachable points via synchronous nav path query', PATH_EXISTS_PARAMS),
      resultStep('result-attack', 'Best Position', 'Highest-scoring reachable flank point selected'),
    ],
  },
  {
    id: 'find-cover',
    name: 'FindCoverPosition',
    description: 'Locate terrain-aware cover positions using geometry traces, LOS exposure scoring, and elevation advantage',
    icon: Shield,
    steps: [
      componentStep('ctx-target-cover', 'ctx-target-actor', 'Resolves TargetActor (threat) blackboard key for cover evaluation', [
        { label: 'Source', value: 'Blackboard: TargetActor' },
      ]),
      componentStep('gen-cover', 'gen-cover-positions', 'Traces geometry in annular rings to find positions behind walls, pillars, and elevation changes', [
        { label: 'SampleCount', value: String(EQS_COVER_POSITIONS.sampleCount) },
        { label: 'NumberOfRings', value: String(EQS_COVER_POSITIONS.numberOfRings) },
        { label: 'MinRadius', value: eqsFloat(EQS_COVER_POSITIONS.minRadius) },
        { label: 'MaxRadius', value: eqsFloat(EQS_COVER_POSITIONS.maxRadius) },
        { label: 'CoverCheckDistance', value: eqsFloat(EQS_COVER_POSITIONS.coverCheckDistance) },
        { label: 'TraceChannel', value: 'ECC_WorldStatic' },
        { label: 'Output', value: 'TArray<FNavLocation>' },
      ]),
      componentStep('test-los', 'test-line-of-sight', 'Multi-height trace to threat — scores by occlusion percentage (1.0 = fully hidden)', [
        { label: 'ThreatContext', value: 'TargetActor' },
        { label: 'TraceHeights', value: `${EQS_LINE_OF_SIGHT.numberOfTraceHeights} (${EQS_LINE_OF_SIGHT.minTraceHeight}-${EQS_LINE_OF_SIGHT.maxTraceHeight} UU)` },
        { label: 'Score', value: '0.0 (exposed) – 1.0 (covered)' },
        { label: 'Best', value: '1.0 (fully occluded)' },
      ]),
      componentStep('test-elev', 'test-elevation-advantage', 'Scores height difference vs threat — prefers high ground positions', [
        { label: 'ReferenceContext', value: 'TargetActor' },
        { label: 'MaxElevationBonus', value: `${eqsFloat(EQS_ELEVATION_ADVANTAGE.maxElevationBonus)} UU` },
        { label: 'PenalizeLowGround', value: 'false' },
        { label: 'Score', value: '0.0 – 1.0 (clamped)' },
      ]),
      componentStep('test-path-cover', 'test-path-exists', 'Filters unreachable cover points via synchronous nav path query', PATH_EXISTS_PARAMS),
      resultStep('result-cover', 'Best Cover', 'Highest-scoring reachable cover position with LOS occlusion + elevation bonus'),
    ],
  },
  {
    id: 'find-patrol',
    name: 'FindPatrolPoint',
    description: 'Select random reachable patrol destination for idle wandering',
    icon: Route,
    steps: [
      componentStep('ctx-querier', 'ctx-querier', 'Built-in context: the AI pawn running the query'),
      componentStep('gen-patrol', 'gen-patrol-points', 'Random points in annular ring around querier, projected to nav mesh', [
        { label: 'NumberOfPoints', value: String(EQS_PATROL_POINTS.numberOfPoints) },
        { label: 'MinRadius', value: eqsFloat(EQS_PATROL_POINTS.minRadius) },
        { label: 'MaxRadius', value: eqsFloat(EQS_PATROL_POINTS.maxRadius) },
        { label: 'Output', value: 'TArray<FNavLocation>' },
      ]),
      componentStep('test-path-patrol', 'test-path-exists', 'Filters unreachable points — runs last due to high nav cost', PATH_EXISTS_PARAMS),
      resultStep('result-patrol', 'Patrol Target', 'Random reachable point selected as patrol destination'),
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
