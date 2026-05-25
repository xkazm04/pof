'use client';

import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { useCRUD } from '@/hooks/useCRUD';
import { qualityColor } from '@/lib/chart-colors';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';

interface AggregateResponse {
  modules: ModuleAggregate[];
}

const WORST_COUNT = 3;

/**
 * Mission Control quality roll-up (ECW Phase 10-MC — folds in the legacy
 * AggregateQuality / ProjectHealth / UnifiedSummary quality signal). Reads
 * `/api/feature-matrix/aggregate` and shows the overall reviewed-quality score,
 * how many modules are still unreviewed, and the weakest modules to look at next.
 */
export function QualityRollupCard() {
  const { data, isLoading } = useCRUD<AggregateResponse>('/api/feature-matrix/aggregate', { modules: [] });

  const model = useMemo(() => {
    const modules = data.modules ?? [];
    const reviewed = modules.filter((m) => m.avgQuality !== null);
    const overall =
      reviewed.length > 0
        ? Math.round(reviewed.reduce((s, m) => s + (m.avgQuality ?? 0), 0) / reviewed.length)
        : null;
    const worst = [...reviewed]
      .sort((a, b) => (a.avgQuality ?? 0) - (b.avgQuality ?? 0))
      .slice(0, WORST_COUNT);
    return { total: modules.length, reviewedCount: reviewed.length, overall, worst };
  }, [data.modules]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Project Quality</h2>
        {model.overall !== null && (
          <span className="ml-auto text-lg font-bold" style={{ color: qualityColor(model.overall) }}>
            {model.overall}
          </span>
        )}
      </header>

      {isLoading && model.total === 0 ? (
        <p className="text-xs text-text-muted/60">Loading quality…</p>
      ) : model.reviewedCount === 0 ? (
        <p className="text-xs text-text-muted/60">
          No module reviews yet. Run a module review to populate quality scores.
        </p>
      ) : (
        <>
          <div className="text-xs text-text-muted mb-3">
            {model.reviewedCount} of {model.total} modules reviewed
          </div>
          <div className="space-y-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Weakest modules</div>
            {model.worst.map((m) => (
              <div key={m.moduleId} className="flex items-center gap-2 text-2xs font-mono">
                <span className="flex-1 truncate text-text-muted">{m.moduleId}</span>
                <div className="w-24 h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${m.avgQuality ?? 0}%`, backgroundColor: qualityColor(m.avgQuality ?? 0) }}
                  />
                </div>
                <span className="w-7 text-right text-text">{Math.round(m.avgQuality ?? 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
