'use client';

import { ARCHETYPES, RADAR_DATA, RADAR_AXES } from '../data';
import { ACCENT_RED, ACCENT_CYAN, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const SIZE = 24;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 9;
const AXES_COUNT = RADAR_AXES.length;

function radarPoints(values: number[]): string {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / AXES_COUNT - Math.PI / 2;
    return `${CX + R * v * Math.cos(angle)},${CY + R * v * Math.sin(angle)}`;
  }).join(' ');
}

const withRadar = ARCHETYPES
  .filter(a => RADAR_DATA[a.id])
  .map(a => ({
    id: a.id,
    label: a.label,
    radar: RADAR_DATA[a.id],
    avg: RADAR_DATA[a.id].reduce((s, r) => s + r.value, 0) / RADAR_DATA[a.id].length,
  }));

const sorted = [...withRadar].sort((a, b) => a.avg - b.avg);
const weakest = sorted.length > 0 ? sorted[0] : null;
const strongest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
const weakValues = weakest ? weakest.radar.map(r => r.value) : [];
const strongValues = strongest ? strongest.radar.map(r => r.value) : [];

export function RadarMetric() {
  if (weakValues.length === 0 || strongValues.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <polygon
          points={radarPoints(weakValues)}
          fill={withOpacity(ACCENT_CYAN, OPACITY_50)}
          stroke={ACCENT_CYAN}
          strokeWidth={0.5}
        />
        <polygon
          points={radarPoints(strongValues)}
          fill={withOpacity(ACCENT_RED, OPACITY_50)}
          stroke={ACCENT_RED}
          strokeWidth={0.5}
        />
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span style={{ color: ACCENT_CYAN }} title={weakest?.label}>{weakest?.label?.slice(0, 3)}</span>
        <span style={{ color: withOpacity(ACCENT_RED, OPACITY_50) }}> vs </span>
        <span style={{ color: ACCENT_RED }} title={strongest?.label}>{strongest?.label?.slice(0, 3)}</span>
      </div>
    </div>
  );
}
