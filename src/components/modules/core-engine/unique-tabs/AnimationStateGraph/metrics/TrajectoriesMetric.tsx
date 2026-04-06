'use client';

import { ROOT_MOTION_PATHS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const curveCount = ROOT_MOTION_PATHS.length;

export function TrajectoriesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{curveCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> root motion curves</span>
    </div>
  );
}
