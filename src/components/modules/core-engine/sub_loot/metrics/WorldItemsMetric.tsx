'use client';

import { WORLD_ITEMS, ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** One dot per world item; the printed count is the view's reading. */
export function WorldItemsMetric({ reading }: { reading: MetricReading }) {
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
      <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
        <span className="font-bold" style={{ color: ACCENT }}>{reading.value ?? '?'}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit}</span>
      </div>
    </div>
  );
}
