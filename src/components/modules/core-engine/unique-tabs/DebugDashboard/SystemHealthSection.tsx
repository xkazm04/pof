'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Cpu, BarChart3 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';
import { BlueprintPanel, SectionHeader } from '../_design';
import { HeatmapGrid } from '../_shared';
import {
  ACCENT, HEALTH_MATRIX_ROWS, HEALTH_MATRIX_COLS, HEALTH_MATRIX_CELLS,
  FRAME_TIME_BARS, FRAME_TARGET_MS, FRAME_TOTAL_MS,
} from './data';

/* ── 12.1 System Health Matrix ─────────────────────────────────────────── */

export function SystemHealthMatrix() {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={motionSafe({ ...ANIMATION_PRESETS.entrance, delay: 0.1 }, prefersReduced)}>
      <SectionHeader label="SYSTEM_HEALTH_MATRIX" color={ACCENT} icon={Cpu} />
      <BlueprintPanel color={ACCENT} className="p-3">
        <HeatmapGrid
          rows={HEALTH_MATRIX_ROWS}
          cols={HEALTH_MATRIX_COLS}
          cells={HEALTH_MATRIX_CELLS}
          lowColor="#0c2d1a"
          highColor={STATUS_ERROR}
          accent={ACCENT}
        />
        <div className="flex items-center gap-4 mt-3 text-xs font-mono uppercase tracking-wider text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#0c2d1a' }} /> HEALTHY
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_WARNING }} /> WARNING
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> CRITICAL
          </span>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}

/* ── 12.2 Frame Time Waterfall ─────────────────────────────────────────── */

export function FrameTimeWaterfall() {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={motionSafe({ ...ANIMATION_PRESETS.entrance, delay: 0.15 }, prefersReduced)}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="FRAME_TIME_WATERFALL" color={ACCENT} icon={BarChart3} />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted shrink-0 ml-2">
          {FRAME_TOTAL_MS.toFixed(1)}ms / {FRAME_TARGET_MS.toFixed(2)}ms
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="space-y-3">
          {FRAME_TIME_BARS.map((bar) => {
            const pct = (bar.ms / FRAME_TARGET_MS) * 100;
            return (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-wider w-24 text-right text-text-muted">{bar.label}</span>
                <div className="flex-1 h-5 rounded-sm relative overflow-hidden" style={{ backgroundColor: `${ACCENT}08` }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={motionSafe(ANIMATION_PRESETS.fill, prefersReduced)}
                    className="h-full rounded-sm"
                    style={{
                      backgroundColor: `${bar.color}40`,
                      borderRight: `2px solid ${bar.color}`,
                      boxShadow: `inset 0 0 10px ${bar.color}20`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-bold w-14 text-right" style={{ color: bar.color, textShadow: `0 0 6px ${bar.color}40` }}>
                  {bar.ms.toFixed(1)}ms
                </span>
              </div>
            );
          })}
        </div>

        {/* Stacked summary bar */}
        <div className="mt-3 relative">
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">STACKED FRAME BUDGET</div>
          <div className="h-6 rounded-sm flex overflow-hidden relative" style={{ backgroundColor: `${ACCENT}08` }}>
            {FRAME_TIME_BARS.map((bar) => (
              <motion.div
                key={bar.label}
                initial={{ width: 0 }}
                animate={{ width: `${(bar.ms / FRAME_TARGET_MS) * 100}%` }}
                transition={motionSafe(ANIMATION_PRESETS.fill, prefersReduced)}
                className="h-full relative group"
                style={{
                  backgroundColor: `${bar.color}50`,
                  borderRight: `1px solid ${ACCENT}10`,
                }}
                title={`${bar.label}: ${bar.ms}ms`}
              />
            ))}
            <div className="absolute right-0 top-0 bottom-0 w-[2px]" style={{ left: '100%', backgroundColor: `${ACCENT}80` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">0ms</span>
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: `${ACCENT}cc` }}>{FRAME_TARGET_MS.toFixed(2)}ms (60fps)</span>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
