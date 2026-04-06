'use client';

import { DIFFICULTY_BRUTE } from '../data';
import { STATUS_ERROR, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const points = DIFFICULTY_BRUTE;
const maxVal = Math.max(...points.map(p => p.value));
const WIDTH = 40;
const HEIGHT = 14;

const polyline = points.map((p, i) => {
  const x = (i / (points.length - 1)) * WIDTH;
  const y = HEIGHT - (p.value / maxVal) * HEIGHT;
  return `${x},${y}`;
}).join(' ');

export function DifficultyMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        <polyline
          points={polyline}
          fill="none"
          stroke={STATUS_ERROR}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span style={{ color: withOpacity(STATUS_ERROR, OPACITY_50) }}>L1–L50 brute</span>
      </div>
    </div>
  );
}
