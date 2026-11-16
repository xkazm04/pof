import type { BuildStats } from '@/lib/packaging/build-history-store';
import { platformLabel } from '@/lib/packaging/build-profiles';
import { successRateColor } from '@/lib/chart-colors';
import { formatBytes } from '@/lib/format';

export function PlatformBreakdown({ stats }: { stats: BuildStats }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.platforms.map((p) => {
        // Nothing decided (every cook cancelled): the rate is not 0%, it does not exist.
        const decided = p.decided ?? p.success + p.failed;
        const cancelled = p.cancelled ?? 0;
        return (
        <div key={p.platform} className="rounded border border-border bg-surface-deep/60 px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-muted">{platformLabel(p.platform)}</span>
            {decided > 0 ? (
              <span className="text-2xs font-mono" style={{ color: successRateColor(p.successRate) }}>
                {p.successRate.toFixed(0)}%
              </span>
            ) : (
              <span className="text-2xs font-mono text-text-muted">-</span>
            )}
          </div>
          {decided > 0 && (
            <div
              className="w-full h-1 rounded-full bg-surface-hover overflow-hidden mb-1"
              role="progressbar"
              aria-valuenow={Math.round(p.successRate)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${platformLabel(p.platform)} success rate`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${p.successRate}%`, backgroundColor: successRateColor(p.successRate) }}
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-2xs text-text-muted">
            <span>{p.total} builds</span>
            {cancelled > 0 && <span>{cancelled} cancelled</span>}
            {p.latestSizeBytes != null && <span>{formatBytes(p.latestSizeBytes)}</span>}
          </div>
        </div>
        );
      })}
    </div>
  );
}
