'use client';

import { ReactNode, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { motion, useReducedMotion } from 'framer-motion';
import {
  STATUS_SUCCESS,
  OPACITY_8, OPACITY_20, OPACITY_25, OPACITY_50, OPACITY_90,
  GLOW_SM, GLOW_MD,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import type { FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from './constants';

/* ── StatusDot ────────────────────────────────────────────────────────────── */

export function StatusDot({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];
  const isActive = status === 'implemented' || status === 'improved';
  const prefersReduced = useReducedMotion();
  return (
    <span className="flex items-center gap-1.5">
      <motion.span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: sc.dot, boxShadow: isActive ? `${GLOW_SM} ${sc.dot}` : 'none' }}
        animate={isActive && !prefersReduced ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={prefersReduced ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
    </span>
  );
}

/* ── TabHeader ────────────────────────────────────────────────────────────── */

interface TabHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  implemented: number;
  total: number;
  accent: string;
  children?: ReactNode;
}

export function TabHeader({ icon: Icon, title, implemented, total, accent, children }: TabHeaderProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between pb-2 border-b border-border/40"
    >
      <div className="flex items-center gap-1.5">
        <div className="p-1.5 rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: accent }} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity blur-md" style={{ backgroundColor: accent }} />
          <Icon className="w-4 h-4 relative z-10" style={{ color: accent, filter: `drop-shadow(${GLOW_SM} ${withOpacity(accent, OPACITY_50)})` }} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-text tracking-wide">{title}</span>
          <span className="text-sm text-text-muted">
            <span className="font-mono font-medium" style={{ color: implemented === total ? STATUS_SUCCESS : accent }}>{implemented}</span>
            <span className="opacity-60">/{total} deployed</span>
          </span>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/* ── ModuleHeader ─────────────────────────────────────────────────────────── */

/**
 * Shared "implemented / total" progress chip. Identical in both ModuleHeader
 * variants so the readout looks the same whichever module you're on. Turns
 * green once everything is implemented.
 */
export function ProgressChip({ implemented, total, accent }: { implemented: number; total: number; accent: string }) {
  const complete = total > 0 && implemented >= total;
  const color = complete ? STATUS_SUCCESS : accent;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono shrink-0"
      style={{ borderColor: withOpacity(color, OPACITY_20), backgroundColor: withOpacity(color, OPACITY_8) }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `${GLOW_SM} ${withOpacity(color, OPACITY_50)}` }}
      />
      <span className="font-bold tabular-nums" style={{ color }}>{implemented}</span>
      <span className="text-text-muted">/ {total}</span>
      <span className="text-text-muted opacity-70">ready</span>
    </span>
  );
}

export interface ModuleHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  implemented: number;
  total: number;
  accent: string;
  /**
   * `'default'` — clean rounded icon tile + plain title, matching the rest of
   * the core-engine tabs. `'terminal'` — preserves the save-system terminal
   * identity (blueprint icon frame, mono uppercase glow title, blinking
   * cursor). Both variants share the same skeleton, spacing (`gap-3 pb-3
   * border-b`) and progress chip, so siblings read as one app.
   */
  variant?: 'default' | 'terminal';
  /** Optional plain-language subtitle shown beneath the title. */
  subtitle?: string;
  /** Optional trailing content (actions) rendered after the progress chip. */
  children?: ReactNode;
}

/**
 * Unified header for sibling module tabs. Replaces the per-module hand-rolled
 * headers so spacing and the implemented/total chip read identically, while the
 * optional `terminal` variant keeps a module's established visual identity.
 */
export function ModuleHeader({
  icon: Icon, title, implemented, total, accent,
  variant = 'default', subtitle, children,
}: ModuleHeaderProps) {
  const prefersReduced = useReducedMotion();
  const isTerminal = variant === 'terminal';

  // Blinking cursor — terminal variant only, paused while suspended and steady
  // for reduced-motion users.
  const [cursorOn, setCursorOn] = useState(true);
  useSuspendableEffect(() => {
    if (!isTerminal || prefersReduced) return;
    const id = setInterval(() => setCursorOn((v) => !v), UI_TIMEOUTS.cursorBlink);
    return () => clearInterval(id);
  }, [isTerminal, prefersReduced]);

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-3 pb-3 border-b border-border"
    >
      <div className="flex items-center gap-3 min-w-0">
        {isTerminal ? (
          <BlueprintPanel color={accent} className="p-2 grid place-items-center shrink-0">
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </BlueprintPanel>
        ) : (
          <div className="p-1.5 rounded-lg relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: accent }} />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity blur-md" style={{ backgroundColor: accent }} />
            <Icon className="w-5 h-5 relative z-10" style={{ color: accent, filter: `drop-shadow(${GLOW_SM} ${withOpacity(accent, OPACITY_50)})` }} />
          </div>
        )}

        <div className="flex flex-col min-w-0">
          {isTerminal ? (
            <span
              className="text-base font-bold font-mono tracking-widest uppercase truncate"
              style={{ color: withOpacity(accent, OPACITY_90), textShadow: `${GLOW_MD} ${withOpacity(accent, OPACITY_25)}` }}
            >
              {title}
              <span aria-hidden style={{ color: accent }}>{cursorOn ? '_' : ' '}</span>
            </span>
          ) : (
            <span className="text-base font-bold text-text tracking-wide truncate">{title}</span>
          )}
          {subtitle && (
            <span className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ProgressChip implemented={implemented} total={total} accent={accent} />
        {children}
      </div>
    </motion.div>
  );
}
