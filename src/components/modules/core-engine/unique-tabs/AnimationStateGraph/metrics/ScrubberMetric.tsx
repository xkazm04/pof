'use client';

import { SCRUBBER_LANES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const notifyCount = SCRUBBER_LANES.length;

export function ScrubberMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{notifyCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> notifies</span>
    </div>
  );
}
