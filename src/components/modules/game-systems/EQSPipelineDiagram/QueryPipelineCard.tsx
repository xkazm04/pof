'use client';

import { useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ChipButton } from '@/components/ui/ChipButton';
import { ACCENT_VIOLET, OPACITY_10 } from '@/lib/chart-colors';
import { StepCard, PipelineArrow } from './StepCard';
import type { QueryPipeline } from './types';

export function QueryPipelineCard({ pipeline }: { pipeline: QueryPipeline }) {
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
            <ChipButton as="span" color={step.color} mono tone="outline">
              {step.label}
            </ChipButton>
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
