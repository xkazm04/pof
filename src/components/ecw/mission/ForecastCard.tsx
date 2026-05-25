'use client';

import { useMemo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useCatalogRoster } from '@/components/ecw/catalogs/useCatalogRoster';
import { computeVelocityForecast } from '@/lib/ecw/forecast';

// Bootstrap anchor captured ONCE at module load — never read wall-clock in
// render (react-hooks/purity rule; see reference_react_hooks_purity_rule).
// Replaced by persisted lifecycle history in Phase 10-MC.
const BOOTSTRAP_HISTORY_AT = Date.now() - 7 * 86_400_000;

/**
 * Mission Control forecast card. Phase 5 shipped this as a placeholder; the
 * Phase 11-OBS batch added `computeVelocityForecast` and this card now
 * exercises it with current totals + a single-point history bootstrap (the
 * project's earliest known catalog snapshot — for now, "now minus 7 days" with
 * 50% of current verified, so the card always shows a non-null forecast even
 * before lifecycle history persistence lands).
 *
 * Phase 10-MC will replace the bootstrap with real lifecycle-history snapshots
 * from a new persistent store. The forecast shape and rendering here stay.
 */
export function ForecastCard() {
  const roster = useCatalogRoster();

  const forecast = useMemo(() => {
    const total = roster.reduce((s, r) => s + r.total, 0);
    const verified = roster.reduce((s, r) => s + r.verified, 0);
    // Bootstrap: synthesize a 7-day-ago snapshot at half the current verified
    // count. Replaces with persisted history in Phase 10-MC.
    const history = verified > 0
      ? [{ verified: Math.floor(verified / 2), at: BOOTSTRAP_HISTORY_AT }]
      : [];
    return computeVelocityForecast({ verified, total, history });
  }, [roster]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Forecast</h2>
      </header>

      {forecast ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{forecast.daysRemaining}</span>
            <span className="text-xs text-text-muted">days until verified</span>
          </div>
          <div className="text-2xs font-mono text-text-muted space-y-0.5">
            <div>velocity · <span className="text-text">{forecast.velocityPerDay} verified / day</span></div>
            <div>confidence · <span className="text-text">{(forecast.confidence * 100).toFixed(0)}%</span></div>
          </div>
          <p className="text-2xs text-text-muted/60 italic pt-1 border-t border-border/20">
            Bootstrapped from a 7-day estimate · real history persistence in P10-MC
          </p>
        </div>
      ) : (
        <div className="text-xs text-text-muted/70 italic flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Awaiting first verified entity to compute velocity.
        </div>
      )}
    </section>
  );
}
