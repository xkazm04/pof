'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useCatalogRoster } from '@/components/ecw/catalogs/useCatalogRoster';

/**
 * Mission Control catalog roll-up: a single overall progress bar (total
 * verified / total entities across the 8 catalogs) plus a strip of mini bars
 * per catalog with hover labels. Reads `useCatalogRoster`.
 */
export function CatalogRollupCard() {
  const roster = useCatalogRoster();

  const totals = useMemo(() => {
    const total = roster.reduce((s, r) => s + r.total, 0);
    const verified = roster.reduce((s, r) => s + r.verified, 0);
    const failing = roster.reduce((s, r) => s + r.failingCount, 0);
    const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, failing, pct };
  }, [roster]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Catalog Lifecycle</h2>
        <span className="ml-auto text-2xs font-mono text-text-muted">
          {totals.verified} of {totals.total} verified
          {totals.failing > 0 && <span className="text-red-500"> · {totals.failing} failing</span>}
        </span>
      </header>

      <div className="h-2 rounded-full bg-surface overflow-hidden mb-3">
        <div className="h-full bg-emerald-500/70" style={{ width: `${totals.pct}%` }} />
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {roster.map((r) => {
          const pct = r.total > 0 ? Math.round((r.verified / r.total) * 100) : 0;
          return (
            <li key={r.catalogId} data-testid="catalog-rollup-mini" className="space-y-1">
              <div className="flex items-center justify-between text-2xs font-mono">
                <span className="truncate text-text-muted">{r.label}</span>
                <span className="text-text-muted/70">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
