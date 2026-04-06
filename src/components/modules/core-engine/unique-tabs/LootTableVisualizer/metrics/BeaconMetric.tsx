'use client';

import { BEACON_CONFIGS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const beaconCount = BEACON_CONFIGS.length;

export function BeaconMetric() {
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
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{beaconCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> beacons</span>
      </div>
    </div>
  );
}
