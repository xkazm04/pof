'use client';

import { AGGRO_TABLE } from '../data';
import { ACCENT_RED, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const threatCount = AGGRO_TABLE.length;
const maxThreat = Math.max(...AGGRO_TABLE.map(e => e.threat));

export function AggroMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {AGGRO_TABLE.map((entry) => (
          <div
            key={entry.target}
            className="h-2 rounded-sm"
            style={{
              width: `${Math.max(4, (entry.threat / maxThreat) * 16)}px`,
              backgroundColor: entry.color,
            }}
            title={`${entry.target}: ${entry.threat}%`}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT_RED }}>{threatCount}</span>
        <span style={{ color: withOpacity(ACCENT_RED, OPACITY_50) }}> threat sources</span>
      </div>
    </div>
  );
}
