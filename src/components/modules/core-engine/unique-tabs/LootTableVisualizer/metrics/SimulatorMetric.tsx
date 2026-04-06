'use client';

import { AFFIX_POOL, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const poolSize = AFFIX_POOL.length;

export function SimulatorMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{poolSize}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> affixes in pool</span>
    </div>
  );
}
