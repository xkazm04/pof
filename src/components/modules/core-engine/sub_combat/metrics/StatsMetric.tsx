'use client';

import { WEAPON_ROSTER, ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

/** Mean canon expected DPS over the weapon roster (weapon-throughput). */
const avgDps = Math.round(WEAPON_ROSTER.meanDps);

export function StatsMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight" title={`Mean of ${WEAPON_ROSTER.rows.length} weapons`}>
      <span className="font-bold" style={{ color: ACCENT }}>{avgDps}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> avg DPS</span>
    </div>
  );
}
