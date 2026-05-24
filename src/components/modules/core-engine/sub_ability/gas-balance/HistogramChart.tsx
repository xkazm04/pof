'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { HistogramBin } from './simulation';

import { withOpacity, OPACITY_50, OPACITY_37 } from '@/lib/chart-colors';
/** Histogram bar chart with hover crosshair + tooltip */
export function HistogramChart({ bins, maxCount, color, formatRange, barHeight = 64 }: {
  bins: HistogramBin[];
  maxCount: number;
  color: string;
  formatRange: (bin: HistogramBin) => string;
  barHeight?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative min-h-[200px] bg-surface-deep/30 rounded-lg p-2" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="flex items-end gap-px" style={{ height: barHeight }}>
        {bins.map((bin, i) => {
          const pct = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="flex-1 min-w-[3px] h-full flex items-end relative cursor-crosshair"
              onMouseEnter={() => setHoveredIdx(i)}
            >
              <motion.div
                className="w-full rounded-t-sm transition-opacity duration-100"
                style={{
                  backgroundColor: color,
                  height: `${pct}%`,
                  minHeight: bin.count > 0 ? 1 : 0,
                  opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
                }}
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
              {isHovered && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-px w-px pointer-events-none"
                  style={{ height: barHeight, backgroundColor: `${withOpacity(color, OPACITY_50)}` }}
                />
              )}
            </div>
          );
        })}
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
            className="px-2 py-1 rounded-md text-2xs font-mono whitespace-nowrap shadow-lg"
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
