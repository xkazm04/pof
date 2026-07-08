'use client';

import { Lightbulb } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { PromptInsight } from '@/types/session-analytics';
import { STATUS_WARNING } from '@/lib/chart-colors';

export function InsightCard({ insight }: { insight: PromptInsight }) {
  const confidencePercent = Math.round(insight.confidence * 100);

  return (
    <SurfaceCard level={2} className="flex items-start gap-3 px-3 py-2.5">
      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: STATUS_WARNING }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-text">{insight.message}</span>
          <span className="text-2xs px-1 py-0.5 rounded bg-border text-text-muted flex-shrink-0">
            {confidencePercent}% confidence
          </span>
        </div>
        <p className="text-xs text-text-muted-hover leading-relaxed">{insight.suggestion}</p>
        <span className="text-2xs text-text-muted mt-0.5 inline-block">{insight.moduleId}</span>
      </div>
    </SurfaceCard>
  );
}
