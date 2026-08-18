'use client';

import type { ReactNode } from 'react';
import { scoreBandToken } from '@/lib/chart-colors';

interface ScoreRingProps {
  /** 0-100 score. Ignored for display when `measured` is false. */
  value: number;
  /** Pixel size of the ring (width = height). */
  size?: number;
  /** Stroke width. */
  strokeWidth?: number;
  /** Override the value→color mapping; defaults to the canonical band ladder. */
  color?: string;
  /** Override content rendered in the ring center (default: rounded value). Accepts rich nodes (e.g. a grade + sub-label). */
  label?: ReactNode;
  /** Tailwind class for the center label. */
  labelClassName?: string;
  /**
   * False when nothing has been measured yet: the arc is omitted, the track is
   * dashed, the center reads "—", and NO number is rendered at all. A caller
   * `label` is ignored in this state on purpose — an unmeasured ring must not be
   * talkable into displaying a score.
   */
  measured?: boolean;
  /** Accessible-name override (default: "Score: N out of 100" / the unmeasured wording). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Maps a 0-100 score to a status color.
 *
 * Delegates to `scoreBandToken`, the app's canonical band ladder
 * (>=80 green / >=60 amber / >=40 orange / red). It previously carried its own
 * private >=70 / >=40 ladder, which made the ring the most optimistic surface in
 * the app: 75 read green here and amber in the compliance dashboard — the same
 * number, two colours, and the more flattering one won wherever the ring was
 * used. Nothing else consumed this helper, so the ladder lives in one place now.
 */
export function scoreToStatusColor(score: number): string {
  return scoreBandToken(score).color;
}

/**
 * Score ring primitive — circular progress arc with centered numeric label
 * and threshold-based color mapping. Subsumes the 3 hand-rolled SVG score
 * rings in DirectorOverview / SessionDetail (ui-perfectionist 31.1) which
 * each computed `2πr` by hand (94.2, 106.8, 175.9), plus the GDD compliance
 * view's local copy — which existed only because this primitive lacked the
 * unmeasured state, the accessible-name override, and the canonical ladder.
 *
 * Differs from `ProgressRing`: ScoreRing colors itself by score band (no
 * caller-side ternaries) and renders the numeric value in the center by
 * default. Use ProgressRing for arbitrary 0-100 progress where the caller
 * picks the color.
 */
export function ScoreRing({
  value,
  size = 64,
  strokeWidth = 4,
  color,
  label,
  labelClassName,
  measured = true,
  ariaLabel,
  className = '',
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const stroke = color ?? scoreToStatusColor(value);
  const cx = size / 2;
  const cy = size / 2;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  const labelClass = labelClassName ?? (size >= 56 ? 'text-sm font-bold text-text' : 'text-xs font-bold text-text');

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        ariaLabel
          ?? (measured
            ? `Score: ${Math.round(value)} out of 100`
            : 'Score unmeasured — nothing has been evaluated')
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeDasharray={measured ? undefined : '3 4'}
        />
        {measured && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-slow"
          />
        )}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center ${labelClass}`}
        style={measured ? undefined : { color: 'var(--text-subtle)' }}
      >
        {measured ? (label ?? Math.round(value)) : '—'}
      </span>
    </div>
  );
}
