'use client';

import { WEAPON_ROSTER } from '../_shared/data';
import { withOpacity, OPACITY_25 } from '@/lib/chart-colors';

/** Top 3 weapons by canon expected DPS (weapon-throughput), scaled to the roster max. */
const top3 = WEAPON_ROSTER.rows.slice(0, 3);
const max = WEAPON_ROSTER.globalMax || 1;

export function DpsMetric() {
  return (
    <div className="flex items-end gap-0.5 h-3">
      {top3.map((r) => (
        <div key={r.id} className="flex-1 flex flex-col justify-end h-full" title={`${r.name}: ${r.dps.toFixed(1)} DPS`}>
          <div
            className="w-full rounded-sm min-h-[2px]"
            style={{
              height: `${(r.dps / max) * 100}%`,
              backgroundColor: r.weapon.color,
              boxShadow: `0 0 3px ${withOpacity(r.weapon.color, OPACITY_25)}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
