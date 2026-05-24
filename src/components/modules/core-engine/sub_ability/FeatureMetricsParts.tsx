'use client';

import type { ReactNode } from 'react';
import {
  OVERLAY_WHITE,
  OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';

/* ── Shared tiny metric helpers ───────────────────────────────────────────── */

export function MetricText({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="text-[10px] font-mono leading-tight block"
      style={{ color: color ?? withOpacity(OVERLAY_WHITE, OPACITY_50) }}
    >
      {children}
    </span>
  );
}

export function MetricHighlight({ value, color }: { value: string | number; color: string }) {
  return (
    <span
      className="text-[11px] font-mono font-bold"
      style={{ color }}
    >
      {value}
    </span>
  );
}

/* ── Mini Radar (40px SVG with 3-ability overlay) ─────────────────────────── */

const RADAR_SIZE = 40;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 16;
const RADAR_AXES = 5;

function radarPoints(values: number[]): string {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / RADAR_AXES - Math.PI / 2;
    const dist = v * RADAR_R;
    return `${RADAR_CX + dist * Math.cos(angle)},${RADAR_CY + dist * Math.sin(angle)}`;
  }).join(' ');
}

export function MiniRadar({ abilities }: { abilities: { name: string; color: string; values: number[] }[] }) {
  // Show up to 3 abilities
  const shown = abilities.slice(0, 3);

  if (shown.length === 0) {
    return (
      <span className="text-[10px] font-mono" style={{ color: withOpacity(OVERLAY_WHITE, OPACITY_30) }}>
        No data
      </span>
    );
  }

  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="block" aria-hidden="true">
      {/* Background grid */}
      {[0.33, 0.66, 1].map((scale) => (
        <polygon
          key={scale}
          points={Array.from({ length: RADAR_AXES }, (_, i) => {
            const angle = (Math.PI * 2 * i) / RADAR_AXES - Math.PI / 2;
            const dist = scale * RADAR_R;
            return `${RADAR_CX + dist * Math.cos(angle)},${RADAR_CY + dist * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke={withOpacity(OVERLAY_WHITE, OPACITY_20)}
          strokeWidth={0.5}
        />
      ))}
      {/* Ability overlays */}
      {shown.map((ab) => (
        <polygon
          key={ab.name}
          points={radarPoints(ab.values)}
          fill={withOpacity(ab.color, OPACITY_20)}
          stroke={withOpacity(ab.color, OPACITY_50)}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

/* ── Micro Timeline Strip (60px) ──────────────────────────────────────────── */

export function MicroTimeline({ events }: { events: { timestamp: number; color: string; duration?: number }[] }) {
  const maxT = Math.max(...events.map((e) => e.timestamp + (e.duration ?? 0)), 1);
  const w = 60;
  const h = 12;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden="true">
      <rect x={0} y={h / 2 - 1} width={w} height={2} rx={1} fill={withOpacity(OVERLAY_WHITE, OPACITY_20)} />
      {events.map((e, i) => {
        const x = (e.timestamp / maxT) * w;
        if (e.duration) {
          const barW = Math.max((e.duration / maxT) * w, 2);
          return (
            <rect
              key={i}
              x={x}
              y={1}
              width={barW}
              height={h - 2}
              rx={1}
              fill={withOpacity(e.color, OPACITY_30)}
              stroke={e.color}
              strokeWidth={0.5}
            />
          );
        }
        return (
          <circle
            key={i}
            cx={x}
            cy={h / 2}
            r={2}
            fill={e.color}
          />
        );
      })}
    </svg>
  );
}
