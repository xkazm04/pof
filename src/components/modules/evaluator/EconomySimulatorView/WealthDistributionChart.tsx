'use client';

import { Users } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { EconomyMetrics, PlayerSnapshot } from '@/types/economy-simulator';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { WEALTH_STACK_BREAKPOINT } from './constants';
import { wealthGridClassFromWide, formatGold } from './helpers';

// ── Wealth Distribution ─────────────────────────────────────────────────────

export function WealthDistributionChart({ metrics, snapshots }: {
  metrics: EconomyMetrics[];
  snapshots: PlayerSnapshot[];
}) {
  // Stack the Gini/histogram pair into one column on narrow/zoomed viewports.
  // Only the breakpoint boolean matters, so subscribe to the threshold — a resize
  // that doesn't cross WEALTH_STACK_BREAKPOINT re-renders nothing.
  const gridCols = wealthGridClassFromWide(useViewportAtLeast(WEALTH_STACK_BREAKPOINT));

  if (snapshots.length === 0) return null;

  // Gini over time
  const step = Math.max(1, Math.floor(metrics.length / 20));
  const giniSampled = metrics.filter((_, i) => i % step === 0);

  // Wealth buckets for histogram
  const golds = snapshots.map((s) => s.gold).sort((a, b) => a - b);
  const maxG = golds[golds.length - 1] || 1;
  const bucketCount = 10;
  const bucketSize = maxG / bucketCount;
  const buckets = new Array(bucketCount).fill(0);
  for (const g of golds) {
    const idx = Math.min(Math.floor(g / bucketSize), bucketCount - 1);
    buckets[idx]++;
  }
  const maxBucket = Math.max(...buckets, 1);

  const lastGini = metrics.length > 0 ? metrics[metrics.length - 1].giniCoefficient : 0;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-medium text-text">Wealth Distribution</h2>
        <div className="flex-1" />
        <Badge variant={lastGini > 0.6 ? 'error' : lastGini > 0.4 ? 'warning' : 'success'}>
          Gini: {lastGini.toFixed(3)}
        </Badge>
      </div>

      <div className={`grid ${gridCols} gap-4`}>
        {/* Gini over time */}
        <div>
          <div className="text-2xs text-text-muted font-medium mb-1">Gini Coefficient Over Time</div>
          <p className="sr-only">
            Gini coefficient across {giniSampled.length} sampled hours; final value {lastGini.toFixed(3)}.
            Each bar is focusable for its hour and value.
          </p>
          <div className="flex items-end gap-px h-20" role="group" aria-label="Gini coefficient per sampled hour">
            {giniSampled.map((m, i) => {
              const h = m.giniCoefficient * 100;
              const color = m.giniCoefficient > 0.6 ? 'bg-red-400/50' : m.giniCoefficient > 0.4 ? 'bg-amber-400/50' : 'bg-violet-400/50';
              return (
                <div
                  key={i}
                  tabIndex={0}
                  role="img"
                  aria-label={`Hour ${m.hour}: Gini ${m.giniCoefficient.toFixed(3)}`}
                  className="flex-1 group relative focus-ring rounded-sm"
                >
                  <div className={`${color} rounded-t-sm w-full`} style={{ height: `${h}%` }} />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block group-focus-within:block z-10 left-1/2 -translate-x-1/2">
                    <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                      H{m.hour}: {m.giniCoefficient.toFixed(3)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
            <span>0h</span>
            <span>{metrics[metrics.length - 1]?.hour ?? 0}h</span>
          </div>
        </div>

        {/* Wealth histogram */}
        <div>
          <div className="text-2xs text-text-muted font-medium mb-1">Endgame Gold Distribution</div>
          <p className="sr-only">
            Endgame gold spread across {snapshots.length} players in {bucketCount} buckets from 0 to{' '}
            {formatGold(maxG)} gold. Each bar is focusable for its range and player count.
          </p>
          <div className="flex items-end gap-1 h-20" role="group" aria-label="Endgame gold distribution by bucket">
            {buckets.map((count, i) => {
              const h = (count / maxBucket) * 100;
              return (
                <div
                  key={i}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatGold(Math.round(i * bucketSize))} to ${formatGold(Math.round((i + 1) * bucketSize))} gold: ${count} players`}
                  className="flex-1 group relative focus-ring rounded-sm"
                >
                  <div className="bg-amber-400/40 rounded-t-sm w-full" style={{ height: `${h}%` }} />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block group-focus-within:block z-10 left-1/2 -translate-x-1/2">
                    <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                      {formatGold(Math.round(i * bucketSize))}-{formatGold(Math.round((i + 1) * bucketSize))}: {count} players
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
            <span>0g</span>
            <span>{formatGold(maxG)}</span>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
