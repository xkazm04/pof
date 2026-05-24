'use client';

import { ChevronRight, AlertTriangle } from 'lucide-react';

interface CatalogRowProps {
  catalogId: string;
  label: string;
  total: number;
  verified: number;
  failingCount: number;
  onSelect: (catalogId: string) => void;
}

/**
 * One row in CatalogHubRoot. Label + verified/total progress bar + counts +
 * (optional) failing badge. Click → onSelect(catalogId).
 */
export function CatalogRow({ catalogId, label, total, verified, failingCount, onSelect }: CatalogRowProps) {
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <button
      onClick={() => onSelect(catalogId)}
      className="focus-ring w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-border/40 bg-surface-deep hover:bg-surface/40 hover:border-border transition-colors text-left"
      aria-label={label}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-semibold text-text">{label}</span>
          {failingCount > 0 && (
            <span className="flex items-center gap-1 text-2xs font-mono text-red-500">
              <AlertTriangle className="w-3 h-3" />
              {failingCount} failing
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1.5">
          <div
            data-testid="catalog-row-progress-fill"
            className="h-full bg-emerald-500/70"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-2xs font-mono text-text-muted">
          {total} entries · {verified} verified
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
    </button>
  );
}
