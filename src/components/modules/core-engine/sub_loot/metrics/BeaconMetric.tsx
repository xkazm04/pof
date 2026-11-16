'use client';

import { BEACON_CONFIGS, ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** One bar per beacon config; the printed count is the view's reading. */
export function BeaconMetric({ reading }: { reading: MetricReading }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5 items-end">
        {BEACON_CONFIGS.map((b) => (
          <span
            key={b.rarity}
            className="inline-block w-1.5 rounded-sm"
            style={{
              height: `${Math.max(4, b.beamHeight / 10)}px`,
              backgroundColor: b.color,
            }}
            aria-hidden="true"
            title={`${b.rarity} beam (h:${b.beamHeight})`}
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
