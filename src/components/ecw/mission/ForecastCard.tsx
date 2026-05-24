'use client';

import { TrendingUp } from 'lucide-react';

/**
 * Mission Control forecast card. Placeholder for Phase 5 — the real
 * forecaster (playable-by ETA · velocity · NBA queue · cook forecaster ·
 * what-if simulator) lands as Phase 10 enhancement work pulling from the
 * KEEP-CORE ideas (925151c6, 8a45533b, 21cea6d3, 96f25afc, d67fa562, etc.).
 */
export function ForecastCard() {
  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Forecast</h2>
      </header>
      <p className="text-xs text-text-muted/70 italic mb-2">
        Lands in Phase 10 enhancement work:
      </p>
      <ul className="text-2xs font-mono text-text-muted space-y-1 list-disc list-inside">
        <li>playable-by ETA + confidence</li>
        <li>NBA queue (next best action)</li>
        <li>predictive cook forecaster</li>
        <li>what-if scenario simulator</li>
        <li>critical-path DAG overlay</li>
      </ul>
    </section>
  );
}
