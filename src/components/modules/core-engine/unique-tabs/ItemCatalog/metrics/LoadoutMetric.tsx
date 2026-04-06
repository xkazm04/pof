'use client';

import { LOADOUT_SLOTS, ACCENT } from '../data';
import { withOpacity, OPACITY_15, OPACITY_50 } from '@/lib/chart-colors';

const total = LOADOUT_SLOTS.length;
const equipped = LOADOUT_SLOTS.filter(s => !s.isEmpty).length;
const pct = total > 0 ? (equipped / total) * 100 : 0;

export function LoadoutMetric() {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{equipped}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>/{total} equipped</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: withOpacity(ACCENT, OPACITY_15) }}
        title={`${equipped} of ${total} slots equipped (${Math.round(pct)}%)`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
        />
      </div>
    </div>
  );
}
