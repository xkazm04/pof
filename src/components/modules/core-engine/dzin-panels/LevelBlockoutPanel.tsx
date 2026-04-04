'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_PINK } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface LevelBlockoutPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const LEVEL_PHASES = [
  { name: 'Blockout Geometry', phase: 'Layout', color: ACCENT_ORANGE },
  { name: 'Spawn Placement', phase: 'Spawning', color: ACCENT_EMERALD },
  { name: 'Level Streaming', phase: 'Streaming', color: ACCENT_VIOLET },
  { name: 'NavMesh Config', phase: 'Navigation', color: ACCENT_CYAN },
  { name: 'PCG Procedural', phase: 'Generation', color: ACCENT_PINK },
] as const;

const LEVEL_RADAR: RadarDataPoint[] = [
  { axis: 'Layout', value: 0.75 },
  { axis: 'Streaming', value: 0.6 },
  { axis: 'Navigation', value: 0.7 },
  { axis: 'Procedural', value: 0.65 },
  { axis: 'Hazards', value: 0.5 },
];

const LEVEL_PIPELINE = ['Blockout', 'Spawns', 'Streaming', 'NavMesh', 'PCG'] as const;

const LEVEL_FEATURES = [
  'Blockout geometry', 'Spawn point placement', 'Level streaming setup',
  'Zone transition system', 'Environmental hazards', 'NavMesh configuration',
  'Procedural level generation', 'PCG graph setup', 'Procedural Vegetation (PVE)',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function LevelMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Layers className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{LEVEL_PHASES.length} phases</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function LevelCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {LEVEL_PHASES.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-text font-medium flex-1">{p.name}</span>
          <span className="text-text-muted">{p.phase}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {LEVEL_PIPELINE.length}-stage level pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function LevelFull({ featureMap, defs }: LevelBlockoutPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Level design pipeline with {LEVEL_PHASES.length} phases covering blockout geometry,
        spawn placement, world partition streaming, NavMesh, and PCG procedural generation.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Phases */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Layers} label="Level Phases" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {LEVEL_PHASES.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="font-mono font-bold" style={{ color: p.color }}>{p.name}</span>
                <span className="text-text-muted ml-auto">{p.phase}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={LEVEL_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {LEVEL_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Level Build Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...LEVEL_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function LevelBlockoutPanel({ featureMap, defs }: LevelBlockoutPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Level Blockout" icon={<Layers className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <LevelMicro />}
          {density === 'compact' && <LevelCompact />}
          {density === 'full' && <LevelFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
