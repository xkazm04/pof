'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
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
import { ACCENT_PINK, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface VfxParticlesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PINK;

const VFX_CATEGORIES = [
  { name: 'Niagara Systems', role: 'Core Emitters', color: ACCENT_PINK },
  { name: 'GPU Particles', role: 'Compute Sim', color: ACCENT_ORANGE },
  { name: 'Mesh Particles', role: 'Mesh Emitter', color: ACCENT_VIOLET },
  { name: 'Ribbon Trails', role: 'Trail Renderer', color: ACCENT_CYAN },
  { name: 'Event Handlers', role: 'Spawn/Death', color: ACCENT_EMERALD },
] as const;

const VFX_RADAR: RadarDataPoint[] = [
  { axis: 'Emitters', value: 0.8 },
  { axis: 'GPU Sim', value: 0.7 },
  { axis: 'Trails', value: 0.6 },
  { axis: 'Pooling', value: 0.55 },
  { axis: 'LOD', value: 0.65 },
];

const VFX_PIPELINE = ['Spawn', 'Simulate', 'Render', 'LOD', 'Pool'] as const;

const VFX_FEATURES = [
  'Niagara system setup', 'GPU particle simulation', 'Mesh particle emitters',
  'Ribbon and trail renderers', 'Niagara event handlers', 'VFX LOD and scalability',
  'Particle pooling system', 'Niagara data interfaces',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function VfxMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Sparkles className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{VFX_CATEGORIES.length} types</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function VfxCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {VFX_CATEGORIES.map((c) => (
        <div key={c.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: c.color }}
          />
          <span className="text-text font-medium flex-1">{c.name}</span>
          <span className="text-text-muted">{c.role}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {VFX_PIPELINE.length}-stage VFX pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function VfxFull({ featureMap, defs }: VfxParticlesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Niagara VFX system with {VFX_CATEGORIES.length} categories covering GPU particle simulation,
        mesh emitters, ribbon trails, event-driven spawning, and scalability LOD.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Categories */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Sparkles} label="VFX Categories" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {VFX_CATEGORIES.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span className="font-mono font-bold" style={{ color: c.color }}>{c.name}</span>
                <span className="text-text-muted ml-auto">{c.role}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={VFX_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {VFX_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="VFX Render Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...VFX_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function VfxParticlesPanel({ featureMap, defs }: VfxParticlesPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="VFX Particles" icon={<Sparkles className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <VfxMicro />}
          {density === 'compact' && <VfxCompact />}
          {density === 'full' && <VfxFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
