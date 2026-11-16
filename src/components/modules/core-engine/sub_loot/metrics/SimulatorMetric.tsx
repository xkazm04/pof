'use client';

import { ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** Affix pool size - the view's reading. */
export function SimulatorMetric({ reading }: { reading: MetricReading }) {
  return (
    <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
      <span className="font-bold" style={{ color: ACCENT }}>{reading.value ?? '?'}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit}</span>
    </div>
  );
}
