'use client';

import {
  Play, RotateCcw, Shield, Zap, Timer,
  ChevronRight, Pause, Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  STATUS_WARNING, OPACITY_20,
} from '@/lib/chart-colors';
import type { FeedbackConfig } from '@/types/combat-simulator';
import { BlueprintPanel } from '../_design';
import { StatInput } from './StatInput';

/* ── ConfigPanel ─ Feedback parameter sliders + run button ───────────── */

export function ConfigPanel({
  feedbackConfig, presetConfig, showConfig, isRunning, iterations,
  onUpdateFeedback, onToggleConfig, onSetIterations, onRun,
}: {
  feedbackConfig: FeedbackConfig;
  presetConfig: FeedbackConfig | null;
  showConfig: boolean;
  isRunning: boolean;
  iterations: number;
  onUpdateFeedback: (key: keyof FeedbackConfig, value: number | boolean) => void;
  onToggleConfig: () => void;
  onSetIterations: (v: number) => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-4">
      <BlueprintPanel className="p-3 space-y-3">
        <button onClick={onToggleConfig} className="w-full flex items-center gap-2 text-left">
          <motion.div animate={{ rotate: showConfig ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <ChevronRight className="w-3 h-3 text-text-muted" />
          </motion.div>
          <Pause className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text">
            Feedback Parameters
          </span>
        </button>

        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-1.5"
            >
              <StatInput label="Hitstop Duration" value={feedbackConfig.hitstopDurationSec}
                onChange={v => onUpdateFeedback('hitstopDurationSec', v)}
                min={0} max={0.3} step={0.005} unit="s" color={ACCENT_VIOLET}
                diverged={!!presetConfig && feedbackConfig.hitstopDurationSec !== presetConfig.hitstopDurationSec} />
              <StatInput label="Camera Shake" value={feedbackConfig.cameraShakeScale}
                onChange={v => onUpdateFeedback('cameraShakeScale', v)}
                min={0} max={5} step={0.1} unit="x" color={ACCENT_ORANGE}
                diverged={!!presetConfig && feedbackConfig.cameraShakeScale !== presetConfig.cameraShakeScale} />
              <StatInput label="Reaction Time" value={feedbackConfig.baseReactionTimeSec}
                onChange={v => onUpdateFeedback('baseReactionTimeSec', v)}
                min={0.1} max={0.5} step={0.01} unit="s" color={ACCENT_CYAN}
                diverged={!!presetConfig && feedbackConfig.baseReactionTimeSec !== presetConfig.baseReactionTimeSec} />
              <StatInput label="Shake Accuracy" value={feedbackConfig.shakeAccuracyPenalty}
                onChange={v => onUpdateFeedback('shakeAccuracyPenalty', v)}
                min={0} max={0.5} step={0.01} color={STATUS_WARNING}
                diverged={!!presetConfig && feedbackConfig.shakeAccuracyPenalty !== presetConfig.shakeAccuracyPenalty} />
              <StatInput label="Recovery Window" value={feedbackConfig.hitRecoveryWindowSec}
                onChange={v => onUpdateFeedback('hitRecoveryWindowSec', v)}
                min={0} max={0.5} step={0.01} unit="s" color={ACCENT_EMERALD}
                diverged={!!presetConfig && feedbackConfig.hitRecoveryWindowSec !== presetConfig.hitRecoveryWindowSec} />
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" checked={feedbackConfig.hitRecoveryIFrames}
                  onChange={e => onUpdateFeedback('hitRecoveryIFrames', e.target.checked)}
                  className="accent-current" style={{ color: ACCENT_EMERALD }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                  Recovery I-Frames
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BlueprintPanel>

      {/* Iterations */}
      <div className="flex items-center gap-2 px-1">
        <Timer className="w-3 h-3 text-text-muted" />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Iterations:</span>
        <input type="number" min={100} max={5000} step={100} value={iterations}
          onChange={e => onSetIterations(Math.max(100, Number(e.target.value)))}
          className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-[10px] font-mono text-text" />
      </div>

      {/* Run */}
      <button onClick={onRun} disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-bold uppercase tracking-[0.15em] transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${ACCENT_VIOLET}${OPACITY_20}`,
          color: ACCENT_VIOLET,
          border: `1px solid ${ACCENT_VIOLET}40`,
        }}
      >
        {isRunning ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RotateCcw className="w-4 h-4" />
          </motion.div>
        ) : (
          <Play className="w-4 h-4" />
        )}
        {isRunning ? 'Simulating...' : `Compare (${iterations}x2 fights)`}
      </button>

      {/* Current config summary */}
      <BlueprintPanel className="p-2 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
          <Pause className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
          Hitstop: {(feedbackConfig.hitstopDurationSec * 1000).toFixed(0)}ms
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
          <Camera className="w-2.5 h-2.5" style={{ color: ACCENT_ORANGE }} />
          Shake: {feedbackConfig.cameraShakeScale.toFixed(1)}x &rarr; {(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}% miss
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
          <Shield className="w-2.5 h-2.5" style={{ color: ACCENT_EMERALD }} />
          Recovery: {(feedbackConfig.hitRecoveryWindowSec * 1000).toFixed(0)}ms {feedbackConfig.hitRecoveryIFrames ? '+ i-frames' : ''}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
          <Zap className="w-2.5 h-2.5" style={{ color: ACCENT_CYAN }} />
          Effective reaction: {((feedbackConfig.hitstopDurationSec + feedbackConfig.baseReactionTimeSec) * 1000).toFixed(0)}ms
        </div>
      </BlueprintPanel>
    </div>
  );
}
