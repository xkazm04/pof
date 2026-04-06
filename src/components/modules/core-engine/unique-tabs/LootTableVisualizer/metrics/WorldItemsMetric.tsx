'use client';

import { WORLD_ITEMS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const count = WORLD_ITEMS.length;

export function WorldItemsMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {WORLD_ITEMS.map((item) => (
          <span
            key={item.name}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: item.beamColor }}
            aria-hidden="true"
            title={`${item.name} (${item.rarity})`}
          />
        ))}
      </div>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{count}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> world items</span>
      </div>
    </div>
  );
}
