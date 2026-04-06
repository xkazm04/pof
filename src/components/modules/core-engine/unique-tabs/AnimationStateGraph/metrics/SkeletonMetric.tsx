'use client';

import { BUDGET_GAUGES, ACCENT } from '../data';
import { NeonBar } from '../../_design';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const boneGauge = BUDGET_GAUGES.find(g => g.label === 'Bone Count');
const mapped = boneGauge?.current ?? 0;
const total = boneGauge?.target ?? 1;
const pct = (mapped / total) * 100;

export function SkeletonMetric() {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{mapped}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>/{total}</span>
      </div>
      <NeonBar pct={pct} color={ACCENT} height={3} />
    </div>
  );
}
