'use client';

import { Command, Mouse } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_CYAN, OVERLAY_WHITE, STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_20, OPACITY_25, OPACITY_30, OPACITY_37,
  GLOW_SM, GLOW_MD,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../design';
import { KEYBOARD_ROWS, KEY_BINDING_MAP, KEY_CONFLICTS } from '../data';

export function KeyboardVisualization() {
  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Command} label="Input Binding Map" color={ACCENT_CYAN} />

      <div className="flex gap-6 items-start">
        {/* ── 3D Keyboard ───────────────────────────────────────────────── */}
        <div
          className="rounded-xl border border-border/20 bg-surface/30 p-4 relative"
          style={{
            perspective: '800px',
          }}
        >
          <div style={{ transform: 'rotateX(8deg)' }}>
            <div className="space-y-1.5">
              {KEYBOARD_ROWS.map((row, ri) => (
                <motion.div
                  key={ri}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ri * 0.06, duration: 0.3 }}
                  className="flex gap-1.5"
                  style={{ paddingLeft: ri === 1 ? 10 : ri === 2 ? 20 : 0 }}
                >
                  {row.map((kd) => {
                    const binding = KEY_BINDING_MAP.get(kd.key);
                    const isBound = !!binding;
                    const hasConflict = KEY_CONFLICTS.has(kd.key);
                    const accentColor = hasConflict ? STATUS_ERROR : ACCENT_CYAN;
                    return (
                      <motion.div
                        key={kd.key}
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.95, y: 1 }}
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
                          ? hasConflict
                            ? `CONFLICT: ${KEY_CONFLICTS.get(kd.key)!.join(' & ')}`
                            : `${binding.action} → ${binding.handler}`
                          : undefined}
                      >
                        {/* Conflict key — red pulse ring */}
                        {hasConflict && (
                          <motion.span
                            className="absolute inset-0 rounded-md border-2"
                            style={{ borderColor: STATUS_ERROR }}
                            animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.04, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                        {/* Active key pulse ring (non-conflict) */}
                        {isBound && !hasConflict && (
                          <motion.span
                            className="absolute inset-0 rounded-md border"
                            style={{ borderColor: ACCENT_CYAN }}
                            animate={{ opacity: [0, 0.3, 0] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                        {kd.label ?? kd.key}
                      </motion.div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Mouse Widget ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-1.5">
            <Mouse className="w-3 h-3" /> Mouse
          </div>

          {/* Mouse body */}
          <div className="relative w-[76px] rounded-2xl border border-border/30 bg-surface/30 overflow-hidden"
            style={{ height: 100 }}>
            {/* Two-button top */}
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

            {/* Scroll wheel area */}
            <div className="flex items-center justify-center py-2">
              <div className="w-3 h-5 rounded-full border"
                style={{
                  borderColor: withOpacity(ACCENT_CYAN, OPACITY_25),
                  background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_8)}, transparent)`,
                }}
              />
            </div>

            {/* Mouse body bottom - Look zone */}
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
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/15">
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="w-4 h-4 rounded-md border"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_10)}, ${withOpacity(ACCENT_CYAN, OPACITY_5)})`,
              borderColor: withOpacity(ACCENT_CYAN, OPACITY_25),
              boxShadow: `${GLOW_SM} ${withOpacity(ACCENT_CYAN, OPACITY_12)}`,
            }} />
          Bound Key
        </span>
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="w-4 h-4 rounded-md border"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(OVERLAY_WHITE, OPACITY_5)}, transparent)`,
              borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8),
            }} />
          Unbound
        </span>
        {KEY_CONFLICTS.size > 0 && (
          <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <motion.span
              className="w-4 h-4 rounded-md border-2"
              style={{ borderColor: STATUS_ERROR }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span style={{ color: STATUS_ERROR }}>{KEY_CONFLICTS.size} conflict{KEY_CONFLICTS.size > 1 ? 's' : ''}</span>
          </span>
        )}
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted ml-auto">
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: ACCENT_CYAN }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {KEY_BINDING_MAP.size} bindings active
        </span>
      </div>
    </BlueprintPanel>
  );
}
