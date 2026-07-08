import { Clock } from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { WrappedMilestone } from '@/types/project-wrapped';
import { formatLongDate } from './helpers';

// ── Sub-components ─────────────────────────────────────────────────────────────

export function HeroStat({ icon: Icon, color, value, label }: {
  icon: typeof Clock; color: string; value: string; label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="text-3xl font-bold text-text tabular-nums leading-none" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted mt-1.5">{label}</div>
    </div>
  );
}

export function MiniStat({ icon: Icon, color, value, label }: {
  icon: typeof Clock; color: string; value: string; label: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-surface border border-border">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} aria-hidden="true" />
        <span className="text-2xs text-text-muted truncate">{label}</span>
      </div>
      <div className="text-lg font-bold text-text tabular-nums">{value}</div>
    </div>
  );
}

export function TimelineRow({ milestone }: { milestone: WrappedMilestone }) {
  return (
    <li className="ml-4">
      <span
        className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full border-2 border-background"
        style={{ backgroundColor: ACCENT_VIOLET }}
        aria-hidden="true"
      />
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true">{milestone.icon}</span>
        <span className="text-xs font-medium text-text">{milestone.title}</span>
        <span className="text-2xs text-text-muted ml-auto tabular-nums">{formatLongDate(milestone.date)}</span>
      </div>
      <p className="text-2xs text-text-muted mt-0.5">{milestone.description}</p>
    </li>
  );
}
