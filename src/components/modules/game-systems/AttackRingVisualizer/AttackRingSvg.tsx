'use client';

import {
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import {
  SVG_SIZE, SVG_CENTER, SVG_PADDING, MAX_DRAW_RADIUS,
} from './constants';
import type { RingPoint } from './types';

interface AttackRingSvgProps {
  outerPoints: RingPoint[];
  innerPoints: RingPoint[];
  innerRing: boolean;
  outerR: number;
  innerR: number;
  attackDist: number;
  totalPoints: number;
}

export function AttackRingSvg({ outerPoints, innerPoints, innerRing, outerR, innerR, attackDist, totalPoints }: AttackRingSvgProps) {
  return (
    <div className="flex-1 flex justify-center">
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="rounded-lg border border-border/30 bg-surface-deep/50"
        data-testid="attack-ring-svg"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle
            key={f}
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={MAX_DRAW_RADIUS * f}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}
        {/* Crosshair */}
        <line x1={SVG_PADDING} y1={SVG_CENTER} x2={SVG_SIZE - SVG_PADDING} y2={SVG_CENTER} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        <line x1={SVG_CENTER} y1={SVG_PADDING} x2={SVG_CENTER} y2={SVG_SIZE - SVG_PADDING} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

        {/* Outer ring circle */}
        <circle
          cx={SVG_CENTER}
          cy={SVG_CENTER}
          r={outerR}
          fill="none"
          stroke={ACCENT_CYAN}
          strokeWidth={1.5}
          strokeDasharray="6 3"
          opacity={0.5}
        />

        {/* Inner ring circle (when enabled) */}
        {innerRing && (
          <circle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={innerR}
            fill="none"
            stroke={ACCENT_VIOLET}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        )}

        {/* Outer ring points */}
        {outerPoints.map((pt, i) => (
          <g key={`outer-${i}`}>
            {/* Line from center to point */}
            <line
              x1={SVG_CENTER}
              y1={SVG_CENTER}
              x2={pt.x}
              y2={pt.y}
              stroke={ACCENT_CYAN}
              strokeWidth={0.5}
              opacity={0.15}
            />
            {/* Point dot */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={ACCENT_CYAN}
              opacity={0.8}
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={7}
              fill={ACCENT_CYAN}
              opacity={0.15}
            />
          </g>
        ))}

        {/* Inner ring points */}
        {innerPoints.map((pt, i) => (
          <g key={`inner-${i}`}>
            <line
              x1={SVG_CENTER}
              y1={SVG_CENTER}
              x2={pt.x}
              y2={pt.y}
              stroke={ACCENT_VIOLET}
              strokeWidth={0.5}
              opacity={0.1}
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill={ACCENT_VIOLET}
              opacity={0.7}
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={6}
              fill={ACCENT_VIOLET}
              opacity={0.12}
            />
          </g>
        ))}

        {/* Center target actor */}
        <circle cx={SVG_CENTER} cy={SVG_CENTER} r={8} fill={ACCENT_ORANGE} opacity={0.3} />
        <circle cx={SVG_CENTER} cy={SVG_CENTER} r={4} fill={ACCENT_ORANGE} opacity={0.8} />
        <text
          x={SVG_CENTER}
          y={SVG_CENTER - 14}
          textAnchor="middle"
          className="text-[11px] font-mono font-bold"
          fill={ACCENT_ORANGE}
        >
          TargetActor
        </text>

        {/* Distance labels */}
        <text
          x={SVG_CENTER + outerR + 4}
          y={SVG_CENTER - 4}
          className="text-[11px] font-mono"
          fill={ACCENT_CYAN}
          opacity={0.7}
        >
          {attackDist}u
        </text>
        {innerRing && (
          <text
            x={SVG_CENTER + innerR + 4}
            y={SVG_CENTER + 10}
            className="text-[11px] font-mono"
            fill={ACCENT_VIOLET}
            opacity={0.7}
          >
            {Math.round(attackDist * 0.5)}u
          </text>
        )}

        {/* Total points badge */}
        <rect x={4} y={4} width={70} height={20} rx={4} fill="rgba(0,0,0,0.5)" />
        <text x={8} y={17} className="text-[11px] font-mono font-bold" fill={ACCENT_CYAN}>
          {totalPoints} pts
        </text>
      </svg>
    </div>
  );
}
