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
import type { StepKind, QueryPipeline } from './types';

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
