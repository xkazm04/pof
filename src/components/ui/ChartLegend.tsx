'use client';

import type { ReactNode } from 'react';

/**
 * Visual form of a legend marker. The shape is a *second, non-color* cue so
 * series that differ only by line style (solid vs dashed) stay distinguishable
 * for colorblind users (WCAG 1.4.1).
 */
export type LegendShape = 'swatch' | 'line' | 'dashed' | 'ring';

export interface ChartLegendItem {
  /** Solid color (hex or CSS var) that carries the encoded meaning in the chart. */
  color: string;
  /** Short label — rendered in high-contrast body text, never color-only. Also the list key. */
  label: string;
  /**
   * Optional rich label node rendered in place of `label` (e.g. a `MetricLabel`
   * tooltip). Keeps `ChartLegend` decoupled from any glossary while letting
   * callers decode jargon inline. Its visible text should still equal `label`.
   */
  labelNode?: ReactNode;
  /** Optional plain-language clarification, shown muted after the label. */
  description?: string;
  /** Marker form; defaults to a filled swatch. */
  shape?: LegendShape;
}

/**
 * Accessible key for a color-coded chart. Every encoded color gets a labeled
 * marker, so meaning never rests on hue alone (WCAG 1.4.1, "Use of Color").
 *
 * The label text uses the high-contrast body color; the *color* lives in the
 * marker, treated as a graphical object (WCAG 1.4.11 — needs ≥ 3:1 against the
 * surface, which the semantic status palette satisfies — see `contrast.test.ts`).
 */
export function ChartLegend({
  items,
  className = '',
  ariaLabel = 'Chart legend',
  dense = false,
}: {
  items: ChartLegendItem[];
  className?: string;
  ariaLabel?: string;
  /** Tighter spacing for inline/compact contexts. */
  dense?: boolean;
}) {
  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center ${dense ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-1.5'} ${className}`}
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 min-w-0">
          <LegendMarker color={item.color} shape={item.shape ?? 'swatch'} />
          {item.labelNode ?? (
            <span className="text-2xs font-medium text-text whitespace-nowrap">{item.label}</span>
          )}
          {item.description && (
            <span className="text-2xs text-text-muted whitespace-nowrap">{item.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LegendMarker({ color, shape }: { color: string; shape: LegendShape }): ReactNode {
  if (shape === 'line' || shape === 'dashed') {
    return (
      <span
        data-testid="legend-marker"
        aria-hidden="true"
        className="inline-block w-3.5 flex-shrink-0"
        style={{
          height: 0,
          borderTopWidth: 2,
          borderTopStyle: shape === 'dashed' ? 'dashed' : 'solid',
          borderTopColor: color,
        }}
      />
    );
  }
  if (shape === 'ring') {
    return (
      <span
        data-testid="legend-marker"
        aria-hidden="true"
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ border: `1.5px solid ${color}` }}
      />
    );
  }
  return (
    <span
      data-testid="legend-marker"
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}
