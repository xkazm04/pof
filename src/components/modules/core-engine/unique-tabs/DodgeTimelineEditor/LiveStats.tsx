'use client';

import { motion } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
  STATUS_NEUTRAL,
  withOpacity, OPACITY_37, OPACITY_12, OPACITY_5, OPACITY_25, OPACITY_30,
} from '@/lib/chart-colors';
import type { DodgeParams, DodgePhases } from '../dodge-types';
import { GlowStat } from '../_design';
import type { PlayheadStats } from './types';

export function LiveStats({
  stats,
  params,
  phases,
  playhead,
}: {
  stats: PlayheadStats;
  params: DodgeParams;
  phases: DodgePhases;
  playhead: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 mt-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inMovement ? `${withOpacity(ACCENT_CYAN, OPACITY_37)}` : `${withOpacity(ACCENT_CYAN, OPACITY_12)}`,
          backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_5)}`,
        }}
      >
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Distance</div>
        <div className="text-sm font-mono font-bold" style={{ color: ACCENT_CYAN, textShadow: `0 0 12px ${withOpacity(ACCENT_CYAN, OPACITY_25)}` }}>
          {stats.dist.toFixed(0)} <span className="text-xs font-normal text-text-muted">cm</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inInvuln ? `${withOpacity(ACCENT_ORANGE, OPACITY_37)}` : `${withOpacity(ACCENT_ORANGE, OPACITY_12)}`,
          backgroundColor: `${withOpacity(ACCENT_ORANGE, OPACITY_5)}`,
        }}
      >
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">I-Frames</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inInvuln ? ACCENT_ORANGE : 'var(--text-muted)', textShadow: stats.inInvuln ? `0 0 12px ${withOpacity(ACCENT_ORANGE, OPACITY_25)}` : 'none' }}>
          {stats.inInvuln ? 'ACTIVE' : `${params.iFrameDuration}s`}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inCancel ? `${withOpacity(ACCENT_VIOLET, OPACITY_37)}` : `${withOpacity(ACCENT_VIOLET, OPACITY_12)}`,
          backgroundColor: `${withOpacity(ACCENT_VIOLET, OPACITY_5)}`,
        }}
      >
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Cancel</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inCancel ? ACCENT_VIOLET : 'var(--text-muted)', textShadow: stats.inCancel ? `0 0 12px ${withOpacity(ACCENT_VIOLET, OPACITY_25)}` : 'none' }}>
          {stats.inCancel ? 'OPEN' : `${params.cancelWindowStart.toFixed(2)}s`}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inCooldown ? `${withOpacity(STATUS_NEUTRAL, OPACITY_30)}` : `${withOpacity(STATUS_NEUTRAL, OPACITY_12)}`,
          backgroundColor: `${withOpacity(STATUS_NEUTRAL, OPACITY_5)}`,
        }}
      >
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Cooldown</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inCooldown ? STATUS_NEUTRAL : 'var(--text-muted)', textShadow: stats.inCooldown ? `0 0 12px ${withOpacity(STATUS_NEUTRAL, OPACITY_25)}` : 'none' }}>
          {stats.inCooldown ? `${Math.max(0, phases.recovery.end - playhead).toFixed(2)}s` : `${params.cooldown}s`}
        </div>
      </motion.div>
    </div>
  );
}
