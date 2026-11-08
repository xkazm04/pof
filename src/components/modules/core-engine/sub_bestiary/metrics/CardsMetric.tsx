'use client';

import { ARCHETYPES, ENEMY_ROLE_COLORS } from '../_shared/data';
import { ACCENT_RED, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const total = ARCHETYPES.length;
const roleCounts = ARCHETYPES.reduce<Partial<Record<keyof typeof ENEMY_ROLE_COLORS, number>>>((acc, a) => {
  acc[a.role] = (acc[a.role] ?? 0) + 1;
  return acc;
}, {});

const segments = (Object.keys(ENEMY_ROLE_COLORS) as (keyof typeof ENEMY_ROLE_COLORS)[])
  .filter(role => roleCounts[role])
  .map(role => ({
    role,
    pct: ((roleCounts[role] ?? 0) / total) * 100,
    color: ENEMY_ROLE_COLORS[role],
  }));

const SIZE = 20;
const R = 8;
const IR = 4;
const CX = SIZE / 2;
const CY = SIZE / 2;

export function CardsMetric({ roleSegments = segments }: { roleSegments?: typeof segments }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {roleSegments.map((seg, i) => {
          const startAngle = -90 + roleSegments.slice(0, i).reduce((s, s2) => s + (s2.pct / 100) * 360, 0);
          const sweep = (seg.pct / 100) * 360;
          if (sweep >= 359.99) {
            return <circle key={seg.role} cx={CX} cy={CY} r={(R + IR) / 2} fill="none" stroke={seg.color} strokeWidth={R - IR} opacity={0.85} />;
          }
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
      <div className="text-2xs font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT_RED }}>{total}</span>
        <span style={{ color: withOpacity(ACCENT_RED, OPACITY_50) }}> archetypes</span>
      </div>
    </div>
  );
}
