'use client';

import { DUMMY_ITEMS, ACCENT } from '../data';
import { withOpacity, OPACITY_15, OPACITY_50 } from '@/lib/chart-colors';

const primaryStats = DUMMY_ITEMS
  .map(item => item.stats[0]?.numericValue)
  .filter((v): v is number => v != null && v > 0);
const avg = primaryStats.length > 0
  ? Math.round(primaryStats.reduce((a, b) => a + b, 0) / primaryStats.length)
  : 0;
const maxStat = primaryStats.length > 0 ? Math.max(...primaryStats) : 1;

const W = 48;
const H = 10;

// Subsample sorted stats to fit within SVG width (max W/2 bars so each gets ≥2px)
const sorted = primaryStats.slice().sort((a, b) => a - b);
const maxBars = Math.floor(W / 2);
const sampled = sorted.length <= maxBars
  ? sorted
  : Array.from({ length: maxBars }, (_, i) =>
      sorted[Math.round((i / (maxBars - 1)) * (sorted.length - 1))],
    );
const BAR_W = sampled.length > 0 ? Math.max(W / sampled.length - 1, 1) : 1;

const bars = sampled.map((v, i) => ({
  x: i * (BAR_W + 1),
  h: Math.max((v / maxStat) * H, 1),
  value: v,
}));

export function StatsMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} aria-hidden="true" className="block shrink-0">
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={H - bar.h}
            width={BAR_W}
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
