'use client';

import { TrendingUp, BarChart3 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { EconomyMetrics } from '@/types/economy-simulator';
import { formatGold } from './helpers';

// ── Gold Flow Chart (ASCII bar chart) ───────────────────────────────────────

export function GoldFlowChart({ metrics }: { metrics: EconomyMetrics[] }) {
  if (metrics.length === 0) return null;

  const maxFlow = Math.max(
    ...metrics.map((m) => Math.max(m.inflowPerHour, m.outflowPerHour, 1)),
  );
  // Sample ~20 data points for the chart
  const step = Math.max(1, Math.floor(metrics.length / 20));
  const sampled = metrics.filter((_, i) => i % step === 0);
  const first = sampled[0];
  const last = sampled[sampled.length - 1];

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Gold Flow Over Time</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-2xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Inflow</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Outflow</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Net</span>
        </div>
      </div>

      {/* Screen-reader summary of the whole series — the focusable bars below
          expose each sampled point, this gives the shape at a glance. */}
      <p className="sr-only">
        Gold flow across {sampled.length} sampled hours, from hour {first?.hour ?? 0} to hour{' '}
        {last?.hour ?? 0}. Final inflow {formatGold(last?.inflowPerHour ?? 0)} per hour, outflow{' '}
        {formatGold(last?.outflowPerHour ?? 0)} per hour, net{' '}
        {(last?.netFlowPerHour ?? 0) >= 0 ? '+' : ''}{formatGold(last?.netFlowPerHour ?? 0)} per hour.
        Each bar below is focusable for its exact figures.
      </p>

      <div className="flex items-end gap-1 h-32" role="group" aria-label="Gold flow per sampled hour">
        {sampled.map((m, i) => {
          const inflowH = (m.inflowPerHour / maxFlow) * 100;
          const outflowH = (m.outflowPerHour / maxFlow) * 100;
          const net = m.netFlowPerHour;
          return (
            <div
              key={i}
              tabIndex={0}
              role="img"
              aria-label={`Hour ${m.hour}, level ${m.level}: inflow ${formatGold(m.inflowPerHour)} per hour, outflow ${formatGold(m.outflowPerHour)} per hour, net ${net >= 0 ? '+' : ''}${formatGold(net)} per hour, average gold ${formatGold(m.avgGold)}`}
              className="flex-1 flex flex-col items-center gap-0.5 group relative focus-ring rounded-sm"
            >
              {/* Tooltip — shown on hover and keyboard focus */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block group-focus-within:block z-10">
                <div className="bg-surface-deep border border-border rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-lg">
                  <div className="text-text-muted">Hour {m.hour} · Lvl {m.level}</div>
                  <div className="text-emerald-400">In: {formatGold(m.inflowPerHour)}/hr</div>
                  <div className="text-red-400">Out: {formatGold(m.outflowPerHour)}/hr</div>
                  <div className={net >= 0 ? 'text-amber-400' : 'text-red-400'}>
                    Net: {net >= 0 ? '+' : ''}{formatGold(net)}/hr
                  </div>
                  <div className="text-text-muted">Avg Gold: {formatGold(m.avgGold)}</div>
                </div>
              </div>
              {/* Bars */}
              <div className="w-full flex gap-px h-full items-end">
                <div
                  className="flex-1 bg-emerald-400/40 rounded-t-sm transition-all hover:bg-emerald-400/60"
                  style={{ height: `${inflowH}%` }}
                />
                <div
                  className="flex-1 bg-red-400/40 rounded-t-sm transition-all hover:bg-red-400/60"
                  style={{ height: `${outflowH}%` }}
                />
              </div>
              {/* X-axis label */}
              {i % Math.max(1, Math.floor(sampled.length / 8)) === 0 && (
                <span className="text-2xs text-text-muted/60 mt-1">{m.hour}h</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Gold accumulation line (text-based) */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-3 h-3 text-amber-400" />
          <span className="text-2xs text-text-muted font-medium">Avg Gold Accumulation</span>
        </div>
        <div className="flex items-end gap-px h-12">
          {sampled.map((m, i) => {
            const maxGold = Math.max(...sampled.map((s) => s.avgGold), 1);
            const h = (m.avgGold / maxGold) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-amber-400/30 rounded-t-sm"
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}
