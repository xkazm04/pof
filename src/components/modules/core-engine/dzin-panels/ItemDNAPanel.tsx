'use client';

import { Dna } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_PURPLE, ACCENT_RED, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ItemDNAPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PURPLE;

const TRAIT_AXES = [
  { axis: 'Offensive', weight: 0.8, color: ACCENT_RED },
  { axis: 'Defensive', weight: 0.5, color: ACCENT_EMERALD },
  { axis: 'Utility', weight: 0.6, color: ACCENT_CYAN },
  { axis: 'Arcane', weight: 0.9, color: ACCENT_PURPLE },
  { axis: 'Primal', weight: 0.4, color: ACCENT_ORANGE },
] as const;

const DNA_RADAR: RadarDataPoint[] = TRAIT_AXES.map((t) => ({ axis: t.axis, value: t.weight }));

const GENOME_PRESETS = [
  { name: 'Warrior', focus: 'Offensive + Defensive', color: ACCENT_RED },
  { name: 'Mage', focus: 'Arcane + Utility', color: ACCENT_PURPLE },
  { name: 'Rogue', focus: 'Offensive + Utility', color: ACCENT_EMERALD },
] as const;

const DNA_OPERATIONS = ['Roll Affixes', 'Breed Genomes', 'Evolve Traits', 'Export Code'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function DNAMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Dna className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{TRAIT_AXES.length} axes</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function DNACompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {TRAIT_AXES.map((trait) => (
        <div key={trait.axis} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: trait.color }}
          />
          <span className="text-text-muted flex-1">{trait.axis}</span>
          <div className="w-12 h-1.5 bg-surface-deep rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ backgroundColor: trait.color, width: `${trait.weight * 100}%` }} />
          </div>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {GENOME_PRESETS.length} presets
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function DNAFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Item DNA genome editor with {TRAIT_AXES.length}-axis trait system, genome breeding, evolution mechanics,
        and affix rolling weighted by trait biases.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Trait Axes */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Dna} label="Trait Axes" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {TRAIT_AXES.map((trait, i) => (
              <motion.div
                key={trait.axis}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: trait.color, boxShadow: `0 0 6px ${trait.color}40` }}
                />
                <span className="text-text font-medium w-16">{trait.axis}</span>
                <div className="flex-1 h-2 bg-surface-deep rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: trait.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${trait.weight * 100}%` }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                  />
                </div>
                <span className="font-mono text-text-muted w-8 text-right">{Math.round(trait.weight * 100)}%</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={DNA_RADAR} size={140} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Genome Presets */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Genome Presets</div>
        <div className={`grid grid-cols-3 ${DZIN_SPACING.full.gridGap}`}>
          {GENOME_PRESETS.map((preset, i) => (
            <motion.div
              key={preset.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              className="bg-surface-deep border rounded-xl p-3 text-center"
              style={{ borderColor: `${preset.color}40` }}
            >
              <Dna className="w-5 h-5 mx-auto mb-1" style={{ color: preset.color }} />
              <div className="text-xs font-mono font-bold" style={{ color: preset.color }}>{preset.name}</div>
              <div className="text-2xs text-text-muted mt-0.5">{preset.focus}</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* DNA Operations */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Operations</div>
        <div className="flex flex-wrap gap-1.5">
          {DNA_OPERATIONS.map((op) => (
            <span key={op} className="text-2xs font-mono px-2 py-1 rounded-full bg-surface-deep border border-border/40 text-text-muted">
              {op}
            </span>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemDNAPanel({ featureMap, defs }: ItemDNAPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Item DNA" icon={<Dna className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <DNAMicro />}
          {density === 'compact' && <DNACompact />}
          {density === 'full' && <DNAFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
