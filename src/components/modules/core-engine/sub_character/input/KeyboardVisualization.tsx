'use client';

import { Command } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_CYAN, OVERLAY_WHITE, STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_25,
  GLOW_SM, withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { KEYBOARD_ROWS, KEY_BINDING_MAP, KEY_CONFLICTS } from '../_shared/data';
import { KeyboardKey } from './KeyboardKey';
import { MouseWidget } from './MouseWidget';

export function KeyboardVisualization() {
  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Command} label="Input Binding Map" color={ACCENT_CYAN} />

      <div className="flex gap-6 items-start">
        {/* ── 3D Keyboard ───────────────────────────────────────────────── */}
        <div
          className="rounded-xl border border-border/20 bg-surface/30 p-4 relative"
          style={{ perspective: '800px' }}
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
                  {row.map((kd) => (
                    <KeyboardKey key={kd.key} kd={kd} />
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <MouseWidget />
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/15">
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span
            className="w-4 h-4 rounded-md border"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(ACCENT_CYAN, OPACITY_10)}, ${withOpacity(ACCENT_CYAN, OPACITY_5)})`,
              borderColor: withOpacity(ACCENT_CYAN, OPACITY_25),
              boxShadow: `${GLOW_SM} ${withOpacity(ACCENT_CYAN, OPACITY_12)}`,
            }}
          />
          Bound (tinted by ability category)
        </span>
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span
            className="w-4 h-4 rounded-md border"
            style={{
              background: `linear-gradient(180deg, ${withOpacity(OVERLAY_WHITE, OPACITY_5)}, transparent)`,
              borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8),
            }}
          />
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
            <span style={{ color: STATUS_ERROR }}>
              {KEY_CONFLICTS.size} conflict{KEY_CONFLICTS.size > 1 ? 's' : ''}
            </span>
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
