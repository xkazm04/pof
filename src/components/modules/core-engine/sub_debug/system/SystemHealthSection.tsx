'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Cpu, BarChart3 } from 'lucide-react';
import { STATUS_WARNING, STATUS_ERROR, OPACITY_5, OPACITY_12, OPACITY_25, OPACITY_30, withOpacity,
  OPACITY_80,
} from '@/lib/chart-colors';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { HeatmapGrid } from '../../unique-tabs/_shared';
import { ACCENT, HEALTH_MATRIX_ROWS, HEALTH_MATRIX_COLS, HEALTH_MATRIX_CELLS, THREAD_COLORS } from '../_shared/data';
import type { DebugSnapshot, ThreadId } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

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

const BOUND_LABEL: Record<ThreadId, string> = { game: 'GAME THREAD', render: 'RENDER THREAD', gpu: 'GPU' };

/** GT, RT and GPU run in parallel: the frame is the slowest of them, never their sum. */
export function FrameTimeWaterfall({ frame }: { frame: DebugSnapshot['frame'] }) {
  const prefersReduced = useReducedMotion();
  const over = frame.criticalPathMs > frame.budgetMs;
  return (
    <motion.div initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={motionSafe({ ...ANIMATION_PRESETS.entrance, delay: 0.15 }, prefersReduced)}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="FRAME_TIME_WATERFALL" color={ACCENT} icon={BarChart3} />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted shrink-0 ml-2" data-testid="frame-critical-path">
          {frame.criticalPathMs.toFixed(1)}ms / {frame.budgetMs.toFixed(2)}ms
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="space-y-3">
          {frame.threads.map((t) => {
            const color = THREAD_COLORS[t.id];
            const pct = (t.ms / frame.budgetMs) * 100;
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-wider w-24 text-right text-text-muted">{t.label}</span>
                <div className="flex-1 h-5 rounded-sm relative overflow-hidden" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_5) }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={motionSafe(ANIMATION_PRESETS.fill, prefersReduced)}
                    className="h-full rounded-sm"
                    style={{
                      backgroundColor: withOpacity(color, t.id === frame.boundBy ? OPACITY_30 : OPACITY_12),
                      borderRight: `2px solid ${color}`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-bold w-14 text-right" style={{ color, textShadow: `0 0 6px ${withOpacity(color, OPACITY_25)}` }}>
                  {t.ms.toFixed(1)}ms
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs font-mono uppercase tracking-wider">
          <span className="text-text-muted">
            Bound by <span className="font-bold" style={{ color: THREAD_COLORS[frame.boundBy] }}>{BOUND_LABEL[frame.boundBy]}</span>
            {' '}· threads run in parallel, the slowest sets the frame · {frame.avgFPS.toFixed(1)} fps avg
          </span>
          <span style={{ color: over ? STATUS_ERROR : withOpacity(ACCENT, OPACITY_80) }}>
            {over ? 'OVER' : 'WITHIN'} {frame.budgetMs.toFixed(2)}ms BUDGET
          </span>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
