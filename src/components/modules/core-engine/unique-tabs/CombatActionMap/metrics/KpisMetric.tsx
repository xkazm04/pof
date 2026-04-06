'use client';

import { ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_CYAN, GLOW_SM } from '@/lib/chart-colors';

const LIGHTS = [
  { label: 'TTK', color: ACCENT_EMERALD },
  { label: 'DPS', color: ACCENT_ORANGE },
  { label: 'APM', color: ACCENT_CYAN },
];

export function KpisMetric() {
  return (
    <div className="flex items-center gap-1">
      {LIGHTS.map((l) => (
        <div
          key={l.label}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: l.color, boxShadow: `${GLOW_SM} ${l.color}` }}
          title={l.label}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
