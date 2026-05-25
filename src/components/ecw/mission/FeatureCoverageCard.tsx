'use client';

import { useMemo } from 'react';
import { Grid3x3 } from 'lucide-react';
import { useCRUD } from '@/hooks/useCRUD';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';

interface AggregateResponse {
  modules: ModuleAggregate[];
}

const LOWEST_COUNT = 3;

/**
 * Mission Control feature-coverage roll-up (ECW Phase 10-MC — folds in the
 * legacy CrossModuleFeatureDashboard). Reads `/api/feature-matrix/aggregate` and
 * shows overall implemented-feature coverage across modules (done / partial /
 * missing) plus the lowest-coverage modules. Shares the endpoint with the
 * Quality card; this card reads the status counts rather than the scores.
 */
export function FeatureCoverageCard() {
  const { data, isLoading } = useCRUD<AggregateResponse>('/api/feature-matrix/aggregate', { modules: [] });

  const model = useMemo(() => {
    const modules = data.modules ?? [];
    const sum = (key: keyof ModuleAggregate) => modules.reduce((s, m) => s + (Number(m[key]) || 0), 0);
    const total = sum('total');
    const done = sum('implemented') + sum('improved');
    const partial = sum('partial');
    const missing = sum('missing') + sum('unknown');
    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;

    const lowest = [...modules]
      .filter((m) => m.total > 0)
      .map((m) => ({ moduleId: m.moduleId, pct: Math.round(((m.implemented + m.improved) / m.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, LOWEST_COUNT);

    return { total, done, partial, missing, donePct, lowest };
  }, [data.modules]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Grid3x3 className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Feature Coverage</h2>
        <span className="ml-auto text-xs text-text-muted">{model.donePct}% done</span>
      </header>

      {isLoading && model.total === 0 ? (
        <p className="text-xs text-text-muted/60">Loading coverage…</p>
      ) : model.total === 0 ? (
        <p className="text-xs text-text-muted/60">
          No tracked features yet. Feature statuses populate as modules are scanned.
        </p>
      ) : (
        <>
          <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-surface">
            <div style={{ width: `${(model.done / model.total) * 100}%`, backgroundColor: STATUS_SUCCESS }} />
            <div style={{ width: `${(model.partial / model.total) * 100}%`, backgroundColor: STATUS_WARNING }} />
            <div style={{ width: `${(model.missing / model.total) * 100}%`, backgroundColor: STATUS_NEUTRAL }} />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
            <span style={{ color: STATUS_SUCCESS }}>{model.done} done</span>
            <span style={{ color: STATUS_WARNING }}>{model.partial} partial</span>
            <span style={{ color: STATUS_NEUTRAL }}>{model.missing} missing</span>
          </div>

          <div className="space-y-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Lowest coverage</div>
            {model.lowest.map((m) => (
              <div key={m.moduleId} className="flex items-center gap-2 text-2xs font-mono">
                <span className="flex-1 truncate text-text-muted">{m.moduleId}</span>
                <div className="w-24 h-1.5 rounded-full bg-surface overflow-hidden">
                  <div className="h-full" style={{ width: `${m.pct}%`, backgroundColor: STATUS_SUCCESS }} />
                </div>
                <span className="w-7 text-right text-text">{m.pct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
