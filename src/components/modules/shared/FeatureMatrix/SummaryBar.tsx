import type { FeatureStatus } from '@/types/feature-matrix';
import { STATUS_CONFIG } from './constants';

export function SummaryBar({ summary }: { summary: { total: number; implemented: number; improved: number; partial: number; missing: number; unknown: number } }) {
  if (summary.total === 0) return null;

  const segments: { status: FeatureStatus; count: number }[] = [
    { status: 'improved', count: summary.improved },
    { status: 'implemented', count: summary.implemented },
    { status: 'partial', count: summary.partial },
    { status: 'missing', count: summary.missing },
    { status: 'unknown', count: summary.unknown },
  ];

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {segments.map((s) => {
            if (s.count === 0) return null;
            const Glyph = STATUS_CONFIG[s.status].icon;
            return (
              <span key={s.status} className="flex items-center gap-1 text-2xs" style={{ color: STATUS_CONFIG[s.status].color }} title={STATUS_CONFIG[s.status].plain}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s.status].color }} />
                <Glyph className="w-3 h-3 shrink-0" aria-hidden="true" />
                {s.count} {STATUS_CONFIG[s.status].label.toLowerCase()}
              </span>
            );
          })}
        </div>
        <span className="text-xs text-text-muted-hover">
          {summary.implemented + summary.improved}/{summary.total}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden flex">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.status}
              className="h-full transition-all duration-slow"
              style={{
                width: `${(s.count / summary.total) * 100}%`,
                backgroundColor: STATUS_CONFIG[s.status].color,
                opacity: 0.8,
              }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
