'use client';

import type { HTMLAttributes } from 'react';
import { useReducedMotion } from 'framer-motion';

interface StatBarProps {
  /** Fill percentage, 0–100 (clamped). */
  value: number;
  /** Fill color — pass a token from chart-colors or a CSS variable, never a raw hex. */
  color: string;
  /**
   * Gate the grow-in entrance. While false the track renders empty; flip to
   * true (e.g. after first paint) to animate the fill out to `value`. Ignored
   * under prefers-reduced-motion, where the bar shows its final width at once.
   */
  animate?: boolean;
  /** Stagger delay in ms applied to the grow-in transition (e.g. `index * 50`). */
  delayMs?: number;
  /** Track thickness in px. */
  height?: number;
  /**
   * Accessible label. When provided the bar exposes a `progressbar` role with
   * aria-valuenow/min/max; omit for decorative bars paired with a visible value.
   */
  ariaLabel?: string;
  /** Extra classes on the track (e.g. `flex-1` to fill its row). */
  className?: string;
}

const FILL_DURATION_MS = 500;

/**
 * Thin status/progress meter — a rounded track with a colored fill that grows
 * in on first reveal. Consolidates the hand-rolled quality/success bars in
 * SessionAnalyticsDashboard so the entrance, reduced-motion handling, and
 * accessibility live in one place. Pair with a visible numeric value, or pass
 * `ariaLabel` to expose a standalone progressbar.
 */
export function StatBar({
  value,
  color,
  animate = true,
  delayMs = 0,
  height = 6,
  ariaLabel,
  className = '',
}: StatBarProps) {
  const prefersReduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  // Under reduced motion, skip the grow-in: render the final width immediately.
  const filled = prefersReduced ? true : animate;

  const trackProps: HTMLAttributes<HTMLDivElement> = ariaLabel
    ? {
        role: 'progressbar',
        'aria-valuenow': Math.round(pct),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-label': ariaLabel,
      }
    : { 'aria-hidden': true };

  return (
    <div
      className={`bg-border rounded-full overflow-hidden ${className}`}
      style={{ height }}
      {...trackProps}
    >
      <div
        className="h-full rounded-full ease-out"
        style={{
          width: filled ? `${pct}%` : '0%',
          backgroundColor: color,
          transitionProperty: prefersReduced ? 'none' : 'width',
          transitionDuration: prefersReduced ? '0ms' : `${FILL_DURATION_MS}ms`,
          transitionDelay: prefersReduced ? '0ms' : `${delayMs}ms`,
        }}
      />
    </div>
  );
}
