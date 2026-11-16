'use client';

import { useMemo } from 'react';
import { ACCENT } from '../_shared/data';
import { useInventoryItems } from '../_shared/useInventoryItems';
import { withOpacity, OPACITY_15, OPACITY_50 } from '@/lib/chart-colors';

const W = 48;
const H = 10;

export function StatsMetric() {
  // The catalog store is the system of record for which items exist (not the static seed list).
  const items = useInventoryItems();
  const { avg, bars, barW } = useMemo(() => {
    const primaryStats = items
      .map(item => item.stats[0]?.numericValue)
      .filter((v): v is number => v != null && v > 0);
    const mean = primaryStats.length > 0
      ? Math.round(primaryStats.reduce((a, b) => a + b, 0) / primaryStats.length)
      : 0;
    const maxStat = primaryStats.length > 0 ? Math.max(...primaryStats) : 1;

    // Subsample sorted stats to fit within SVG width (max W/2 bars so each gets ≥2px)
    const sorted = primaryStats.slice().sort((a, b) => a - b);
    const maxBars = Math.floor(W / 2);
    const sampled = sorted.length <= maxBars
      ? sorted
      : Array.from({ length: maxBars }, (_, i) =>
          sorted[Math.round((i / (maxBars - 1)) * (sorted.length - 1))],
        );
    const bw = sampled.length > 0 ? Math.max(W / sampled.length - 1, 1) : 1;
    return {
      avg: mean,
      barW: bw,
      bars: sampled.map((v, i) => ({ x: i * (bw + 1), h: Math.max((v / maxStat) * H, 1), value: v })),
    };
  }, [items]);

  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} aria-hidden="true" className="block shrink-0">
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={H - bar.h}
            width={barW}
            height={bar.h}
            rx={0.5}
            fill={bar.value >= avg ? ACCENT : withOpacity(ACCENT, OPACITY_15)}
          >
            <title>Power: {bar.value}</title>
          </rect>
        ))}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{avg}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> avg</span>
      </div>
    </div>
  );
}
