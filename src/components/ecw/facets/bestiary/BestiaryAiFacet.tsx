'use client';

import { useMemo } from 'react';
import { Brain, CheckCircle2, Circle } from 'lucide-react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { lintAiCoverage } from '@/lib/bestiary/ai-coverage';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function btSummaryOf(data: unknown): Record<string, string> | null {
  if (!data || typeof data !== 'object') return null;
  const bt = (data as { btSummary?: unknown }).btSummary;
  if (!bt || typeof bt !== 'object') return null;
  return bt as Record<string, string>;
}

/**
 * AI Behavior facet (ECW Phase 10-B). Renders the archetype's btSummary
 * behaviors and a coverage check against the core combat behaviors (aggro /
 * attack / patrol / retreat) — flags gaps an enemy needs before it's playable.
 */
export function BestiaryAiFacet({ entity }: Props) {
  const bt = btSummaryOf(entity.data);
  const findings = useMemo(() => (bt ? lintAiCoverage(bt) : null), [bt]);

  if (!bt || !findings) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No AI behavior summary for this entity.</div>;
  }

  const coveredCount = findings.filter((f) => f.covered).length;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">AI Coverage</span>
        <span className="ml-auto text-xs text-text-muted">{coveredCount} / {findings.length} core behaviors</span>
      </div>

      <ul className="space-y-1.5">
        {findings.map((f) => (
          <li key={f.behavior} className="flex items-start gap-2 text-xs">
            {f.covered
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
              : <Circle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-text-muted/50" />}
            <span className="w-28 shrink-0 text-text-muted">{f.label}</span>
            <span className={f.covered ? 'text-text' : 'text-text-muted/60 italic'}>
              {f.covered ? f.detail : 'not defined'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

registerFacet('bestiary', { id: 'ai', label: 'AI', Component: BestiaryAiFacet });
