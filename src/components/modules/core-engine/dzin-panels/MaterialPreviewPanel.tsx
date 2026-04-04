'use client';

import { useState } from 'react';
import { Paintbrush } from 'lucide-react';
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
import { ACCENT_PURPLE, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_PINK } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface MaterialPreviewPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PURPLE;

const MATERIAL_LAYERS = [
  { name: 'Master Material', type: 'Root Shader', switches: 3, color: ACCENT_VIOLET },
  { name: 'Dynamic Instances', type: 'Runtime MPC', switches: 5, color: ACCENT_ORANGE },
  { name: 'Post-Process Chain', type: 'Effects', switches: 4, color: ACCENT_PINK },
  { name: 'Substrate Slab', type: 'PBR Unified', switches: 6, color: ACCENT_CYAN },
] as const;

const MATERIAL_RADAR: RadarDataPoint[] = [
  { axis: 'Complexity', value: 0.7 },
  { axis: 'Performance', value: 0.6 },
  { axis: 'Flexibility', value: 0.8 },
  { axis: 'Reusability', value: 0.75 },
  { axis: 'Visual Quality', value: 0.85 },
];

const MAT_PIPELINE = ['Master', 'Instances', 'MPC', 'Functions', 'PostProcess'] as const;

const MATERIAL_FEATURES = [
  'Master material', 'Dynamic material instances', 'Material Parameter Collection',
  'Material functions library', 'Post-process materials', 'HLSL custom nodes',
  'Material layer system', 'Substrate shading models',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function MaterialMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Paintbrush className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{MATERIAL_LAYERS.length} layers</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MaterialCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {MATERIAL_LAYERS.map((l) => (
        <div key={l.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: l.color }}
          />
          <span className="text-text font-medium flex-1">{l.name}</span>
          <span className="text-text-muted">{l.type}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {MAT_PIPELINE.length}-stage material pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function MaterialFull({ featureMap, defs }: MaterialPreviewPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Material system with {MATERIAL_LAYERS.length} layer types, master material with switch parameters,
        dynamic instances, MPC global params, and Substrate unified shading.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Layers */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Paintbrush} label="Material Layers" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {MATERIAL_LAYERS.map((l, i) => (
              <motion.div
                key={l.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                <span className="font-mono font-bold" style={{ color: l.color }}>{l.name}</span>
                <span className="text-text-muted ml-auto">{l.switches} switches</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={MATERIAL_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {MATERIAL_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Material Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...MAT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function MaterialPreviewPanel({ featureMap, defs }: MaterialPreviewPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Material Preview" icon={<Paintbrush className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MaterialMicro />}
          {density === 'compact' && <MaterialCompact />}
          {density === 'full' && <MaterialFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
