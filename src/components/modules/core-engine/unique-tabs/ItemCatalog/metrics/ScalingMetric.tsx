'use client';

import { SCALING_LINES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const LINE = SCALING_LINES[0];
const points = LINE?.points ?? [];
const maxVal = Math.max(...points.map(p => p.max));
const minLvl = points[0]?.level ?? 0;
const maxLvl = points[points.length - 1]?.level ?? 0;
const W = 48;
const H = 16;

function toX(i: number) { return (i / Math.max(points.length - 1, 1)) * W; }
function toY(v: number) { return H - (v / (maxVal || 1)) * H; }

const pathD = points
  .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY((p.min + p.max) / 2).toFixed(1)}`)
  .join(' ');

export function ScalingMetric() {
  if (points.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} aria-hidden="true" className="block shrink-0">
        <path d={pathD} fill="none" stroke={ACCENT} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[10px] font-mono leading-tight" style={{ color: withOpacity(ACCENT, OPACITY_50) }}>
        L{minLvl}&ndash;{maxLvl}
      </span>
    </div>
  );
}
