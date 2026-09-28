'use client';

import { motion } from 'framer-motion';
import { Mouse } from 'lucide-react';
import {
  ACCENT_CYAN, STATUS_ERROR, OPACITY_5, OPACITY_8, OPACITY_20, OPACITY_25, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';
import type { ResolvedBindings } from '@/lib/character/input-bindings';

/** Tooltip + tint for one mouse input, from the resolved binding state. */
function mouseInput(resolved: ResolvedBindings, key: string): { title: string; color: string } {
  const conflict = resolved.conflicts.get(key);
  if (conflict) return { title: `CONFLICT: ${conflict.join(' & ')}`, color: STATUS_ERROR };
  const b = resolved.keyMap.get(key);
  if (!b) return { title: `${key}: unbound`, color: 'var(--text-muted)' };
  return { title: `${b.action} → ${b.handler}`, color: ACCENT_CYAN };
}

function MouseButton({ label, side, resolved }: { label: 'LMB' | 'RMB'; side: 'l' | 'r'; resolved: ResolvedBindings }) {
  const { title, color } = mouseInput(resolved, label);
  const tint = color === 'var(--text-muted)' ? ACCENT_CYAN : color;
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`flex-1 flex items-center justify-center border-b text-xs font-mono font-bold ${
        side === 'l' ? 'border-r rounded-tl-2xl' : 'rounded-tr-2xl'
      }`}
      style={{
        background: `linear-gradient(180deg, ${withOpacity(tint, OPACITY_8)} 0%, ${withOpacity(tint, OPACITY_5)} 100%)`,
        borderColor: withOpacity(tint, OPACITY_20),
        color,
        textShadow: `0 0 6px ${withOpacity(tint, OPACITY_30)}`,
      }}
      title={title}
    >
      {label}
    </motion.div>
  );
}

/** Mouse widget in the keyboard visualization — LMB / RMB / Look read the resolved bindings. */
export function MouseWidget({ resolved }: { resolved: ResolvedBindings }) {
  const look = mouseInput(resolved, 'Mouse');
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
          <MouseButton label="LMB" side="l" resolved={resolved} />
          <MouseButton label="RMB" side="r" resolved={resolved} />
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
          title={look.title}
        >
          Look
        </div>
      </div>
    </motion.div>
  );
}
