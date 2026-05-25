'use client';

import type { ReactNode } from 'react';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';

interface ScoreRingProps {
  /** 0-100 score. */
  value: number;
  /** Pixel size of the ring (width = height). */
  size?: number;
  /** Stroke width. */
  strokeWidth?: number;
  /** Override the value→color mapping; defaults to the SUCCESS/WARNING/ERROR ladder. */
  color?: string;
  /** Override content rendered in the ring center (default: rounded value). Accepts rich nodes (e.g. a grade + sub-label). */
  label?: ReactNode;
  /** Tailwind class for the center label. */
  labelClassName?: string;
  className?: string;
}

/**
 * Maps a 0-100 score to a status color using the canonical
 * SUCCESS (>=70) / WARNING (>=40) / ERROR threshold ladder.
 */
export function scoreToStatusColor(score: number): string {
  if (score >= 70) return STATUS_SUCCESS;
  if (score >= 40) return STATUS_WARNING;
  return STATUS_ERROR;
}

/**
 * Score ring primitive — circular progress arc with centered numeric label
 * and threshold-based color mapping. Subsumes the 3 hand-rolled SVG score
 * rings in DirectorOverview / SessionDetail (ui-perfectionist 31.1) which
 * each computed `2πr` by hand (94.2, 106.8, 175.9).
 *
 * Differs from `ProgressRing`: ScoreRing colors itself by score thresholds
 * (no caller-side ternaries) and renders the numeric value in the center
 * by default. Use ProgressRing for arbitrary 0-100 progress where the
 * caller picks the color.
 */
export function ScoreRing({
  value,
  size = 64,
  strokeWidth = 4,
  color,
  label,
  labelClassName,
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
      aria-label={`Score: ${Math.round(value)} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
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
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center ${labelClass}`}>
        {label ?? Math.round(value)}
      </span>
    </div>
  );
}
