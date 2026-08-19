'use client';

import type { CSSProperties } from 'react';
import { STATUS_TOKENS } from '@/lib/status-token';
import { OVERLAY_WHITE, OPACITY_60, withOpacity } from '@/lib/chart-colors';

/**
 * Fill color: either a static token / CSS variable, or a `(pct) => color`
 * function for threshold coloring. `pct` is the resolved 0–100 fill, so a
 * caller can reuse the same function to tint an adjacent value label. When the
 * bar is over its limit (see `overflow`) the function receives the TRUE percent
 * of `max`, which is the number a threshold actually cares about.
 */
export type MeterBarColor = string | ((pct: number) => string);

/** A reference line drawn at a fraction of `max` (0–1), e.g. an 80% warn line. */
export interface MeterMark {
  /** Position as a fraction of `max`, 0–1. Tracks the rescale when over-limit. */
  at: number;
  /** Line color — a chart-colors token / CSS variable, never a raw hex. */
  color: string;
  /** Optional description, for a caller rendering its own axis labels. */
  label?: string;
}

/** Resolved geometry of a meter — see {@link resolveMeterScale}. */
export interface MeterScale {
  /** True `value / max`, floored at 0 and NOT clamped at 1. */
  ratio: number;
  /** Width of the in-limit fill, as a percent of the track. */
  fillPct: number;
  /** Track position (percent) where `max` sits — 100 unless the bar is over. */
  limitPct: number;
  /** Percent announced to assistive tech: the true percent once over, else the clamped fill. */
  reportedPct: number;
  /** True when `overflow` is on and the value exceeds `max`. */
  over: boolean;
}

/**
 * The one place a meter turns (value, max) into track geometry.
 *
 * Historically every budget bar in the app clamped at 100%, so 150-of-100
 * rendered pixel-identically to 100-of-100 and `aria-valuetext` announced
 * "100%" for a 50% overrun — a colour-only encoding sitting on top of a flat
 * lie about magnitude.
 *
 * With `overflow` on, an over-limit bar is instead **rescaled**: the whole track
 * represents `value`, so `max` lands at `limitPct` (a tick) and the excess is
 * drawn from there to the right edge. The tick therefore slides left as the
 * overrun grows, which is the non-colour cue that says *how far* over.
 *
 * `overflow` is opt-in so the ~20 existing consumers (scores, coverage, success
 * rates — all genuinely 0–100) keep their clamped behaviour byte-for-byte.
 */
export function resolveMeterScale(value: number, max: number, overflow = false): MeterScale {
  if (!(max > 0) || !Number.isFinite(value)) {
    return { ratio: 0, fillPct: 0, limitPct: 100, reportedPct: 0, over: false };
  }
  const ratio = Math.max(0, value / max);
  if (!overflow || ratio <= 1) {
    const pct = Math.min(100, ratio * 100);
    return { ratio, fillPct: pct, limitPct: 100, reportedPct: Math.round(pct), over: false };
  }
  const limitPct = 100 / ratio;
  return { ratio, fillPct: limitPct, limitPct, reportedPct: Math.round(ratio * 100), over: true };
}

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
   * "3 of 12" or "75%". Defaults to "<rounded pct>%", or the true percent plus
   * an over-limit note once the bar is over. A caller's own text is never
   * allowed to hide an overrun: " — over budget" is appended when it does not
   * already say so.
   */
  valueText?: string;
  /**
   * Render values above `max` honestly instead of cropping them: `max` becomes
   * a tick, and the excess a hatched segment. Opt-in — leave it off for meters
   * whose value genuinely cannot exceed the maximum.
   */
  overflow?: boolean;
  /**
   * CSS `background-image` hatch for the fill itself — pass
   * `STATUS_TOKENS[level].pattern` so a warn/over fill carries shape cue #2 and
   * not only a hue.
   */
  pattern?: string;
  /** Reference lines at fractions of `max` (e.g. an 80% warn line). */
  marks?: readonly MeterMark[];
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
 * For budget meters, pass `overflow` so an over-limit value reads as over-limit
 * by shape (limit tick + hatched excess from `STATUS_TOKENS.bad.pattern`) and
 * announces its real magnitude — see {@link resolveMeterScale}.
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
  overflow = false,
  pattern,
  marks,
  className = '',
}: MeterBarProps) {
  const scale = resolveMeterScale(value, max, overflow);
  // Under limit this is the historical `pct`; over limit a threshold function
  // wants the real overrun, not the rescaled fill width.
  const fill = typeof color === 'function' ? color(scale.over ? scale.ratio * 100 : scale.fillPct) : color;
  const rounded = scale.reportedPct;

  return (
    <div
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={Math.max(100, rounded)}
      aria-label={ariaLabel}
      aria-valuetext={resolveValueText(valueText, rounded, scale.over)}
      data-over={scale.over ? 'true' : undefined}
      className={`relative bg-border rounded-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full meter-fill-grow"
        style={{
          width: `${scale.fillPct}%`,
          backgroundColor: fill,
          backgroundImage: pattern || undefined,
          '--meter-grow-delay': `${delayMs}ms`,
        } as CSSProperties}
      />
      {scale.over && (
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
      {marks?.map((m, i) => {
        const pos = Math.max(0, Math.min(100, m.at * scale.limitPct));
        return (
          <div
            key={`${m.at}-${i}`}
            data-meter-mark
            aria-hidden
            title={m.label}
            className="absolute inset-y-0"
            style={{
              left: `${pos}%`,
              width: 1,
              backgroundColor: m.color,
              transform: pos >= 100 ? 'translateX(-100%)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * A meter may never announce an over-limit value without saying it is over —
 * including when the caller supplied its own text (e.g. "18 / 16"), which is
 * exactly the case where the number alone reads as fine.
 */
function resolveValueText(valueText: string | undefined, rounded: number, over: boolean): string {
  if (!valueText) return over ? `${rounded}% of budget — over` : `${rounded}%`;
  if (!over || /\bover\b/i.test(valueText)) return valueText;
  return `${valueText} — over budget`;
}
