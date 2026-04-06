'use client';

import { RARITY_TIERS, TOTAL_WEIGHT, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

/** Legendary drop probability as the drought benchmark */
const legendaryTier = RARITY_TIERS.find(t => t.name === 'Legendary');
const dropPct = legendaryTier ? ((legendaryTier.weight / TOTAL_WEIGHT) * 100).toFixed(0) : '?';
const legendaryColor = legendaryTier?.color ?? ACCENT;

export function DroughtMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: legendaryColor }}>{dropPct}%</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> probability</span>
    </div>
  );
}
