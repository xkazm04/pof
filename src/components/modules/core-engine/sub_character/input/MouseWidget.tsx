'use client';

import { motion } from 'framer-motion';
import { Mouse } from 'lucide-react';
import {
  ACCENT_CYAN, OPACITY_5, OPACITY_8, OPACITY_20, OPACITY_25, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';

/** Static mouse widget used in the keyboard visualization. */
export function MouseWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-1.5">
        <Mouse className="w-3 h-3" /> Mouse
      </div>

      <div
        className="relative w-[76px] rounded-2xl border border-border/30 bg-surface/30 overflow-hidden"
        style={{ height: 100 }}
      >
        <div className="flex h-12">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex-1 flex items-center justify-center border-r border-b text-xs font-mono font-bold rounded-tl-2xl"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_8)} 0%, ${withOpacity(ACCENT_CYAN, OPACITY_5)} 100%)`,
              borderColor: withOpacity(ACCENT_CYAN, OPACITY_20),
              color: ACCENT_CYAN,
              textShadow: `0 0 6px ${withOpacity(ACCENT_CYAN, OPACITY_30)}`,
            }}
            title="IA_PrimaryAttack → HandlePrimaryAttack"
          >
            LMB
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex-1 flex items-center justify-center border-b text-xs font-mono font-bold rounded-tr-2xl"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_8)} 0%, ${withOpacity(ACCENT_CYAN, OPACITY_5)} 100%)`,
              borderColor: withOpacity(ACCENT_CYAN, OPACITY_20),
              color: ACCENT_CYAN,
              textShadow: `0 0 6px ${withOpacity(ACCENT_CYAN, OPACITY_30)}`,
            }}
            title="Heavy Attack → UARPGCombatComponent::HeavyAttack"
          >
            RMB
          </motion.div>
        </div>

        <div className="flex items-center justify-center py-2">
          <div
            className="w-3 h-5 rounded-full border"
            style={{
              borderColor: withOpacity(ACCENT_CYAN, OPACITY_25),
              background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_8)}, transparent)`,
            }}
          />
        </div>

        <div
          className="flex items-center justify-center text-[9px] font-mono text-text-muted h-8 border-t"
          style={{
            borderColor: withOpacity(ACCENT_CYAN, OPACITY_8),
            backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_5),
          }}
          title="IA_Look → HandleLook"
        >
          Look
        </div>
      </div>
    </motion.div>
  );
}
