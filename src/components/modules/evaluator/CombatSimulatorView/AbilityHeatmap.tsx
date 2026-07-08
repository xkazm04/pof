import { BarChart3 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { MetricLabel } from '@/components/ui/MetricLabel';
import { ACCENT_CYAN_LIGHT, STATUS_WARNING } from '@/lib/chart-colors';

// ── Ability Heatmap ─────────────────────────────────────────────────────────

export function AbilityHeatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const entries = Object.entries(heatmap).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const maxUses = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">
          <MetricLabel metricId="abilityHeatmap" label="Ability Usage Heatmap" />
        </h2>
        <span className="text-2xs text-text-muted">(avg uses per fight)</span>
      </div>
      {/* Decode the two bar colors so usage tier isn't conveyed by hue alone. */}
      <ChartLegend
        className="mb-3"
        dense
        ariaLabel="Ability heatmap legend"
        items={[
          { color: ACCENT_CYAN_LIGHT, label: 'Used', description: 'avg uses/fight' },
          { color: STATUS_WARNING, label: 'Under-used', description: '< 0.1/fight' },
        ]}
      />
      <div className="space-y-1.5">
        {entries.map(([name, avgUses]) => {
          const w = (avgUses / maxUses) * 100;
          const isLow = avgUses < 0.1;
          // The longest bars carry their value directly on the bar; shorter rows
          // keep the value in the trailing column so it's never lost in the fill.
          const annotateInline = w >= 45;
          return (
            <div key={name} className="flex items-center gap-3">
              <span className={`text-2xs w-28 truncate flex-shrink-0 ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>{name}</span>
              <div className="relative flex-1 h-4 bg-surface-deep rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isLow ? 'bg-amber-400/50' : 'bg-cyan-400/50'}`}
                  style={{ width: `${w}%` }}
                />
                {annotateInline && (
                  <span
                    className="absolute inset-y-0 flex items-center"
                    style={{ right: `calc(${100 - w}% + 4px)` }}
                  >
                    {/* Dark chip guarantees the value's contrast over any fill color. */}
                    <span className="rounded bg-surface-deep/80 px-1 text-[10px] font-mono font-semibold tabular-nums text-text leading-none">
                      {avgUses.toFixed(1)}
                    </span>
                  </span>
                )}
              </div>
              <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 tabular-nums ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>
                {annotateInline ? '' : avgUses.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
