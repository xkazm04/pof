'use client';

import { AlertTriangle } from 'lucide-react';
import { STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';
import { PIPELINES } from './constants';
import { QueryPipelineCard } from './QueryPipelineCard';

export type { StepKind, PipelineStep, QueryPipeline } from './types';

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
