import { KPICard } from '@/components/ui/KPICard';
import { MetricLabel } from '@/components/ui/MetricLabel';

// ── Small Components ────────────────────────────────────────────────────────

export function StatCard({ icon, value, label, color, metricId }: {
  icon: React.ReactNode; value: string | number; label: string; color: string;
  /** When set, the label decodes its jargon via an inline `MetricLabel` tooltip. */
  metricId?: string;
}) {
  return (
    <KPICard
      icon={icon}
      label={metricId ? <MetricLabel metricId={metricId} label={label} /> : label}
      value={<span className={color}>{value}</span>}
    />
  );
}

export function MiniStat({ label, value, alert, metricId }: {
  label: string; value: string; alert?: boolean;
  /** When set, the label decodes its jargon via an inline `MetricLabel` tooltip. */
  metricId?: string;
}) {
  return (
    <div>
      <div className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-text'}`}>{value}</div>
      <div className="text-2xs text-text-muted">
        {metricId ? <MetricLabel metricId={metricId} label={label} /> : label}
      </div>
    </div>
  );
}
