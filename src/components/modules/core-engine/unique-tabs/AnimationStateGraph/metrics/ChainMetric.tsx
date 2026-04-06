'use client';

import { COMBO_DEFS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const comboCount = COMBO_DEFS.length;
const maxDepth = Math.max(...COMBO_DEFS.map(c => c.sectionIds.length));

export function ChainMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{comboCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {comboCount === 1 ? 'combo' : 'combos'} / depth </span>
      <span className="font-bold" style={{ color: ACCENT }}>{maxDepth}</span>
    </div>
  );
}
