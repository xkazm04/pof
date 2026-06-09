'use client';

import { BarChart3 } from 'lucide-react';

interface ChartEmptyStateProps {
  /** Short reason shown to the user (e.g. why the series can't be plotted). */
  message?: string;
  /** Tailwind height class to match the chart it replaces. */
  height?: string;
}

/**
 * Compact in-place empty state for a normalized chart whose series has no spread
 * (flat / all-zero / single-point / empty). Replaces a silently-broken NaN
 * polyline with an explicit, debuggable signal. Carries `role="status"` so the
 * change is announced to assistive tech.
 */
export function ChartEmptyState({
  message = 'No data to plot — series has no spread',
  height = 'h-[200px]',
}: ChartEmptyStateProps) {
  return (
    <div
      role="status"
      className={`w-full ${height} min-h-[200px] bg-surface-deep/30 rounded-xl border border-border/40 flex flex-col items-center justify-center gap-2 text-text-muted`}
    >
      <BarChart3 className="w-6 h-6 opacity-40" />
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-center px-4">{message}</span>
    </div>
  );
}
