'use client';

import { LANES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const laneCount = LANES.length;
const actionCount = LANES.reduce((sum, l) => sum + l.featureNames.length, 0);

export function LanesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{laneCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> lanes / </span>
      <span className="font-bold" style={{ color: ACCENT }}>{actionCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> actions</span>
    </div>
  );
}
