'use client';

import { Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_EMERALD, ACCENT_ORANGE, OPACITY_25, GLOW_SM, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_shared/design';
import { DonutChart, AccelCurve } from '../../unique-tabs/charts';
import {
  MOVEMENT_STATE_DISTRIBUTION,
  ACCEL_CURVE_POINTS, ACCEL_KEY_POINTS,
} from '../_shared/data';
import { MovementStateMachine } from './MovementStateMachine';

export function MovementOverview() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ── State Machine SVG ────────────────────────────────────────── */}
      <MovementStateMachine />

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
