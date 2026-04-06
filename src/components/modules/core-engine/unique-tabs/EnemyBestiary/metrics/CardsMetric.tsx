'use client';

import { ARCHETYPES } from '../data';
import { ACCENT_RED, ACCENT_CYAN, ACCENT_EMERALD, STATUS_NEUTRAL, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const total = ARCHETYPES.length;
const roleCounts = ARCHETYPES.reduce<Record<string, number>>((acc, a) => {
  acc[a.role] = (acc[a.role] ?? 0) + 1;
  return acc;
}, {});

const ROLE_COLORS: Record<string, string> = {
  melee: ACCENT_RED,
  ranged: ACCENT_CYAN,
  tank: ACCENT_EMERALD,
};

const segments = Object.entries(roleCounts).map(([role, count]) => ({
  role,
  pct: (count / total) * 100,
  color: ROLE_COLORS[role] ?? STATUS_NEUTRAL,
}));

const SIZE = 20;
const R = 8;
const IR = 4;
const CX = SIZE / 2;
const CY = SIZE / 2;

export function CardsMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {segments.map((seg, i) => {
          const startAngle = -90 + segments.slice(0, i).reduce((s, s2) => s + (s2.pct / 100) * 360, 0);
          const sweep = (seg.pct / 100) * 360;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = ((startAngle + sweep) * Math.PI) / 180;
          const largeArc = sweep > 180 ? 1 : 0;
          const d = [
            `M ${CX + R * Math.cos(startRad)} ${CY + R * Math.sin(startRad)}`,
            `A ${R} ${R} 0 ${largeArc} 1 ${CX + R * Math.cos(endRad)} ${CY + R * Math.sin(endRad)}`,
            `L ${CX + IR * Math.cos(endRad)} ${CY + IR * Math.sin(endRad)}`,
            `A ${IR} ${IR} 0 ${largeArc} 0 ${CX + IR * Math.cos(startRad)} ${CY + IR * Math.sin(startRad)}`,
            'Z',
          ].join(' ');
          return <path key={seg.role} d={d} fill={seg.color} opacity={0.85} />;
        })}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT_RED }}>{total}</span>
        <span style={{ color: withOpacity(ACCENT_RED, OPACITY_50) }}> archetypes</span>
      </div>
    </div>
  );
}
