'use client';

import { useState } from 'react';
import { Zap, Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_EMERALD, ACCENT_ORANGE, OPACITY_5, OPACITY_15, OPACITY_25, GLOW_SM, withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../design';
import { DonutChart, AccelCurve } from '../../charts';
import {
  MOVEMENT_STATES, MOVEMENT_STATE_DISTRIBUTION,
  ACCEL_CURVE_POINTS, ACCEL_KEY_POINTS,
} from '../data';

/* ── State machine layout & transitions ──────────────────────────────────── */

const STATE_POSITIONS: { x: number; y: number }[] = [
  { x: 110, y: 30 },   // Idle (top center)
  { x: 40, y: 95 },    // Walk (mid-left)
  { x: 180, y: 95 },   // Run (mid-right)
  { x: 110, y: 160 },  // Sprint (bottom center)
  { x: 210, y: 30 },   // Dodge (top right)
];

interface StateTransition { from: number; to: number; label?: string }
const STATE_TRANSITIONS: StateTransition[] = [
  { from: 0, to: 1, label: 'Input' },
  { from: 1, to: 0, label: 'Release' },
  { from: 1, to: 2, label: 'Speed >' },
  { from: 2, to: 1, label: 'Speed <' },
  { from: 2, to: 3, label: 'Shift' },
  { from: 3, to: 2, label: 'Release' },
  { from: 0, to: 4, label: 'Space' },
  { from: 1, to: 4, label: 'Space' },
  { from: 2, to: 4, label: 'Space' },
  { from: 4, to: 0, label: 'Done' },
];

const NODE_RX = 28;
const NODE_RY = 14;

/** Compute edge start/end points offset to the ellipse surface */
function edgeEndpoints(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  return {
    x1: from.x + Math.cos(angle) * NODE_RX,
    y1: from.y + Math.sin(angle) * NODE_RY,
    x2: to.x - Math.cos(angle) * NODE_RX,
    y2: to.y - Math.sin(angle) * NODE_RY,
  };
}

export function MovementOverview() {
  const [hoveredState, setHoveredState] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ── State Machine SVG ────────────────────────────────────────── */}
      <BlueprintPanel className="p-4">
        <SectionHeader icon={Zap} label="State Machine" />

        <svg width="100%" viewBox="0 0 250 200" className="block">
          <defs>
            <marker id="arrow-default" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
              <path d="M0,0 L6,2 L0,4" fill="var(--text-muted)" opacity={0.5} />
            </marker>
            {MOVEMENT_STATES.map((s, i) => (
              <marker key={i} id={`arrow-${i}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <path d="M0,0 L6,2 L0,4" fill={s.color} />
              </marker>
            ))}
          </defs>

          {/* ── Transition arrows ──────────────────────────────────────── */}
          {STATE_TRANSITIONS.map((t, ti) => {
            const from = STATE_POSITIONS[t.from];
            const to = STATE_POSITIONS[t.to];
            const { x1, y1, x2, y2 } = edgeEndpoints(from, to);
            const isHighlighted = hoveredState === t.from || hoveredState === t.to;
            const isDimmed = hoveredState !== null && !isHighlighted;
            // Offset parallel edges
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len * 5;
            const ny = dx / len * 5;

            return (
              <g key={ti} opacity={isDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.2s' }}>
                <motion.line
                  x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny}
                  stroke={isHighlighted ? MOVEMENT_STATES[t.from].color : 'var(--text-muted)'}
                  strokeWidth={isHighlighted ? 1.5 : 0.8}
                  strokeDasharray={isHighlighted ? 'none' : '3 2'}
                  markerEnd={isHighlighted ? `url(#arrow-${t.from})` : 'url(#arrow-default)'}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: ti * 0.05, duration: 0.4 }}
                />
                {isHighlighted && t.label && (
                  <text
                    x={(x1 + nx + x2 + nx) / 2}
                    y={(y1 + ny + y2 + ny) / 2 - 4}
                    textAnchor="middle"
                    className="text-[7px] font-mono fill-text-muted"
                    style={{ fill: MOVEMENT_STATES[t.from].color }}
                  >
                    {t.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── State nodes ────────────────────────────────────────────── */}
          {MOVEMENT_STATES.map((state, i) => {
            const pos = STATE_POSITIONS[i];
            const isHovered = hoveredState === i;
            const isDimmed = hoveredState !== null && !isHovered;
            return (
              <g
                key={state.label}
                onMouseEnter={() => setHoveredState(i)}
                onMouseLeave={() => setHoveredState(null)}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                opacity={isDimmed ? 0.35 : 1}
              >
                <motion.ellipse
                  cx={pos.x} cy={pos.y} rx={NODE_RX} ry={NODE_RY}
                  fill={withOpacity(state.color, isHovered ? OPACITY_15 : OPACITY_5)}
                  stroke={state.color}
                  strokeWidth={isHovered ? 2 : 1}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 15 }}
                />
                {isHovered && (
                  <motion.ellipse
                    cx={pos.x} cy={pos.y} rx={NODE_RX + 3} ry={NODE_RY + 2}
                    fill="none" stroke={state.color} strokeWidth={0.5}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 0.4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                <text
                  x={pos.x} y={pos.y + 4}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-bold pointer-events-none"
                  style={{ fill: state.color }}
                >
                  {state.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Context notes */}
        <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-border/15 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT_ORANGE }} /> Sprint: Shift held
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MOVEMENT_STATES[4].color }} /> Dodge: Space (cooldown)
          </span>
        </div>
      </BlueprintPanel>

      {/* ── Movement State Distribution ───────────────────────────────── */}
      <BlueprintPanel className="p-4">
        <SectionHeader icon={Activity} label="Time Distribution" color={ACCENT_EMERALD} />

        <div className="flex flex-col items-center gap-4">
          <DonutChart segments={MOVEMENT_STATE_DISTRIBUTION} centerLabel="100%" centerSublabel="Time Split" />

          <div className="flex flex-col gap-2 w-full">
            {MOVEMENT_STATE_DISTRIBUTION.map((state, i) => (
              <motion.div
                key={state.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: state.color, boxShadow: `${GLOW_SM} ${withOpacity(state.color, OPACITY_25)}` }} />
                <span className="text-xs font-mono text-text w-12 uppercase tracking-wider">{state.label}</span>
                <div className="flex-1">
                  <NeonBar pct={state.pct} color={state.color} height={5} />
                </div>
                <span className="text-xs font-mono font-bold tabular-nums w-7 text-right" style={{ color: state.color }}>
                  {state.pct}%
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </BlueprintPanel>

      {/* ── Sprint Acceleration Curve ─────────────────────────────────── */}
      <BlueprintPanel className="p-4">
        <SectionHeader icon={TrendingUp} label="Acceleration" color={ACCENT_ORANGE} />
        <div className="flex justify-center">
          <AccelCurve points={ACCEL_CURVE_POINTS} keyPoints={ACCEL_KEY_POINTS} accent={ACCENT_ORANGE} title="Speed (cm/s)" />
        </div>
      </BlueprintPanel>
    </div>
  );
}
