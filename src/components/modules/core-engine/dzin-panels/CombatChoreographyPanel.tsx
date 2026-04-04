'use client';

import { Swords, Clock, MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface CombatChoreographyPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const CHOREOGRAPHY_SEQUENCES = [
  {
    name: 'Boss Intro Slam',
    phases: [
      { name: 'Wind-up', duration: 1.2, actors: ['Boss'] },
      { name: 'Leap', duration: 0.8, actors: ['Boss'] },
      { name: 'Impact', duration: 0.3, actors: ['Boss', 'VFX_Ground'] },
      { name: 'Recovery', duration: 2.0, actors: ['Boss'] },
    ],
  },
  {
    name: 'Parry Counter',
    phases: [
      { name: 'Enemy Attack', duration: 0.6, actors: ['Enemy'] },
      { name: 'Player Parry', duration: 0.2, actors: ['Player'] },
      { name: 'Stagger', duration: 1.0, actors: ['Enemy'] },
      { name: 'Riposte', duration: 0.5, actors: ['Player'] },
    ],
  },
  {
    name: 'Multi-target Sweep',
    phases: [
      { name: 'Charge', duration: 0.8, actors: ['Player'] },
      { name: 'Sweep Arc', duration: 0.4, actors: ['Player', 'VFX_Slash'] },
      { name: 'Hit React', duration: 0.6, actors: ['Enemy_A', 'Enemy_B', 'Enemy_C'] },
    ],
  },
] as const;

const SPATIAL_ZONES = [
  { id: 'A1', label: 'Melee', occupied: true },
  { id: 'A2', label: 'Flank-L', occupied: false },
  { id: 'A3', label: 'Flank-R', occupied: true },
  { id: 'B1', label: 'Mid', occupied: false },
  { id: 'B2', label: 'Center', occupied: true },
  { id: 'B3', label: 'Ranged', occupied: false },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function ChoreographyMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Swords className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{CHOREOGRAPHY_SEQUENCES.length} sequences</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ChoreographyCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Choreography Sequences</span>
        <span className="font-mono text-text">{CHOREOGRAPHY_SEQUENCES.length} total</span>
      </div>
      {CHOREOGRAPHY_SEQUENCES.map((seq) => (
        <div key={seq.name} className="flex items-center gap-2">
          <Swords className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text-muted flex-1 truncate">{seq.name}</span>
          <span className="font-mono text-text">{seq.phases.length} phases</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ChoreographyFull() {
  const totalDuration = (phases: readonly { duration: number }[]) =>
    phases.reduce((s, p) => s + p.duration, 0).toFixed(1);

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Choreography editor for combat encounters with spatial grids, phase timelines, and actor assignments.
      </SurfaceCard>

      {/* Timeline Phases */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Clock} label="Timeline Phases" color={ACCENT} />
        <div className="space-y-3 mt-2">
          {CHOREOGRAPHY_SEQUENCES.map((seq, si) => (
            <motion.div
              key={seq.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.06 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-text font-medium">{seq.name}</span>
                <span className="text-text-muted font-mono">{totalDuration(seq.phases)}s total</span>
              </div>
              <div className="flex gap-0.5 h-5 rounded overflow-hidden">
                {seq.phases.map((phase, pi) => {
                  const total = seq.phases.reduce((s, p) => s + p.duration, 0);
                  const pct = (phase.duration / total) * 100;
                  return (
                    <div
                      key={pi}
                      className="flex items-center justify-center text-2xs text-white truncate"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pi % 2 === 0 ? ACCENT : STATUS_WARNING,
                        opacity: 0.8 + pi * 0.05,
                      }}
                      title={`${phase.name} (${phase.duration}s)`}
                    >
                      {phase.name}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Spatial Zone Grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={MapPin} label="Spatial Zones" color={ACCENT} />
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {SPATIAL_ZONES.map((zone, i) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className="flex flex-col items-center justify-center rounded p-2 text-xs"
              style={{
                backgroundColor: zone.occupied ? `${STATUS_SUCCESS}${OPACITY_15}` : `${ACCENT}${OPACITY_15}`,
                borderLeft: zone.occupied ? `2px solid ${STATUS_SUCCESS}` : `2px solid transparent`,
              }}
            >
              <span className="font-mono text-2xs text-text-muted">{zone.id}</span>
              <span className="text-text">{zone.label}</span>
              {zone.occupied && (
                <span className="text-2xs mt-0.5" style={{ color: STATUS_SUCCESS }}>occupied</span>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Actor Assignments */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Swords} label="Actor Assignments" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {CHOREOGRAPHY_SEQUENCES.map((seq, si) => (
            <motion.div
              key={seq.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.05 }}
              className="text-xs"
            >
              <span className="text-text font-medium">{seq.name}</span>
              <div className="flex gap-1 flex-wrap mt-1">
                {[...new Set(seq.phases.flatMap((p) => p.actors))].map((actor) => (
                  <span
                    key={actor}
                    className="px-1.5 py-0.5 rounded text-2xs"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CombatChoreographyPanel({ featureMap, defs }: CombatChoreographyPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Combat Choreography" icon={<Swords className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ChoreographyMicro />}
          {density === 'compact' && <ChoreographyCompact />}
          {density === 'full' && <ChoreographyFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
