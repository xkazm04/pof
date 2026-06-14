'use client';

import { memo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { HistogramBin } from './simulation';

import { withOpacity, OPACITY_50, OPACITY_37 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';

/**
 * Single histogram bar. Memoized so a hover elsewhere in the strip never
 * re-renders it. The dim-others highlight and the hover crosshair are driven
 * purely by CSS (`group`/`group-hover` on the strip + peer dimming), so moving
 * the cursor across bars touches no per-bar React state. framer-motion's
 * `initial` applies only on mount, and the memo keeps hovers from re-rendering
 * the bar, so the entrance animation runs once without any ref gate.
 */
const Bar = memo(function Bar({ pct, color, hasCount, barHeight, onEnter }: {
  pct: number;
  color: string;
  hasCount: boolean;
  barHeight: number;
  onEnter: () => void;
}) {
  return (
    <div
      className="bar group/bar flex-1 min-w-[3px] h-full flex items-end relative cursor-crosshair group-hover:opacity-50 hover:!opacity-100 transition-opacity duration-100"
      onMouseEnter={onEnter}
    >
      <motion.div
        className="w-full rounded-t-sm"
        style={{
          backgroundColor: color,
          height: `${pct}%`,
          minHeight: hasCount ? 1 : 0,
        }}
        initial={{ height: 0 }}
        animate={{ height: `${pct}%` }}
        transition={{ duration: 0.3 }}
      />
      {/* Hover crosshair — CSS-driven, shown only when this bar is hovered. */}
      <div
        className="absolute top-0 left-1/2 -translate-x-px w-px pointer-events-none opacity-0 group-hover/bar:opacity-100"
        style={{ height: barHeight, backgroundColor: `${withOpacity(color, OPACITY_50)}` }}
      />
    </div>
  );
});

/** Histogram bar chart with hover crosshair + tooltip */
export function HistogramChart({ bins, maxCount, color, formatRange, barHeight = 64 }: {
  bins: HistogramBin[];
  maxCount: number;
  color: string;
  formatRange: (bin: HistogramBin) => string;
  barHeight?: number;
}) {
  // Tooltip-only state. The memoized <Bar>s never receive this, so a hover does
  // not re-render the bar strip — only the single absolutely-positioned tooltip.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative min-h-[200px] bg-surface-deep/30 rounded-lg p-2" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="group flex items-end gap-px" style={{ height: barHeight }}>
        {bins.map((bin, i) => (
          <Bar
            key={`${bin.low}:${bin.high}`}
            pct={maxCount > 0 ? (bin.count / maxCount) * 100 : 0}
            color={color}
            hasCount={bin.count > 0}
            barHeight={barHeight}
            onEnter={() => setHoveredIdx(i)}
          />
        ))}
      </div>
      {hoveredIdx !== null && bins[hoveredIdx] && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${((hoveredIdx + 0.5) / bins.length) * 100}%`,
            bottom: barHeight + 6,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className={`px-2 py-1 rounded-md ${TEXT_SCALE.body} font-mono whitespace-nowrap shadow-lg`}
            style={{
              backgroundColor: 'var(--surface-deep)',
              border: `1px solid ${withOpacity(color, OPACITY_37)}`,
              color: 'var(--text)',
            }}
          >
            <span style={{ color }}>{formatRange(bins[hoveredIdx])}</span>
            <span className="text-text-muted ml-1.5">n={bins[hoveredIdx].count}</span>
          </div>
        </div>
      )}
    </div>
  );
}
