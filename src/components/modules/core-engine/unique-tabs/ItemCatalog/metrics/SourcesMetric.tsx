'use client';

import { CRYSTAL_STAFF_SOURCES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const sourceTypes = new Set(CRYSTAL_STAFF_SOURCES.map(s => s.type));
const typeCount = sourceTypes.size;

export function SourcesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight flex items-center gap-1.5">
      <span className="font-bold" style={{ color: ACCENT }}>{typeCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}>source types</span>
      <span className="flex gap-0.5">
        {CRYSTAL_STAFF_SOURCES.map(s => (
          <span
            key={s.name}
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: s.color }}
            title={`${s.name} (${s.type})`}
          />
        ))}
      </span>
    </div>
  );
}
