'use client';

import { DPS_STRATEGIES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const avgDps = Math.round(DPS_STRATEGIES.reduce((sum, s) => sum + s.dps, 0) / DPS_STRATEGIES.length);

export function StatsMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{avgDps}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> avg DPS</span>
    </div>
  );
}
