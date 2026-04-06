'use client';

import { MONTAGE_TIMINGS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

// Derive play-rate range from montage fps values relative to base 30fps
const rates = MONTAGE_TIMINGS.map(m => m.fps / 30);
const minRate = Math.min(...rates);
const maxRate = Math.max(...rates);
const isUniform = minRate === maxRate;
// Blend-in time range as secondary metric when play rates are uniform
const blendTimes = MONTAGE_TIMINGS.map(m => m.blendInTime);
const minBlend = Math.min(...blendTimes);
const maxBlend = Math.max(...blendTimes);

export function PlayrateMetric() {
  if (isUniform) {
    return (
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{minRate.toFixed(1)}x</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> · blend </span>
        <span className="font-bold" style={{ color: ACCENT }}>{(minBlend * 1000).toFixed(0)}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>&ndash;</span>
        <span className="font-bold" style={{ color: ACCENT }}>{(maxBlend * 1000).toFixed(0)}ms</span>
      </div>
    );
  }

  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{minRate.toFixed(1)}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>&ndash;</span>
      <span className="font-bold" style={{ color: ACCENT }}>{maxRate.toFixed(1)}x</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> range</span>
    </div>
  );
}
