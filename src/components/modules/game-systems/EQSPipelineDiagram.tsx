'use client';

import { useState, useCallback } from 'react';
import {
  ArrowRight, Target, MapPin, Crosshair, Route, Shield,
  ChevronDown, ChevronRight, AlertTriangle, Gauge,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Pipeline data (from C++ EQS sources) ───────────────────────────────────

type StepKind = 'context' | 'generator' | 'test-score' | 'test-filter' | 'result';

interface PipelineStep {
  id: string;
  label: string;
  cppClass: string;
  kind: StepKind;
  color: string;
  detail: string;
  cost?: 'Low' | 'High';
  params?: { label: string; value: string }[];
}

interface QueryPipeline {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: PipelineStep[];
}

const PIPELINES: QueryPipeline[] = [
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
          { label: 'AttackDistance', value: '200.0' },
          { label: 'NumberOfPoints', value: '12' },
          { label: 'InnerRing', value: 'false' },
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
          { label: 'SampleCount', value: '36' },
          { label: 'NumberOfRings', value: '3' },
          { label: 'MinRadius', value: '300.0' },
          { label: 'MaxRadius', value: '1200.0' },
          { label: 'CoverCheckDistance', value: '150.0' },
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
          { label: 'TraceHeights', value: '3 (40-170 UU)' },
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
          { label: 'MaxElevationBonus', value: '300.0 UU' },
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
          { label: 'NumberOfPoints', value: '15' },
          { label: 'MinRadius', value: '500.0' },
          { label: 'MaxRadius', value: '1500.0' },
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

const KIND_LABELS: Record<StepKind, string> = {
  'context': 'Context',
  'generator': 'Generator',
  'test-score': 'Test (Score)',
  'test-filter': 'Test (Filter)',
  'result': 'Result',
};

const KIND_ICONS: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  'context': Target,
  'generator': MapPin,
  'test-score': Gauge,
  'test-filter': AlertTriangle,
  'result': Crosshair,
};

// ── Components ─────────────────────────────────────────────────────────────

function StepCard({ step, expanded, onToggle }: { step: PipelineStep; expanded: boolean; onToggle: () => void }) {
  const KindIcon = KIND_ICONS[step.kind];

  return (
    <div
      className="rounded-lg border border-border/40 overflow-hidden"
      style={{ borderColor: `${step.color}30` }}
      data-testid={`eqs-step-${step.id}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/3 transition-colors"
        data-testid={`eqs-step-${step.id}-toggle`}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span style={{ color: step.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold text-text">{step.label}</span>
        <span
          className="text-2xs font-medium px-1.5 py-0.5 rounded ml-auto shrink-0"
          style={{ color: step.color, backgroundColor: `${step.color}${OPACITY_15}` }}
        >
          {KIND_LABELS[step.kind]}
        </span>
        {step.cost && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: step.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS,
              backgroundColor: `${step.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS}${OPACITY_15}`,
            }}
          >
            Cost: {step.cost}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-border/20 space-y-1.5">
          <p className="text-2xs text-text-muted">{step.detail}</p>
          {step.cppClass && (
            <p className="text-2xs font-mono text-text-muted" style={{ color: step.color }}>
              {step.cppClass}
            </p>
          )}
          {step.params && step.params.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {step.params.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="text-2xs text-text-muted w-28 shrink-0">{p.label}</span>
                  <span className="text-2xs font-mono text-text">{p.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PipelineArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <ArrowRight className="w-3.5 h-3.5" style={{ color }} />
    </div>
  );
}

function QueryPipelineCard({ pipeline }: { pipeline: QueryPipeline }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const PIcon = pipeline.icon;

  const toggleStep = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid={`eqs-pipeline-${pipeline.id}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_VIOLET }}><PIcon className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">{pipeline.name}</h3>
          <p className="text-2xs text-text-muted">{pipeline.description}</p>
        </div>
        <span className="text-2xs text-text-muted">{pipeline.steps.length} stages</span>
      </div>

      {/* Flow: horizontal summary bar */}
      <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-1 flex-wrap">
        {pipeline.steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1">
            <span
              className="text-2xs font-mono px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: `${step.color}${OPACITY_10}`,
                color: step.color,
                border: `1px solid ${step.color}30`,
              }}
            >
              {step.label}
            </span>
            {i < pipeline.steps.length - 1 && (
              <ArrowRight className="w-3 h-3 text-text-muted" />
            )}
          </div>
        ))}
      </div>

      {/* Detailed step cards */}
      <div className="p-3 space-y-0">
        {pipeline.steps.map((step, i) => (
          <div key={step.id}>
            <StepCard
              step={step}
              expanded={expanded.has(step.id)}
              onToggle={() => toggleStep(step.id)}
            />
            {i < pipeline.steps.length - 1 && (
              <PipelineArrow color={pipeline.steps[i + 1].color} />
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function EQSPipelineDiagram() {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="eqs-pipeline-diagram">
      {/* Intro */}
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-text">EQS Query Pipelines</h2>
        <p className="text-2xs text-text-muted leading-relaxed max-w-2xl">
          How the 8 custom EQS components compose into complete queries.
          Context resolves an actor reference, Generator produces an <code className="font-mono">TArray&lt;FNavLocation&gt;</code>,
          Tests score or filter each point, and the highest-scoring survivor wins.
          Tests run in cost order &mdash; cheap scoring first, expensive pathfinding last.
        </p>
      </div>

      {/* Cost explanation */}
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-2xs"
        style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
        data-testid="eqs-cost-explanation"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>PathExists</strong> uses <code className="font-mono">TestPathSync()</code> &mdash; marked
          <code className="font-mono mx-0.5">EEnvTestCost::High</code> because synchronous nav queries
          are expensive. UE5 runs high-cost tests last so cheaper tests can eliminate candidates first.
        </span>
      </div>

      {/* Pipeline cards */}
      {PIPELINES.map((pipeline) => (
        <QueryPipelineCard key={pipeline.id} pipeline={pipeline} />
      ))}
    </div>
  );
}
