'use client';

import { SANKEY_FLOWS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const flowCount = SANKEY_FLOWS.length;

export function SankeyMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{flowCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> flows</span>
    </div>
  );
}
