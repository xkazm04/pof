'use client';

/**
 * Minimal shared SVG chart-axis primitives.
 *
 * Several hand-rolled charts (DifficultyArcChart, AggregateQualityDashboard's
 * trend sparkline, etc.) all draw the same simple horizontal-gridline pattern:
 * a thin `var(--border)` line per integer/category value, with optional Y-tick
 * labels rendered to the left. Extracted here to avoid recopying the math.
 *
 * Refs: docs/harness/ui-perfectionist-2026-04-28/20-evaluator-ui-dashboards.md (20.4)
 */

import type { CSSProperties } from 'react';

export interface HorizontalGridLinesProps {
  /** Tick values to draw. Filtered against `min`/`max` automatically. */
  values: readonly number[];
  /** Minimum Y-domain value (data units). */
  min: number;
  /** Maximum Y-domain value (data units). */
  max: number;
  /** Left edge of plot area (px in SVG coords). */
  left: number;
  /** Right edge of plot area (px). */
  right: number;
  /** Top of plot area (px). */
  top: number;
  /** Bottom of plot area (px). */
  bottom: number;
  /** Stroke color. Default `var(--border)`. */
  stroke?: string;
  /** Stroke width. Default 0.5. */
  strokeWidth?: number;
  /**
   * If set, render a tick label at each line. The function receives the data
   * value and returns the rendered text. Pass `undefined` to skip labels.
   */
  formatLabel?: (value: number) => string;
  /** Extra horizontal offset for tick labels (px). Default -6 (left of plot). */
  labelOffsetX?: number;
  /** Tick-label font size. Default 11. */
  labelFontSize?: number;
  /** Tick-label fill. Default `var(--text-muted)`. */
  labelFill?: string;
  /** Optional style for tick-label text. */
  labelStyle?: CSSProperties;
}

/**
 * Render horizontal grid lines (and optionally Y-axis tick labels) for a
 * linear-mapped chart. The component owns the value→pixel `y` mapping using
 * the inverted "min at bottom, max at top" convention common to these charts.
 */
export function HorizontalGridLines({
  values,
  min,
  max,
  left,
  right,
  top,
  bottom,
  stroke = 'var(--border)',
  strokeWidth = 0.5,
  formatLabel,
  labelOffsetX = -6,
  labelFontSize = 11,
  labelFill = 'var(--text-muted)',
  labelStyle,
}: HorizontalGridLinesProps) {
  const range = max - min || 1;
  const plotH = bottom - top;

  return (
    <>
      {values
        .filter((v) => v >= min && v <= max)
        .map((v) => {
          const y = bottom - ((v - min) / range) * plotH;
          return (
            <g key={v}>
              <line x1={left} y1={y} x2={right} y2={y} stroke={stroke} strokeWidth={strokeWidth} />
              {formatLabel && (
                <text
                  x={left + labelOffsetX}
                  y={y + 3}
                  fontSize={labelFontSize}
                  fill={labelFill}
                  textAnchor="end"
                  style={labelStyle}
                >
                  {formatLabel(v)}
                </text>
              )}
            </g>
          );
        })}
    </>
  );
}
