'use client';

import { Command, Mouse } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN, OVERLAY_WHITE } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { KEYBOARD_ROWS, KEY_BINDING_MAP } from './data';

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
                    return (
                      <motion.div
                        key={kd.key}
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.95, y: 1 }}
                        className={`relative flex items-center justify-center rounded-md text-xs font-mono font-bold border cursor-default transition-all ${
                          kd.widthClass ?? 'w-8'
                        } h-8`}
                        style={isBound ? {
                          background: `linear-gradient(180deg, ${ACCENT_CYAN}18 0%, ${ACCENT_CYAN}08 100%)`,
                          borderColor: `${ACCENT_CYAN}40`,
                          color: ACCENT_CYAN,
                          boxShadow: `0 2px 8px ${ACCENT_CYAN}20, inset 0 1px 0 ${OVERLAY_WHITE}08`,
                          textShadow: `0 0 8px ${ACCENT_CYAN}60`,
                        } : {
                          background: `linear-gradient(180deg, ${OVERLAY_WHITE}06 0%, transparent 100%)`,
                          borderColor: `${OVERLAY_WHITE}10`,
                          color: 'var(--text-muted)',
                          boxShadow: `inset 0 1px 0 ${OVERLAY_WHITE}04, 0 2px 4px ${OVERLAY_WHITE}02`,
                        }}
                        title={binding ? `${binding.action} → ${binding.handler}` : undefined}
                      >
                        {/* Active key pulse ring */}
                        {isBound && (
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
                  background: `linear-gradient(180deg, ${ACCENT_CYAN}15 0%, ${ACCENT_CYAN}05 100%)`,
                  borderColor: `${ACCENT_CYAN}30`,
                  color: ACCENT_CYAN,
                  textShadow: `0 0 6px ${ACCENT_CYAN}50`,
                }}
                title="IA_PrimaryAttack → HandlePrimaryAttack"
              >
                LMB
              </motion.div>
              <div
                className="flex-1 flex items-center justify-center border-b text-xs font-mono font-bold rounded-tr-2xl"
                style={{
                  borderColor: `${OVERLAY_WHITE}08`,
                  color: 'var(--text-muted)',
                }}
                title="Unbound"
              >
                RMB
              </div>
            </div>

            {/* Scroll wheel area */}
            <div className="flex items-center justify-center py-2">
              <div className="w-3 h-5 rounded-full border"
                style={{
                  borderColor: `${ACCENT_CYAN}40`,
                  background: `linear-gradient(180deg, ${ACCENT_CYAN}10, transparent)`,
                }}
              />
            </div>

            {/* Mouse body bottom - Look zone */}
            <div
              className="flex items-center justify-center text-[9px] font-mono text-text-muted h-8 border-t"
              style={{
                borderColor: `${ACCENT_CYAN}15`,
                backgroundColor: `${ACCENT_CYAN}05`,
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
              background: `linear-gradient(180deg, ${ACCENT_CYAN}18, ${ACCENT_CYAN}08)`,
              borderColor: `${ACCENT_CYAN}40`,
              boxShadow: `0 0 4px ${ACCENT_CYAN}20`,
            }} />
          Bound Key
        </span>
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="w-4 h-4 rounded-md border"
            style={{
              background: `linear-gradient(180deg, ${OVERLAY_WHITE}06, transparent)`,
              borderColor: `${OVERLAY_WHITE}10`,
            }} />
          Unbound
        </span>
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
