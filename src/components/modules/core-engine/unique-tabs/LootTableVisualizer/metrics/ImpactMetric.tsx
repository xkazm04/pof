'use client';

import { GOLD_PER_HOUR_GAUGE, ACCENT } from '../data';
import { withOpacity, OPACITY_20, OPACITY_50 } from '@/lib/chart-colors';

const pct = Math.min(100, (GOLD_PER_HOUR_GAUGE.current / GOLD_PER_HOUR_GAUGE.target) * 100);
const BAR_W = 24;
const BAR_H = 4;

export function ImpactMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={BAR_W} height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} aria-hidden="true">
        <rect x={0} y={0} width={BAR_W} height={BAR_H} rx={2} fill={withOpacity(ACCENT, OPACITY_20)} />
        <rect x={0} y={0} width={BAR_W * (pct / 100)} height={BAR_H} rx={2} fill={ACCENT}>
          <title>{GOLD_PER_HOUR_GAUGE.current}/{GOLD_PER_HOUR_GAUGE.target} {GOLD_PER_HOUR_GAUGE.unit}/hr</title>
        </rect>
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{GOLD_PER_HOUR_GAUGE.current}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>/hr gold</span>
      </div>
    </div>
  );
}
