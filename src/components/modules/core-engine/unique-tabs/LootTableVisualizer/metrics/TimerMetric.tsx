'use client';

import { ACCENT } from '../data';
import { withOpacity, OPACITY_20, OPACITY_50 } from '@/lib/chart-colors';

/** Default pity threshold used in PityTimerSection */
const DEFAULT_PITY_THRESHOLD = 20;
const BAR_W = 24;
const BAR_H = 4;

export function TimerMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={BAR_W} height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} aria-hidden="true">
        <rect x={0} y={0} width={BAR_W} height={BAR_H} rx={2} fill={withOpacity(ACCENT, OPACITY_20)} />
        <rect x={0} y={0} width={BAR_W * 0.75} height={BAR_H} rx={2} fill={ACCENT}>
          <title>{DEFAULT_PITY_THRESHOLD} pulls until pity</title>
        </rect>
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{DEFAULT_PITY_THRESHOLD}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> pulls</span>
      </div>
    </div>
  );
}
