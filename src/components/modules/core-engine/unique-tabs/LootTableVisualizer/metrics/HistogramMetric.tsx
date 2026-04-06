'use client';

import { RARITY_TIERS, TOTAL_WEIGHT, ACCENT } from '../data';
import { withOpacity, OPACITY_25, OPACITY_50 } from '@/lib/chart-colors';

const BAR_W = 4;
const BAR_GAP = 1.5;
const MAX_H = 18;

const maxWeight = Math.max(...RARITY_TIERS.map(t => t.weight));

const BARS = RARITY_TIERS.map((tier, i) => ({
  x: i * (BAR_W + BAR_GAP),
  h: Math.max(2, (tier.weight / maxWeight) * MAX_H),
  color: tier.color,
  label: `${tier.name}: ${((tier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%`,
}));

const SVG_W = RARITY_TIERS.length * (BAR_W + BAR_GAP) - BAR_GAP;

export function HistogramMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={SVG_W} height={MAX_H} viewBox={`0 0 ${SVG_W} ${MAX_H}`} aria-hidden="true">
        {BARS.map((b) => (
          <rect
            key={b.label}
            x={b.x}
            y={MAX_H - b.h}
            width={BAR_W}
            height={b.h}
            rx={0.5}
            fill={b.color}
            style={{ filter: `drop-shadow(0 0 1px ${withOpacity(b.color, OPACITY_25)})` }}
          >
            <title>{b.label}</title>
          </rect>
        ))}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{RARITY_TIERS.length}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> brackets</span>
      </div>
    </div>
  );
}
