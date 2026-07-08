import { CheckCircle, XCircle } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import { successRateColor } from '@/lib/chart-colors';
import type { TargetHealth } from '@/lib/ue5-bridge/build-health';
import { ACCENT } from './constants';
import { statusColor } from './helpers';

export function TargetRow({ target, maxAvg }: { target: TargetHealth; maxAvg: number }) {
  const widthPct = Math.round(((target.avgDurationMs ?? 0) / maxAvg) * 100);
  return (
    <div data-target={target.targetName} className="text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 min-w-0">
          {target.lastStatus === 'success'
            ? <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: statusColor(target.lastStatus) }} />
            : <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: statusColor(target.lastStatus) }} />}
          <span className="font-mono text-text truncate">{target.targetName}</span>
          <span className="text-2xs text-text-muted">({target.builds})</span>
        </span>
        <span className="font-mono text-text-muted flex-shrink-0">{target.avgDurationMs != null ? formatDuration(target.avgDurationMs) : '—'}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${widthPct}%`, backgroundColor: ACCENT }} />
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-2xs text-text-muted">
        <span style={{ color: successRateColor(target.successRate) }}>{target.successRate}% pass</span>
        {target.maxDurationMs != null && <span>peak {formatDuration(target.maxDurationMs)}</span>}
      </div>
    </div>
  );
}
