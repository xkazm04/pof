'use client';

import { ACCENT, rarityColorFor } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { withOpacity, OPACITY_20, OPACITY_50 } from '@/lib/chart-colors';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

const BAR_W = 24;
const BAR_H = 4;

/**
 * Legendary p95 dry streak with the live pity, over the unpitied p95: the bar is the
 * share of the natural worst-case streak that pity still lets a player sit through.
 */
export function DroughtMetric({ reading }: { reading: MetricReading }) {
  const color = rarityColorFor('Legendary');
  const frac = reading.value != null && reading.unpitied ? Math.min(1, reading.value / reading.unpitied) : 0;
  return (
    <div className="flex items-center gap-1.5" title={reading.detail}>
      <svg width={BAR_W} height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} aria-hidden="true">
        <rect x={0} y={0} width={BAR_W} height={BAR_H} rx={2} fill={withOpacity(color, OPACITY_20)} />
        <rect x={0} y={0} width={BAR_W * frac} height={BAR_H} rx={2} fill={color} />
      </svg>
      <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
        <span className="font-bold" style={{ color }}>{reading.value ?? '?'}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit} p95</span>
      </div>
    </div>
  );
}
