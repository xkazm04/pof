'use client';

import { useState } from 'react';
import { Box } from 'lucide-react';
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
import { ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_PINK } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ModelAssetsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_VIOLET;

const ASSET_TYPES = [
  { name: 'Static Meshes', format: 'FBX/glTF', count: 'LOD + Nanite', color: ACCENT_VIOLET },
  { name: 'Skeletal Meshes', format: 'FBX', count: 'Physics + Retarget', color: ACCENT_ORANGE },
  { name: 'Collision Hulls', format: 'UCX Convex', count: 'Simple/Complex', color: ACCENT_CYAN },
  { name: 'Procedural Meshes', format: 'Runtime', count: 'Vertex/Tri/UV', color: ACCENT_EMERALD },
  { name: 'Data Registries', format: 'DataTable', count: 'FDataTableRowHandle', color: ACCENT_PINK },
] as const;

const ASSET_RADAR: RadarDataPoint[] = [
  { axis: 'Import', value: 0.8 },
  { axis: 'LOD', value: 0.7 },
  { axis: 'Collision', value: 0.6 },
  { axis: 'Nanite', value: 0.75 },
  { axis: 'Registry', value: 0.5 },
];

const ASSET_PIPELINE = ['Import', 'LOD Gen', 'Collision', 'Nanite', 'Registry'] as const;

const MODEL_FEATURES = [
  'Static mesh import pipeline', 'LOD generation', 'Collision setup',
  'Nanite mesh enabling', 'Nanite Foliage setup', 'Data Table mesh registry',
  'Procedural mesh generation', 'Skeletal mesh import',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function AssetMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Box className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{ASSET_TYPES.length} types</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function AssetCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ASSET_TYPES.map((a) => (
        <div key={a.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-text font-medium flex-1">{a.name}</span>
          <span className="text-text-muted">{a.format}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {ASSET_PIPELINE.length}-stage asset pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function AssetFull({ featureMap, defs }: ModelAssetsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Asset inventory with {ASSET_TYPES.length} categories covering static/skeletal mesh import,
        LOD generation, Nanite optimization, collision setup, and data table registries.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Asset Types */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Box} label="Asset Types" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {ASSET_TYPES.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="font-mono font-bold" style={{ color: a.color }}>{a.name}</span>
                <span className="text-text-muted ml-auto">{a.count}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={ASSET_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {MODEL_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Asset Import Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...ASSET_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function ModelAssetsPanel({ featureMap, defs }: ModelAssetsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Model Assets" icon={<Box className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <AssetMicro />}
          {density === 'compact' && <AssetCompact />}
          {density === 'full' && <AssetFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
