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
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface WorldLevelDesignPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_VIOLET;

const LEVEL_PHASES = [
  { name: 'Greybox', desc: 'BSP/geometry blockout with scale markers', color: ACCENT_EMERALD },
  { name: 'Art Pass', desc: 'Static meshes, materials, lighting', color: ACCENT_CYAN },
  { name: 'Gameplay', desc: 'Spawns, triggers, interactables placed', color: ACCENT_ORANGE },
  { name: 'Polish', desc: 'VFX, audio, post-process, optimization', color: ACCENT_VIOLET },
] as const;

const LEVEL_PIPELINE = ['Concept', 'Greybox', 'ArtPass', 'Gameplay', 'Polish', 'Ship'] as const;

const LEVEL_FEATURES = [
  'Zone layout design', 'Blockout levels', 'Zone transitions',
  'NavMesh coverage', 'Interactive world objects',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function LevelDesignMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Layers className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{LEVEL_PHASES.length} phases</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function LevelDesignCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {LEVEL_PHASES.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-text font-medium flex-1">{p.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {LEVEL_PIPELINE.length}-stage pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function LevelDesignFull({ featureMap, defs }: WorldLevelDesignPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Level design pipeline with {LEVEL_PHASES.length} production phases from greybox through polish,
        covering blockout, art pass, gameplay placement, and optimization.
      </SurfaceCard>

      {/* Level Phases */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Layers} label="Production Phases" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {LEVEL_PHASES.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="font-mono font-bold w-16" style={{ color: p.color }}>{p.name}</span>
              <span className="text-text-muted">{p.desc}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {LEVEL_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Level Production Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...LEVEL_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function WorldLevelDesignPanel({ featureMap, defs }: WorldLevelDesignPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Level Design" icon={<Layers className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <LevelDesignMicro />}
          {density === 'compact' && <LevelDesignCompact />}
          {density === 'full' && <LevelDesignFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
