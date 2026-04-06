'use client';

import { STATE_NODES, STATE_GROUPS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const stateCount = STATE_NODES.length;
const groupCount = STATE_GROUPS.length;

export function StatesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{stateCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> states / </span>
      <span className="font-bold" style={{ color: ACCENT }}>{groupCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> groups</span>
    </div>
  );
}
