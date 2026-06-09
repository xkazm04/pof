'use client';

import type { CSSProperties } from 'react';

/**
 * Fill color: either a static token / CSS variable, or a `(pct) => color`
 * function for threshold coloring. `pct` is the resolved 0–100 fill, so a
 * caller can reuse the same function to tint an adjacent value label.
 */
export type MeterBarColor = string | ((pct: number) => string);

interface MeterBarProps {
  /** Current value, in the same unit as `max`. */
  value: number;
  /**
   * Maximum value; the fill percent is `value / max`. Defaults to 100, i.e.
   * `value` is already an absolute percentage.
   */
  max?: number;
  /** Fill color — a chart-colors token / CSS variable, or a threshold function. Never a raw hex. */
  color: MeterBarColor;
  /** Track thickness in px. */
  height?: number;
  /** Stagger delay in ms applied to the grow-in (e.g. `index * 50`). */
  delayMs?: number;
  /** Accessible name for the progressbar (typically the visible row label). */
  ariaLabel: string;
  /**
   * Human-readable value announced to screen readers (aria-valuetext) — e.g.
   * "3 of 12" or "75%". Defaults to "<rounded pct>%".
   */
  valueText?: string;
  /** Extra classes on the track (e.g. `flex-1` to fill its row). */
  className?: string;
}

/**
 * MeterBar — the shared horizontal progress meter. A rounded track with a
 * colored fill that grows in from zero on mount, with optional threshold
 * coloring and an always-on `progressbar` role (aria-valuenow/min/max +
 * aria-valuetext).
 *
 * Consolidates three previously-divergent bars — DirectorOverview's ScoreBar,
 * SessionDetail's coverage bars, and RegressionTrackerView's rate bar — so the
 * grow-in motion, reduced-motion handling, and accessibility live in one place.
 * It renders only the track + fill; compose your own label / value around it.
 *
 * The grow-in runs via the `.meter-fill-grow` CSS class (globals.css), so the
 * global `prefers-reduced-motion` rule neutralises it automatically — no
 * JS motion hook needed. Distinct from `ui/StatBar`, the barer track whose
 * grow-in must be gated by an external `animate` flag.
 */
export function MeterBar({
  value,
  max = 100,
  color,
  height = 6,
  delayMs = 0,
  ariaLabel,
  valueText,
  className = '',
}: MeterBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = typeof color === 'function' ? color(pct) : color;
  const rounded = Math.round(pct);

  return (
    <div
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      aria-valuetext={valueText ?? `${rounded}%`}
      className={`bg-border rounded-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full meter-fill-grow"
        style={{
          width: `${pct}%`,
          backgroundColor: fill,
          '--meter-grow-delay': `${delayMs}ms`,
        } as CSSProperties}
      />
    </div>
  );
}
