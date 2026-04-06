'use client';

import { MONTAGE_TIMINGS, BUDGET_GAUGES, BLEND_CLIPS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

// Rough memory estimate: montages ~0.5MB each, blend clips ~0.2MB each, bone data ~0.1MB per bone slot
const montageMB = MONTAGE_TIMINGS.length * 0.5;
const blendMB = BLEND_CLIPS.length * 0.2;
const boneMB = (BUDGET_GAUGES.find(g => g.label === 'Bone Count')?.current ?? 0) * 0.015;
const totalMB = Math.round((montageMB + blendMB + boneMB) * 10) / 10;

export function AssetsMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>~{totalMB}MB</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> estimated</span>
    </div>
  );
}
