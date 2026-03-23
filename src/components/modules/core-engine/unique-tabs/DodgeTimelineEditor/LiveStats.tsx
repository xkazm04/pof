'use client';

import { motion } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
  STATUS_NEUTRAL,
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
          borderColor: stats.inMovement ? `${ACCENT_CYAN}60` : `${ACCENT_CYAN}20`,
          backgroundColor: `${ACCENT_CYAN}08`,
        }}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Distance</div>
        <div className="text-sm font-mono font-bold" style={{ color: ACCENT_CYAN, textShadow: `0 0 12px ${ACCENT_CYAN}40` }}>
          {stats.dist.toFixed(0)} <span className="text-xs font-normal text-text-muted">cm</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inInvuln ? `${ACCENT_ORANGE}60` : `${ACCENT_ORANGE}20`,
          backgroundColor: `${ACCENT_ORANGE}08`,
        }}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">I-Frames</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inInvuln ? ACCENT_ORANGE : 'var(--text-muted)', textShadow: stats.inInvuln ? `0 0 12px ${ACCENT_ORANGE}40` : 'none' }}>
          {stats.inInvuln ? 'ACTIVE' : `${params.iFrameDuration}s`}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inCancel ? `${ACCENT_VIOLET}60` : `${ACCENT_VIOLET}20`,
          backgroundColor: `${ACCENT_VIOLET}08`,
        }}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Cancel</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inCancel ? ACCENT_VIOLET : 'var(--text-muted)', textShadow: stats.inCancel ? `0 0 12px ${ACCENT_VIOLET}40` : 'none' }}>
          {stats.inCancel ? 'OPEN' : `${params.cancelWindowStart.toFixed(2)}s`}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="relative p-1.5 rounded-lg border overflow-hidden"
        style={{
          borderColor: stats.inCooldown ? `${STATUS_NEUTRAL}50` : `${STATUS_NEUTRAL}20`,
          backgroundColor: `${STATUS_NEUTRAL}08`,
        }}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Cooldown</div>
        <div className="text-sm font-mono font-bold" style={{ color: stats.inCooldown ? STATUS_NEUTRAL : 'var(--text-muted)', textShadow: stats.inCooldown ? `0 0 12px ${STATUS_NEUTRAL}40` : 'none' }}>
          {stats.inCooldown ? `${Math.max(0, phases.recovery.end - playhead).toFixed(2)}s` : `${params.cooldown}s`}
        </div>
      </motion.div>
    </div>
  );
}
