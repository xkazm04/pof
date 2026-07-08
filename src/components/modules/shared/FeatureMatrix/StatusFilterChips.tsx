import type { FeatureStatus } from '@/types/feature-matrix';
import { OPACITY_12 } from '@/lib/chart-colors';
import { STATUS_CONFIG } from './constants';

export function StatusFilterChips({
  summary,
  activeFilters,
  onToggle,
}: {
  summary: { total: number; implemented: number; improved: number; partial: number; missing: number; unknown: number };
  activeFilters: Set<FeatureStatus>;
  onToggle: (status: FeatureStatus) => void;
}) {
  if (summary.total === 0) return null;

  const statuses: FeatureStatus[] = ['improved', 'implemented', 'partial', 'missing', 'unknown'];

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
      {statuses.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const Glyph = cfg.icon;
        const count = summary[status];
        const isActive = activeFilters.has(status);

        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            aria-pressed={isActive}
            title={`${cfg.plain} — ${count} feature${count !== 1 ? 's' : ''}. ${cfg.action}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
            style={{
              // Inactive chips stay readable (opacity 0.6) with a visible border so
              // "deselected" never reads as "disabled" (WCAG 1.4.11 non-text contrast).
              backgroundColor: isActive ? `${cfg.color}${OPACITY_12}` : 'transparent',
              color: cfg.color,
              border: `1px solid ${isActive ? `${cfg.color}66` : `${cfg.color}40`}`,
              opacity: isActive ? 1 : 0.6,
              transition: 'background-color 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out',
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: cfg.color,
                transition: 'transform 200ms ease-out',
                transform: isActive ? 'scale(1)' : 'scale(0.75)',
              }}
            />
            <Glyph className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {cfg.label}
            <span
              className="ml-0.5 text-xs min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full font-semibold"
              style={{
                backgroundColor: isActive ? `${cfg.color}20` : 'transparent',
                color: cfg.color,
                transition: 'background-color 200ms ease-out',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
