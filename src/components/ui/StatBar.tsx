'use client';

import type { HTMLAttributes } from 'react';
import { useReducedMotion } from 'framer-motion';
import { STATUS_TOKENS } from '@/lib/status-token';
import { OVERLAY_WHITE, OPACITY_60, withOpacity } from '@/lib/chart-colors';
import { resolveMeterScale } from './MeterBar';

interface StatBarProps {
  /** Fill percentage, 0–100 (clamped unless `overflow` is set). */
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
  /**
   * Render values above 100 honestly instead of cropping them: 100 becomes a
   * tick and the excess a hatched segment, and the announced value is the real
   * one. Shares `resolveMeterScale` with `MeterBar` so the two primitives can
   * never disagree on the rule. Opt-in; scores and rates leave it off.
   */
  overflow?: boolean;
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
  overflow = false,
  className = '',
}: StatBarProps) {
  const prefersReduced = useReducedMotion();
  const scale = resolveMeterScale(value, 100, overflow);
  // Under reduced motion, skip the grow-in: render the final width immediately.
  const filled = prefersReduced ? true : animate;

  const trackProps: HTMLAttributes<HTMLDivElement> = ariaLabel
    ? {
        role: 'progressbar',
        'aria-valuenow': scale.reportedPct,
        'aria-valuemin': 0,
        'aria-valuemax': Math.max(100, scale.reportedPct),
        'aria-label': ariaLabel,
        ...(scale.over ? { 'aria-valuetext': `${scale.reportedPct}% — over` } : {}),
      }
    : { 'aria-hidden': true };

  return (
    <div
      className={`relative bg-border rounded-full overflow-hidden ${className}`}
      style={{ height }}
      data-over={scale.over ? 'true' : undefined}
      {...trackProps}
    >
      <div
        className="h-full rounded-full ease-out"
        style={{
          width: filled ? `${scale.fillPct}%` : '0%',
          backgroundColor: color,
          transitionProperty: prefersReduced ? 'none' : 'width',
          transitionDuration: prefersReduced ? '0ms' : `${FILL_DURATION_MS}ms`,
          transitionDelay: prefersReduced ? '0ms' : `${delayMs}ms`,
        }}
      />
      {scale.over && filled && (
        <>
          <div
            data-meter-overflow
            className="absolute inset-y-0 right-0"
            style={{
              left: `${scale.limitPct}%`,
              backgroundColor: withOpacity(STATUS_TOKENS.bad.color, OPACITY_60),
              backgroundImage: STATUS_TOKENS.bad.pattern,
            }}
          />
          <div
            data-meter-limit
            aria-hidden
            className="absolute inset-y-0"
            style={{ left: `${scale.limitPct}%`, width: 1, backgroundColor: withOpacity(OVERLAY_WHITE, OPACITY_60) }}
          />
        </>
      )}
    </div>
  );
}
