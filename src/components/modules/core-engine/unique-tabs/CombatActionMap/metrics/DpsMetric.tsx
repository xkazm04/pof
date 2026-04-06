'use client';

import { DPS_STRATEGIES, DPS_MAX } from '../data';
import { withOpacity, OPACITY_25 } from '@/lib/chart-colors';

const top3 = [...DPS_STRATEGIES].sort((a, b) => b.dps - a.dps).slice(0, 3);

export function DpsMetric() {
  return (
    <div className="flex items-end gap-0.5 h-3">
      {top3.map((s) => (
        <div key={s.name} className="flex-1 flex flex-col justify-end h-full" title={`${s.name}: ${s.dps} DPS`}>
          <div
            className="w-full rounded-sm min-h-[2px]"
            style={{
              height: `${(s.dps / DPS_MAX) * 100}%`,
              backgroundColor: s.color,
              boxShadow: `0 0 3px ${withOpacity(s.color, OPACITY_25)}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
