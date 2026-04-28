'use client';

import type { ComponentType, ReactNode } from 'react';

type DashboardHeaderSize = 'md' | 'lg';
type DashboardHeaderVariant = 'gradient' | 'soft';
type DashboardAccent =
  | 'emerald'
  | 'cyan'
  | 'rose'
  | 'orange'
  | 'red'
  | 'amber'
  | 'violet'
  | 'blue'
  | 'indigo'
  | 'green';

interface DashboardHeaderProps {
  /** Lucide icon component (e.g. `Gauge`, `BookOpen`). Rendered inside the accent tile. */
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  /**
   * Tailwind color family for the gradient/soft tile (e.g. `'emerald'`, `'rose'`, `'violet'`).
   * For `variant='gradient'`, a second color may be supplied via `accentTo` (defaults to the same color).
   */
  accent?: DashboardAccent;
  /** Optional second color for the gradient tile, e.g. `'cyan'` paired with `accent='emerald'`. */
  accentTo?: DashboardAccent;
  /**
   * Visual treatment for the icon tile:
   *  - `gradient` (default): `bg-gradient-to-br from-{accent}-500/20 to-{accentTo}-500/20 border border-{accent}-500/30`
   *  - `soft`: bare `bg-{accent}-500/10` (lighter, no border) — for secondary dashboards
   */
  variant?: DashboardHeaderVariant;
  /** Header size: `md` matches the `text-base` h2 convention; `lg` matches the `text-lg` h1 convention. */
  size?: DashboardHeaderSize;
  /** Optional action node (typically a button) rendered to the right of the title block. */
  action?: ReactNode;
  /** Additional action(s) — second slot, rendered before `action`. Used when a view has Import + Run side-by-side. */
  secondaryAction?: ReactNode;
  className?: string;
}

// Tailwind JIT requires literal classnames in source. These maps preserve the
// gradient/soft recipes for every accent color used by the dashboards.
const GRADIENT_FROM: Record<DashboardAccent, string> = {
  emerald: 'from-emerald-500/20',
  cyan: 'from-cyan-500/20',
  rose: 'from-rose-500/20',
  orange: 'from-orange-500/20',
  red: 'from-red-500/20',
  amber: 'from-amber-500/20',
  violet: 'from-violet-500/20',
  blue: 'from-blue-500/20',
  indigo: 'from-indigo-500/20',
  green: 'from-green-500/20',
};

const GRADIENT_TO: Record<DashboardAccent, string> = {
  emerald: 'to-emerald-500/20',
  cyan: 'to-cyan-500/20',
  rose: 'to-rose-500/20',
  orange: 'to-orange-500/20',
  red: 'to-red-500/20',
  amber: 'to-amber-500/20',
  violet: 'to-violet-500/20',
  blue: 'to-blue-500/20',
  indigo: 'to-indigo-500/20',
  green: 'to-green-500/20',
};

const BORDER_30: Record<DashboardAccent, string> = {
  emerald: 'border-emerald-500/30',
  cyan: 'border-cyan-500/30',
  rose: 'border-rose-500/30',
  orange: 'border-orange-500/30',
  red: 'border-red-500/30',
  amber: 'border-amber-500/30',
  violet: 'border-violet-500/30',
  blue: 'border-blue-500/30',
  indigo: 'border-indigo-500/30',
  green: 'border-green-500/30',
};

const BG_SOFT: Record<DashboardAccent, string> = {
  emerald: 'bg-emerald-500/10',
  cyan: 'bg-cyan-500/10',
  rose: 'bg-rose-500/10',
  orange: 'bg-orange-500/10',
  red: 'bg-red-500/10',
  amber: 'bg-amber-500/10',
  violet: 'bg-violet-500/10',
  blue: 'bg-blue-500/10',
  indigo: 'bg-indigo-500/10',
  green: 'bg-green-500/10',
};

const ICON_TINT: Record<DashboardAccent, string> = {
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  rose: 'text-rose-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  blue: 'text-blue-400',
  indigo: 'text-indigo-400',
  green: 'text-green-400',
};

/**
 * Unified page-header primitive for evaluator dashboards and similar top-level views.
 *
 * Subsumes the 8+ hand-rolled "icon-tile + title + subtitle + action button" page
 * headers across `src/components/modules/evaluator/*` (see ui-perfectionist 20.2).
 *
 * The accent color drives the gradient tile; the action slot takes a refresh
 * button or single primary CTA. Standardize on the gradient variant — the bare
 * `soft` variant exists for legacy compatibility but reads as second-class.
 *
 * Example:
 * ```tsx
 * <DashboardHeader
 *   icon={Gauge}
 *   title="Performance Profiling"
 *   subtitle="UE5 runtime analysis with AI-powered optimization triage"
 *   accent="rose"
 *   accentTo="orange"
 *   action={<button>Run</button>}
 * />
 * ```
 */
export function DashboardHeader({
  icon: Icon,
  title,
  subtitle,
  accent = 'emerald',
  accentTo,
  variant = 'gradient',
  size = 'lg',
  action,
  secondaryAction,
  className = '',
}: DashboardHeaderProps) {
  const to = accentTo ?? accent;

  const tileClass =
    variant === 'gradient'
      ? `w-10 h-10 rounded-xl bg-gradient-to-br ${GRADIENT_FROM[accent]} ${GRADIENT_TO[to]} border ${BORDER_30[accent]} flex items-center justify-center`
      : `w-10 h-10 rounded-lg ${BG_SOFT[accent]} flex items-center justify-center`;

  const titleClass =
    size === 'lg'
      ? 'text-lg font-semibold text-text'
      : 'text-base font-semibold text-text';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={tileClass}>
        <Icon className={`w-5 h-5 ${ICON_TINT[accent]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className={titleClass}>{title}</h1>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {secondaryAction}
      {action}
    </div>
  );
}
