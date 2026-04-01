'use client';

import { Layers, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_RED, ACCENT_ORANGE, MODULE_COLORS, ACCENT_GREEN, ACCENT_PURPLE_BOLD,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface LoadoutPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

interface LoadoutEntry { slot: number; ability: string; color: string }

const OPTIMAL_LOADOUT: LoadoutEntry[] = [
  { slot: 1, ability: 'MeleeAttack', color: ACCENT_RED },
  { slot: 2, ability: 'Fireball', color: ACCENT_ORANGE },
  { slot: 3, ability: 'FrostNova', color: MODULE_COLORS.core },
  { slot: 4, ability: 'Dodge', color: ACCENT_GREEN },
];

const LOADOUT_RADAR: RadarDataPoint[] = [
  { axis: 'Coverage', value: 0.85 },
  { axis: 'Synergy', value: 0.7 },
  { axis: 'DPS', value: 0.9 },
  { axis: 'Burst', value: 0.75 },
  { axis: 'Utility', value: 0.6 },
];

const LOADOUT_SCORE = 78;

const ALTERNATIVE_LOADOUTS = [
  { name: 'Burst DPS', abilities: ['MeleeAttack', 'Fireball', 'Fireball', 'Dodge'], score: 72 },
  { name: 'Control', abilities: ['FrostNova', 'FrostNova', 'Dodge', 'Dodge'], score: 65 },
  { name: 'Balanced', abilities: ['MeleeAttack', 'Fireball', 'Dodge', 'Dodge'], score: 74 },
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function LoadoutMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Layers className="w-5 h-5" style={{ color: ACCENT_PURPLE_BOLD }} />
      <span className="font-mono text-xs">{OPTIMAL_LOADOUT.length} slots</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function LoadoutCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {OPTIMAL_LOADOUT.map((slot) => (
        <div key={slot.slot} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: slot.color }}
          />
          <span className="text-text-muted text-xs">Slot {slot.slot}</span>
          <span className="font-mono font-medium text-text">{slot.ability}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted font-mono`}>
        Score: {LOADOUT_SCORE}
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function LoadoutFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Layers} label="Ability Loadout Optimizer" color="#a855f7" />
        <p className={`text-xs text-text-muted mt-1 ${DZIN_SPACING.full.sectionMb}`}>
          Optimal ability loadout for 4 slots, scored on coverage, synergy, DPS, burst, and utility.
        </p>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
          {/* Loadout slots */}
          <div className={DZIN_SPACING.full.wrapper}>
            <div className="text-xs font-bold uppercase text-text-muted mb-2">Optimal Loadout</div>
            <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap}`}>
              {OPTIMAL_LOADOUT.map((slot, i) => (
                <motion.div
                  key={slot.slot}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  className="bg-surface-deep border rounded-xl p-3 text-center relative overflow-hidden group"
                  style={{ borderColor: `${slot.color}40` }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${slot.color}10, transparent 70%)` }}
                  />
                  <div className="text-xs font-mono text-text-muted mb-1">Slot {slot.slot}</div>
                  <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-1.5"
                    style={{ backgroundColor: `${slot.color}20`, border: `1.5px solid ${slot.color}50` }}
                  >
                    <Sparkles className="w-5 h-5" style={{ color: slot.color }} />
                  </div>
                  <div className="text-xs font-mono font-bold" style={{ color: slot.color }}>{slot.ability}</div>
                </motion.div>
              ))}
            </div>

            {/* Loadout score */}
            <SurfaceCard level={3} className={DZIN_SPACING.full.card}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-text-muted">Loadout Score</div>
                <div className="text-xl font-mono font-bold text-purple-400" style={{ textShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
                  {LOADOUT_SCORE}/100
                </div>
              </div>
            </SurfaceCard>
          </div>

          {/* Radar + alternatives */}
          <div className={DZIN_SPACING.full.wrapper}>
            <div className="flex justify-center">
              <RadarChart data={LOADOUT_RADAR} size={140} accent="#a855f7" />
            </div>

            {/* Alternative loadouts */}
            <div className="text-xs font-bold uppercase text-text-muted mb-2">Alternative Loadouts</div>
            <div className="space-y-2">
              {ALTERNATIVE_LOADOUTS.map((alt, i) => (
                <motion.div
                  key={alt.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-xs bg-surface-deep/50 p-2.5 rounded-lg border border-border/40"
                >
                  <span className="font-mono font-bold text-text w-20 flex-shrink-0">{alt.name}</span>
                  <div className="flex gap-1 flex-1">
                    {alt.abilities.map((ab, ai) => (
                      <span key={ai} className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface border border-border/40 text-text-muted truncate">
                        {ab}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono font-bold text-text-muted flex-shrink-0">{alt.score}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main LoadoutPanel ─────────────────────────────────────────────────── */

export function LoadoutPanel({ featureMap: _featureMap, defs: _defs }: LoadoutPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Loadout" icon={<Layers className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <LoadoutMicro />}
          {density === 'compact' && <LoadoutCompact />}
          {density === 'full' && <LoadoutFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
