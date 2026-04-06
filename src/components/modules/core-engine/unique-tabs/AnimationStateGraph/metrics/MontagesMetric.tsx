'use client';

import { MONTAGE_TIMINGS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const montageCount = MONTAGE_TIMINGS.length;

export function MontagesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{montageCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> montages</span>
    </div>
  );
}
