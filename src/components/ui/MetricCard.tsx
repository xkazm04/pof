'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { STATUS_SUCCESS, ACCENT_RED } from '@/lib/chart-colors';
import { DURATION, motionSafe } from '@/lib/motion';

type MetricLayout = 'vertical' | 'horizontal';

interface MetricCardProps {
  /** Short metric name shown beside (horizontal) or above (vertical) the value. */
  label: ReactNode;
  /** The metric value — string, number, or a pre-composed node. */
  value: ReactNode;
  /** Lucide icon rendered inside an accent-tinted box. */
  icon: LucideIcon;
  /** Accent color (hex/CSS) driving the icon-box tint + glyph color. */
  accent: string;
  /**
   * `vertical` (default): icon-row + label on top, big value below.
   * `horizontal`: icon box on the left, value + label stacked beside it.
   */
  layout?: MetricLayout;
  /** Optional period-over-period change; a value of 0 renders no delta. */
  delta?: number;
  /** Suffix appended to the delta number (e.g. "%"). */
  deltaSuffix?: string;
  /** Wrap in a scale + fade entrance (reduced-motion aware). */
  animate?: boolean;
  /** Stagger delay (seconds) for the entrance animation. */
  delay?: number;
  className?: string;
}

// Shared shell — one padding rhythm + radius for every telemetry stat card.
const SHELL = 'p-3.5 bg-surface border border-border rounded-xl';

/**
 * Unified stat card for the Game Director / telemetry surface.
 *
 * Replaces four divergent local `StatCard` implementations (bespoke motion card
 * in DirectorOverview, SurfaceCard horizontal card in RegressionTrackerView, and
 * the two KPICard wrappers in SessionAnalyticsDashboard + WeeklyDigestView) with
 * one primitive so padding, radius (rounded-xl), the accent icon box, and the
 * scale-fade entrance motion stay identical everywhere.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  layout = 'vertical',
  delta,
  deltaSuffix,
  animate = false,
  delay = 0,
  className = '',
}: MetricCardProps) {
  const prefersReduced = useReducedMotion();

  const deltaNode =
    delta !== undefined && delta !== 0 ? (
      <span
        className="flex items-center gap-0.5 text-2xs"
        style={{ color: delta > 0 ? STATUS_SUCCESS : ACCENT_RED }}
      >
        {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        <span>{`${delta > 0 ? '+' : ''}${delta}${deltaSuffix ?? ''}`}</span>
      </span>
    ) : null;

  const iconBox = (
    <span
      className={`${layout === 'horizontal' ? 'w-9 h-9 rounded-lg' : 'w-6 h-6 rounded-md'} flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: `${accent}12`, border: `1px solid ${accent}20` }}
    >
      <Icon className={layout === 'horizontal' ? 'w-4 h-4' : 'w-3 h-3'} style={{ color: accent }} />
    </span>
  );

  const valueRow = (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold text-text tabular-nums">{value}</span>
      {deltaNode}
    </div>
  );

  const inner =
    layout === 'horizontal' ? (
      <div className={`${SHELL} flex items-center gap-3 ${className}`}>
        {iconBox}
        <div className="min-w-0">
          {valueRow}
          <div className="text-2xs text-text-muted">{label}</div>
        </div>
      </div>
    ) : (
      <div className={`${SHELL} ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          {iconBox}
          <span className="text-xs text-text-muted">{label}</span>
        </div>
        {valueRow}
      </div>
    );

  if (!animate) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={motionSafe({ duration: DURATION.base, delay }, prefersReduced)}
    >
      {inner}
    </motion.div>
  );
}
