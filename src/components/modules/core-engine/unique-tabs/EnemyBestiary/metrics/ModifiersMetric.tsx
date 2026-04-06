'use client';

import { ELITE_MODIFIERS } from '../data';
import { ACCENT_ORANGE, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const modCount = ELITE_MODIFIERS.length;
const exclusionCount = ELITE_MODIFIERS.reduce((sum, m) => sum + (m.excludes?.length ?? 0), 0);

export function ModifiersMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT_ORANGE }}>{modCount}</span>
      <span style={{ color: withOpacity(ACCENT_ORANGE, OPACITY_50) }}> modifiers / </span>
      <span className="font-bold" style={{ color: ACCENT_ORANGE }}>{exclusionCount}</span>
      <span style={{ color: withOpacity(ACCENT_ORANGE, OPACITY_50) }}> exclusions</span>
    </div>
  );
}
