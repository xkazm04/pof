'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { DURATION } from '@/lib/motion';
import { SurfaceCard } from './SurfaceCard';

type KPILayout = 'horizontal' | 'vertical';
type KPISize = 'sm' | 'md';

interface KPICardProps {
  /**
   * Icon node. Pass an already-styled lucide icon (e.g. `<Activity className="w-3 h-3" style={{ color: accent }} />`)
   * for full control, or a plain `<Icon />` and let `accent` colorize it via the wrapper.
   */
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  /** Optional sub-line (e.g. delta, target, secondary metric). */
  sub?: ReactNode;
  /** Accent hex/CSS color. Drives icon + value color (vertical) or value text (horizontal). */
  accent?: string;
  /**
   * Horizontal: icon on the left, value+label stacked on the right (default for most evaluator views).
   * Vertical: icon-row + label on top, value below, optional sub line.
   */
  layout?: KPILayout;
  size?: KPISize;
  /** Wrap in motion.div with fade-up entrance animation. */
  animated?: boolean;
  /** Optional extra slot rendered to the right (horizontal) or below sub (vertical). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Unified KPI / metric card primitive for evaluator dashboards and similar views.
 *
 * Subsumes the 12 local `StatCard` / `MetricCard` reimplementations across
 * `src/components/modules/evaluator/*` (see ui-perfectionist 20.1).
 *
 * Two layouts:
 *  - `horizontal` (default): SurfaceCard level-2 with icon + stacked value/label
 *  - `vertical`: bg-surface card with icon-row label, big value, optional sub-line
 *
 * Use `accent` to drive icon/value tint. For horizontal, callers can pre-color
 * their icon node; for vertical, the accent flows through to icon + value style.
 */
export function KPICard({
  icon,
  label,
  value,
  sub,
  accent,
  layout = 'horizontal',
  size = 'md',
  animated = false,
  trailing,
  className = '',
}: KPICardProps) {
  if (layout === 'horizontal') {
    return (
      <SurfaceCard
        className={`flex items-center gap-2.5 px-3 py-2 flex-1 ${className}`}
        level={2}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div
            className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-semibold tabular-nums`}
            style={accent ? { color: accent } : undefined}
          >
            {value}
          </div>
          <div className="text-2xs text-text-muted">{label}</div>
        </div>
        {trailing}
      </SurfaceCard>
    );
  }

  // Vertical layout: bg-surface card, icon-row label, big value, optional sub
  const valueClass = size === 'sm' ? 'text-base font-bold' : 'text-lg font-bold';
  const inner = (
    <div className={`bg-surface border border-border rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <div className={`${valueClass} tabular-nums`} style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub !== undefined && sub !== null && sub !== '' && (
        <div className="text-xs text-text-muted mt-0.5">{sub}</div>
      )}
      {trailing}
    </div>
  );

  if (!animated) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base }}
    >
      {inner}
    </motion.div>
  );
}
