'use client';

import { ACCENT } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** The Core-tab what-if: summed EV/kill of the tuned roster minus the shipped one. */
export function ImpactMetric({ reading }: { reading: MetricReading }) {
  const v = reading.value ?? 0;
  const text = v === 0 ? '±0' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
  return (
    <div className={`${TEXT_SCALE.meta} font-mono leading-tight`} title={reading.detail}>
      <span className="font-bold" style={{ color: ACCENT }}>{text}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit}{reading.label ? ` ${reading.label}` : ''}</span>
    </div>
  );
}
