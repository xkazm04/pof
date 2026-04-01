'use client';

import { Zap, Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_EMERALD, ACCENT_ORANGE } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from './design';
import { DonutChart, AccelCurve } from '../charts';
import {
  MOVEMENT_STATES, MOVEMENT_STATE_DISTRIBUTION,
  ACCEL_CURVE_POINTS, ACCEL_KEY_POINTS,
} from './data';

export function MovementOverview() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ── Movement States Flow ──────────────────────────────────────── */}
      <BlueprintPanel className="p-4">
        <SectionHeader icon={Zap} label="State Flow" />

        <div className="flex flex-col items-center gap-0.5">
          {MOVEMENT_STATES.map((state, i, arr) => (
            <div key={state.label} className="flex flex-col items-center w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: i % 2 === 0 ? -12 : 12 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative text-xs font-mono font-bold px-4 py-2 rounded-md border w-full text-center overflow-hidden group"
                style={{
                  borderColor: `${state.color}35`,
                  backgroundColor: `${state.color}08`,
                  color: state.color,
                }}
              >
                {/* Top edge glow */}
                <span className="absolute top-0 left-2 right-2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${state.color}40, transparent)` }} />
                {state.label}
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.08 + 0.1 }}
                  className="w-px h-3 origin-top"
                  style={{ backgroundColor: `${state.color}30` }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Context notes */}
        <div className="flex flex-col gap-1 mt-3 pt-2 border-t border-border/15 text-xs font-mono text-text-muted">
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
                  style={{ backgroundColor: state.color, boxShadow: `0 0 4px ${state.color}40` }} />
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
