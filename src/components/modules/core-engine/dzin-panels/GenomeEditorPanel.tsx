'use client';

import { Dna, TrendingUp, Sliders } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, ACCENT_VIOLET, ACCENT_EMERALD, OPACITY_15 } from '@/lib/chart-colors';

/* -- Props ----------------------------------------------------------------- */

export interface GenomeEditorPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants -------------------------------------------------------------- */

const ACCENT = MODULE_COLORS.core;

const GENOME_TRAITS = [
  { name: 'Strength', base: 14, growthRate: 1.8, cap: 99, color: STATUS_WARNING },
  { name: 'Agility', base: 12, growthRate: 2.1, cap: 99, color: STATUS_SUCCESS },
  { name: 'Intellect', base: 16, growthRate: 1.5, cap: 99, color: STATUS_INFO },
  { name: 'Endurance', base: 18, growthRate: 1.2, cap: 99, color: ACCENT_EMERALD },
  { name: 'Luck', base: 8, growthRate: 0.6, cap: 50, color: ACCENT_VIOLET },
] as const;

const POWER_LEVELS = [
  { level: 1, power: 42 },
  { level: 10, power: 120 },
  { level: 25, power: 310 },
  { level: 50, power: 680 },
  { level: 99, power: 1420 },
] as const;

const SIM_STATUS = {
  state: 'Idle' as const,
  lastRun: 'Level 50 projection',
  predictedPower: 680,
  balanceRating: 'B+',
} as const;

/* -- Micro density --------------------------------------------------------- */

function GenomeMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Dna className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{GENOME_TRAITS.length} traits</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function GenomeCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Genome Traits</span>
        <span className="font-mono text-text">{GENOME_TRAITS.length} traits</span>
      </div>
      {GENOME_TRAITS.map((t) => {
        const pct = (t.base / t.cap) * 100;
        return (
          <div key={t.name} className="flex items-center gap-2">
            <span className="text-text-muted flex-1 truncate">{t.name}</span>
            <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: `${t.color}${OPACITY_15}` }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} />
            </div>
            <span className="font-mono text-text w-6 text-right">{t.base}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function GenomeFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Character genome editor with base stats, growth curves, power projections, and live simulation.
      </SurfaceCard>

      {/* Trait Cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Dna} label="Trait Genome" color={ACCENT} />
        <div className="space-y-2.5 mt-2">
          {GENOME_TRAITS.map((trait, i) => {
            const pct = (trait.base / trait.cap) * 100;
            return (
              <motion.div
                key={trait.name}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text font-medium">{trait.name}</span>
                  <span className="text-text-muted font-mono">
                    {trait.base} / {trait.cap}
                    <span className="ml-2" style={{ color: trait.color }}>+{trait.growthRate}/lvl</span>
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ backgroundColor: `${trait.color}${OPACITY_15}` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: trait.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Power Curve */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={TrendingUp} label="Power Curve" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {POWER_LEVELS.map((pl, i) => {
            const maxPower = POWER_LEVELS[POWER_LEVELS.length - 1].power;
            const pct = (pl.power / maxPower) * 100;
            return (
              <motion.div
                key={pl.level}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-text-muted w-10 font-mono">Lv.{pl.level}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: `${ACCENT}${OPACITY_15}` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: ACCENT }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04 }}
                  />
                </div>
                <span className="font-mono text-text w-12 text-right">{pl.power}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Simulation Controls */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Sliders} label="Simulation" color={ACCENT} />
        <div className="space-y-1.5 mt-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Status</span>
            <span className="font-mono text-text">{SIM_STATUS.state}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Last Run</span>
            <span className="font-mono text-text">{SIM_STATUS.lastRun}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Predicted Power</span>
            <span className="font-mono text-text">{SIM_STATUS.predictedPower}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Balance Rating</span>
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`, color: STATUS_SUCCESS }}
            >
              {SIM_STATUS.balanceRating}
            </span>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GenomeEditorPanel({ featureMap, defs }: GenomeEditorPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Genome Editor" icon={<Dna className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <GenomeMicro />}
          {density === 'compact' && <GenomeCompact />}
          {density === 'full' && <GenomeFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
