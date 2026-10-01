'use client';

import { WEAPON_ROSTER, ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

/** Highest canon expected DPS in the weapon roster (weapon-throughput). */
const best = WEAPON_ROSTER.best;

export function EffectivenessMetric() {
  if (!best) return null;
  return (
    <div className="text-[10px] font-mono leading-tight truncate" title={`${best.name}: ${best.dps.toFixed(1)} DPS (canon crit, no target armour)`}>
      <span className="font-bold" style={{ color: best.weapon.color }}>{best.name}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {Math.round(best.dps)} DPS</span>
    </div>
  );
}
