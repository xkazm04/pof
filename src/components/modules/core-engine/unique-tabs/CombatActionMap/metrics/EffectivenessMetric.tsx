'use client';

import { DPS_STRATEGIES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const best = [...DPS_STRATEGIES].sort((a, b) => b.dps - a.dps)[0];

export function EffectivenessMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight truncate">
      <span className="font-bold" style={{ color: best.color }}>{best.name}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {best.dps} DPS</span>
    </div>
  );
}
