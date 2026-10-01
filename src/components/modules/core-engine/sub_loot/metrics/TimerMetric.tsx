'use client';

import { ACCENT } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** The live pity threshold (Pity tab slider) - no bar: a fill fraction would encode nothing. */
export function TimerMetric({ reading }: { reading: MetricReading }) {
  return (
    <div className={`${TEXT_SCALE.meta} font-mono leading-tight`} title={reading.detail}>
      <span className="font-bold" style={{ color: ACCENT }}>{reading.value ?? '?'}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit}</span>
    </div>
  );
}
