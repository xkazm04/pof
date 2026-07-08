import { CheckCircle, Clock, HardDrive, AlertTriangle } from 'lucide-react';
import type { BuildStats } from '@/lib/packaging/build-history-store';
import {
  successRateColor, STATUS_ERROR, STATUS_INFO, STATUS_STALE,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { formatBytes, formatDuration } from '@/lib/format';
import { VersionPanel } from './VersionPanel';

// ---------- Metric card ----------

function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <SurfaceCard level={2} className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }} aria-hidden="true">{icon}</span>
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">{label}</span>
      </div>
      <div className="text-base font-semibold text-text leading-tight">{value}</div>
      {sub && <div className="text-2xs text-text-muted mt-0.5">{sub}</div>}
    </SurfaceCard>
  );
}

export function MetricsRow({ stats, version, onBump }: {
  stats: BuildStats; version: string; onBump: (type: 'major' | 'minor' | 'patch') => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <MetricCard
        label="Success Rate"
        value={`${stats.successRate.toFixed(0)}%`}
        sub={`${stats.successCount}/${stats.totalBuilds}`}
        icon={<CheckCircle className="w-3 h-3" />}
        color={successRateColor(stats.successRate)}
      />
      <MetricCard
        label="Avg Duration"
        value={stats.avgDurationMs ? formatDuration(stats.avgDurationMs) : '-'}
        icon={<Clock className="w-3 h-3" />}
        color={STATUS_INFO}
      />
      <MetricCard
        label="Avg Size"
        value={stats.avgSizeBytes ? formatBytes(stats.avgSizeBytes) : '-'}
        icon={<HardDrive className="w-3 h-3" />}
        color={STATUS_STALE}
      />
      <MetricCard
        label="Failed"
        value={stats.failedCount}
        sub={stats.totalBuilds > 0 ? `${(100 - stats.successRate).toFixed(0)}%` : undefined}
        icon={<AlertTriangle className="w-3 h-3" />}
        color={STATUS_ERROR}
      />
      <VersionPanel version={version} onBump={onBump} />
    </div>
  );
}
