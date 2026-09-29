'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { motionSafe } from '@/lib/motion';
import {
  ACCENT_CYAN, OVERLAY_WHITE, STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_37,
  GLOW_MD, withOpacity,
} from '@/lib/chart-colors';
import type { ResolvedBinding } from '@/lib/character/input-bindings';
import type { KeyDef } from '../_shared/data';
import { abilityCategoryColorForAction } from '../_shared/data';

interface Props {
  kd: KeyDef;
  /** Resolved binding on this physical key (after overrides), if any. */
  binding?: ResolvedBinding;
  /** Every action on this key when more than one collides. */
  conflict?: string[];
}

/**
 * Single key cap in the keyboard map, drawn from the resolved binding state.
 * Tint priority (Phase 2 F3): conflict (red) > ability-category color > cyan fallback > unbound (muted).
 */
export function KeyboardKey({ kd, binding, conflict }: Props) {
  // The two halo pulses below animate opacity, which the root MotionConfig keeps
  // running by design — so they gate their own loop on the OS preference.
  const prefersReduced = useReducedMotion();
  const isBound = !!binding;
  const hasConflict = !!conflict;
  const categoryColor = binding ? abilityCategoryColorForAction(binding.action) : null;
  const accentColor = hasConflict ? STATUS_ERROR : (categoryColor ?? ACCENT_CYAN);

  return (
    <motion.div
      whileHover={{ scale: 1.08, y: -2 }}
      whileTap={{ scale: 0.95, y: 1 }}
      aria-label={`${kd.key}: ${binding ? (conflict ?? [binding.action]).join(' & ') : 'unbound'}`}
      className={`relative flex items-center justify-center rounded-md text-xs font-mono font-bold border cursor-default transition-all ${
        kd.widthClass ?? 'w-8'
      } h-8`}
      style={isBound ? {
        background: `linear-gradient(180deg, ${withOpacity(accentColor, OPACITY_10)} 0%, ${withOpacity(accentColor, OPACITY_5)} 100%)`,
        borderColor: withOpacity(accentColor, OPACITY_25),
        color: accentColor,
        boxShadow: `0 2px 8px ${withOpacity(accentColor, OPACITY_12)}, inset 0 1px 0 ${withOpacity(OVERLAY_WHITE, OPACITY_5)}`,
        textShadow: `${GLOW_MD} ${withOpacity(accentColor, OPACITY_37)}`,
      } : {
        background: `linear-gradient(180deg, ${withOpacity(OVERLAY_WHITE, OPACITY_5)} 0%, transparent 100%)`,
        borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8),
        color: 'var(--text-muted)',
        boxShadow: `inset 0 1px 0 ${withOpacity(OVERLAY_WHITE, OPACITY_5)}, 0 2px 4px ${withOpacity(OVERLAY_WHITE, '02')}`,
      }}
      title={binding
        ? conflict
          ? `CONFLICT: ${conflict.join(' & ')}`
          : `${binding.action} → ${binding.handler}`
        : undefined}
    >
      {hasConflict && (
        <motion.span
          className="absolute inset-0 rounded-md border-2"
          style={{ borderColor: STATUS_ERROR }}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.04, 1] }}
          transition={motionSafe({ duration: 1.5, repeat: Infinity, ease: 'easeInOut' } as const, prefersReduced)}
        />
      )}
      {isBound && !hasConflict && (
        <motion.span
          className="absolute inset-0 rounded-md border"
          style={{ borderColor: accentColor }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={motionSafe({ duration: 2.5, repeat: Infinity, ease: 'easeInOut' } as const, prefersReduced)}
        />
      )}
      {kd.label ?? kd.key}
    </motion.div>
  );
}
