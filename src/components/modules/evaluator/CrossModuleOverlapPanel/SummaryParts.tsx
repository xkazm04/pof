import { AlertTriangle } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import type { ModuleOverlapSummary } from '@/lib/overlap-detection';
import { moduleLabel } from './helpers';

// ── Sub-components ──

export function StatCard({ label, value, color, icon: Icon }: {
  label: string;
  value: number;
  color: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <KPICard
      layout="vertical"
      animated
      accent={color}
      icon={<Icon className="w-3 h-3" style={{ color }} />}
      label={label}
      value={value}
    />
  );
}

export function ModuleBubble({ summary, maxCount }: { summary: ModuleOverlapSummary; maxCount: number }) {
  const intensity = Math.max(0.2, summary.overlapCount / maxCount);
  return (
    <div
      className="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
      style={{
        backgroundColor: `rgba(248, 113, 113, ${intensity * 0.15})`,
        borderColor: `rgba(248, 113, 113, ${intensity * 0.4})`,
        color: `rgba(248, 113, 113, ${0.5 + intensity * 0.5})`,
      }}
      title={`${moduleLabel(summary.moduleId)}: ${summary.overlapCount} overlaps with ${summary.overlappingModules.length} modules`}
    >
      {moduleLabel(summary.moduleId)}
      <span className="ml-1.5 text-2xs opacity-70">{summary.overlapCount}</span>
    </div>
  );
}

export function FilterChip({ label, active, onClick, color, count }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all"
      style={{
        backgroundColor: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--text-muted)',
        border: `1px solid ${active ? `${color}40` : 'transparent'}`,
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="opacity-60">{count}</span>
      )}
    </button>
  );
}
