'use client';

import { Link, Timer, ArrowRightLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ComboChainPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const COMBO_CHAINS = [
  {
    name: 'Berserker Rush',
    moves: [
      { name: 'Slash', startup: 6, active: 4, recovery: 12, cancelWindow: [8, 14] },
      { name: 'Uppercut', startup: 8, active: 3, recovery: 18, cancelWindow: [10, 16] },
      { name: 'Slam', startup: 12, active: 6, recovery: 24, cancelWindow: null },
    ],
    cooldown: 3.0,
  },
  {
    name: 'Shadow Flurry',
    moves: [
      { name: 'Jab', startup: 3, active: 2, recovery: 8, cancelWindow: [4, 8] },
      { name: 'Cross', startup: 4, active: 3, recovery: 10, cancelWindow: [5, 10] },
      { name: 'Backflip', startup: 6, active: 2, recovery: 14, cancelWindow: [7, 12] },
      { name: 'Dive Kick', startup: 10, active: 5, recovery: 20, cancelWindow: null },
    ],
    cooldown: 2.5,
  },
  {
    name: 'Holy Barrage',
    moves: [
      { name: 'Smite', startup: 8, active: 4, recovery: 16, cancelWindow: [10, 18] },
      { name: 'Radiant Burst', startup: 14, active: 8, recovery: 22, cancelWindow: null },
    ],
    cooldown: 5.0,
  },
] as const;

function frameColor(segment: 'startup' | 'active' | 'recovery'): string {
  if (segment === 'startup') return STATUS_WARNING;
  if (segment === 'active') return STATUS_SUCCESS;
  return STATUS_ERROR;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function ChainMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Link className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{COMBO_CHAINS.length} chains</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ChainCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Combo Chains</span>
        <span className="font-mono text-text">{COMBO_CHAINS.length} chains</span>
      </div>
      {COMBO_CHAINS.map((chain) => (
        <div key={chain.name} className="flex items-center gap-2">
          <Link className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text-muted flex-1 truncate">{chain.name}</span>
          <span className="font-mono text-text">{chain.moves.length} moves</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ChainFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Combo chain builder with frame data visualization, cancel windows, and cooldown overlap analysis.
      </SurfaceCard>

      {/* Frame Data Bars */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Timer} label="Frame Data" color={ACCENT} />
        <div className="space-y-3 mt-2">
          {COMBO_CHAINS.map((chain, ci) => (
            <motion.div
              key={chain.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.06 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-text font-medium">{chain.name}</span>
                <span className="text-text-muted font-mono">{chain.cooldown}s cd</span>
              </div>
              {chain.moves.map((move, mi) => {
                const total = move.startup + move.active + move.recovery;
                return (
                  <div key={mi} className="mb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-text-muted w-20 truncate">{move.name}</span>
                      <span className="font-mono text-2xs text-text-muted">{total}f</span>
                    </div>
                    <div className="flex h-3 rounded overflow-hidden">
                      <div
                        className="flex items-center justify-center text-2xs text-white"
                        style={{ width: `${(move.startup / total) * 100}%`, backgroundColor: frameColor('startup') }}
                      >
                        {move.startup}
                      </div>
                      <div
                        className="flex items-center justify-center text-2xs text-white"
                        style={{ width: `${(move.active / total) * 100}%`, backgroundColor: frameColor('active') }}
                      >
                        {move.active}
                      </div>
                      <div
                        className="flex items-center justify-center text-2xs text-white"
                        style={{ width: `${(move.recovery / total) * 100}%`, backgroundColor: frameColor('recovery') }}
                      >
                        {move.recovery}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          ))}
          {/* Legend */}
          <div className="flex gap-3 text-2xs text-text-muted pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: frameColor('startup') }} /> Startup
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: frameColor('active') }} /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: frameColor('recovery') }} /> Recovery
            </span>
          </div>
        </div>
      </SurfaceCard>

      {/* Cancel Windows */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={ArrowRightLeft} label="Cancel Windows" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {COMBO_CHAINS.map((chain, ci) => (
            <motion.div
              key={chain.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.05 }}
              className="text-xs"
            >
              <span className="text-text font-medium">{chain.name}</span>
              <div className="space-y-1 mt-1">
                {chain.moves.map((move, mi) => (
                  <div key={mi} className="flex items-center gap-2">
                    <span className="text-text-muted w-20 truncate">{move.name}</span>
                    {move.cancelWindow ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-2xs font-mono"
                        style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`, color: STATUS_SUCCESS }}
                      >
                        f{move.cancelWindow[0]}-{move.cancelWindow[1]}
                      </span>
                    ) : (
                      <span
                        className="px-1.5 py-0.5 rounded text-2xs"
                        style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}`, color: STATUS_ERROR }}
                      >
                        no cancel
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Cooldown Overlap */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Link} label="Cooldown Overlap" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {COMBO_CHAINS.map((chain, i) => {
            const totalFrames = chain.moves.reduce((s, m) => s + m.startup + m.active + m.recovery, 0);
            const execTime = totalFrames / 60;
            const overlap = Math.max(0, execTime - chain.cooldown);
            return (
              <motion.div
                key={chain.name}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-text flex-1 truncate">{chain.name}</span>
                <span className="font-mono text-text-muted">{execTime.toFixed(2)}s exec</span>
                <span
                  className="px-1.5 py-0.5 rounded text-2xs font-mono"
                  style={{
                    backgroundColor: overlap > 0 ? `${STATUS_ERROR}${OPACITY_15}` : `${STATUS_SUCCESS}${OPACITY_15}`,
                    color: overlap > 0 ? STATUS_ERROR : STATUS_SUCCESS,
                  }}
                >
                  {overlap > 0 ? `+${overlap.toFixed(2)}s overlap` : 'clear'}
                </span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ComboChainPanel({ featureMap, defs }: ComboChainPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Combo Chain" icon={<Link className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ChainMicro />}
          {density === 'compact' && <ChainCompact />}
          {density === 'full' && <ChainFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
