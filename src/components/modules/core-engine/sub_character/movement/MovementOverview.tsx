'use client';

import { useMemo } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_EMERALD, ACCENT_ORANGE, OPACITY_25, GLOW_SM, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_shared/design';
import { DonutChart, AccelCurve } from '../../unique-tabs/charts';
import { MOVEMENT_STATE_DISTRIBUTION } from '../_shared/data';
import { FEEL_PRESETS, type FeelProfile } from '@/lib/character-feel-optimizer';
import { resolveStack } from '@/lib/feel-adjustment-layers';
import { encodeCurves } from '@/lib/character/feel-curve-codec';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { MovementStateMachine } from './MovementStateMachine';

/** The Playground's acceleration curve for a resolved profile, in cm/s: the codec's
 *  time coordinates (accel/decel bound x) with the walk and sprint plateaus as real speeds. */
export function resolvedAccelCurve(resolved: FeelProfile) {
  const pts = encodeCurves(resolved).accel;
  const walk = resolved.movement.maxWalkSpeed;
  const sprint = resolved.movement.maxSprintSpeed;
  const speeds = [0, walk, walk, sprint, sprint, 0];
  const points = pts.map((p, i) => ({ x: p.x, y: speeds[i] ?? 0 }));
  const yMax = Math.max(150, Math.ceil(sprint / 150) * 150);
  return {
    points,
    keyPoints: [
      { x: pts[2].x, y: walk, label: `${Math.round(walk)} cm/s` },
      { x: pts[3].x, y: sprint, label: `${Math.round(sprint)} cm/s` },
    ],
    yMax,
    ySteps: [0, 1, 2, 3, 4].map((k) => (yMax / 4) * k),
  };
}

export function MovementOverview() {
  const presetId = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const accel = useMemo(() => {
    const preset = FEEL_PRESETS.find((p) => p.id === presetId) ?? FEEL_PRESETS[0];
    return resolvedAccelCurve(resolveStack(preset.profile, feelLayers));
  }, [presetId, feelLayers]);
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
          <AccelCurve
            points={accel.points} keyPoints={accel.keyPoints} yMax={accel.yMax} ySteps={accel.ySteps}
            accent={ACCENT_ORANGE} title="Speed (cm/s)"
          />
        </div>
      </BlueprintPanel>
    </div>
  );
}
