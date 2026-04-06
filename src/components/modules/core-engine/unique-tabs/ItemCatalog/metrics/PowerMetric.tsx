'use client';

import { DUMMY_ITEMS, ACCENT } from '../data';
import { withOpacity, OPACITY_15, OPACITY_50 } from '@/lib/chart-colors';

const primaryStats = DUMMY_ITEMS
  .map(item => item.stats[0]?.numericValue)
  .filter((v): v is number => v != null && v > 0);

const minPower = primaryStats.length > 0 ? Math.min(...primaryStats) : 0;
const maxPower = primaryStats.length > 0 ? Math.max(...primaryStats) : 0;
const globalMax = Math.max(...DUMMY_ITEMS.flatMap(i => i.stats.map(s => s.maxValue ?? 0)), 1);

const leftPct = (minPower / globalMax) * 100;
const widthPct = ((maxPower - minPower) / globalMax) * 100;

export function PowerMetric() {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{minPower}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>&ndash;</span>
        <span className="font-bold" style={{ color: ACCENT }}>{maxPower}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> power range</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden relative"
        style={{ backgroundColor: withOpacity(ACCENT, OPACITY_15) }}
        title={`Power range: ${minPower}–${maxPower} (max possible: ${globalMax})`}
      >
        <div
          className="absolute h-full rounded-full"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(widthPct, 2)}%`,
            backgroundColor: ACCENT,
          }}
        />
      </div>
    </div>
  );
}
