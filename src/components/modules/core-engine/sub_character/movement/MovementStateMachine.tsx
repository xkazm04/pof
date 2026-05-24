'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_ORANGE, OPACITY_5, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { MOVEMENT_STATES } from '../_shared/data';
import {
  STATE_POSITIONS, STATE_TRANSITIONS,
  NODE_RX, NODE_RY, edgeEndpoints,
} from './state-machine-data';

export function MovementStateMachine() {
  const [hoveredState, setHoveredState] = useState<number | null>(null);

  return (
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
  );
}
