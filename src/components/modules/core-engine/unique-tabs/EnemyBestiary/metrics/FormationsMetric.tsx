'use client';

import { SPAWN_POINTS } from '../data';
import { MODULE_COLORS, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.content;
const spawnCount = SPAWN_POINTS.length;
const SIZE = 20;

export function FormationsMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} viewBox="0 0 140 140" aria-hidden="true">
        {SPAWN_POINTS.map((sp) => (
          <circle
            key={sp.id}
            cx={sp.x}
            cy={sp.y}
            r={8}
            fill={ACCENT}
            opacity={0.7}
          />
        ))}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{spawnCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> spawn points</span>
      </div>
    </div>
  );
}
