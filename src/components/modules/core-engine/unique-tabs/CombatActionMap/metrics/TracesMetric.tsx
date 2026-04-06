'use client';

import { TRACE_FRAMES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

/** Radius threshold: r <= this is a sphere trace, r > this is a capsule trace */
const SPHERE_MAX_RADIUS = 13;
const sphereCount = TRACE_FRAMES.filter(f => f.r <= SPHERE_MAX_RADIUS).length;
const capsuleCount = TRACE_FRAMES.filter(f => f.r > SPHERE_MAX_RADIUS).length;

export function TracesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{sphereCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> sphere / </span>
      <span className="font-bold" style={{ color: ACCENT }}>{capsuleCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> capsule</span>
    </div>
  );
}
