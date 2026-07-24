'use client';

import { AlertTriangle } from 'lucide-react';
import { STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { PIPELINES, CUSTOM_COMPONENT_COUNT, KIND_LEGEND } from './constants';
import { QueryPipelineCard } from './QueryPipelineCard';

export type { StepKind, PipelineStep, QueryPipeline } from './types';

// ── Main export ────────────────────────────────────────────────────────────

export function EQSPipelineDiagram() {
  return (
    <div
      className="p-4 space-y-4 overflow-y-auto h-full"
      data-testid="eqs-pipeline-diagram"
      role="region"
      aria-labelledby="eqs-pipeline-heading"
    >
      {/* Intro */}
      <div className="space-y-1">
        <h2 id="eqs-pipeline-heading" className="text-sm font-bold text-text">EQS Query Pipelines</h2>
        <p className="text-xs text-text-muted leading-relaxed max-w-2xl">
          How the {CUSTOM_COMPONENT_COUNT} custom EQS components compose into complete queries.
          Context resolves an actor reference, Generator produces a <code className="font-mono">TArray&lt;FNavLocation&gt;</code>,
          Tests score or filter each point, and the highest-scoring survivor wins.
          Stages are listed in authoring order; UE5 executes tests <em>cost-sorted</em> &mdash;
          cheap scoring first, expensive pathfinding last &mdash; and a pipeline whose two
          orders differ says so above its stage cards.
          Select any stage below to see its C++ class and parameters.
        </p>
      </div>

      {/* Stage-kind key — colors are load-bearing across every card, so they get a
          labeled legend rather than resting on hue alone (WCAG 1.4.1). */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="eqs-kind-legend">
        <MicroLabel uppercase>Stage kinds</MicroLabel>
        <ChartLegend
          dense
          ariaLabel="EQS stage kinds"
          items={KIND_LEGEND.map(({ label, color }) => ({ label, color }))}
        />
      </div>

      {/* Cost explanation */}
      <div
        className="flex items-start gap-3 px-3 py-2 rounded-lg text-xs leading-relaxed"
        style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
        data-testid="eqs-cost-explanation"
        role="note"
      >
        <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
