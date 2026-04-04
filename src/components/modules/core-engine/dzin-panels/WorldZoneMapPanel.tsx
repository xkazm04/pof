'use client';

import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD_DARK, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_ORANGE, STATUS_ERROR } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface WorldZoneMapPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD_DARK;

const ZONES = [
  { name: 'Town', difficulty: 'Safe', color: ACCENT_EMERALD },
  { name: 'Forest', difficulty: 'Easy', color: ACCENT_EMERALD_DARK },
  { name: 'Ruins', difficulty: 'Medium', color: ACCENT_ORANGE },
  { name: 'Catacombs', difficulty: 'Hard', color: STATUS_ERROR },
  { name: 'Boss Arena', difficulty: 'Boss', color: ACCENT_CYAN },
] as const;

const WORLD_PIPELINE = ['ZoneDesign', 'Blockout', 'NavMesh', 'Spawns', 'Streaming'] as const;

const WORLD_FEATURES = [
  'Zone layout design', 'Blockout levels', 'Enemy spawn placement',
  'Interactive world objects', 'Zone transitions',
  'Environmental hazards', 'NavMesh coverage',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function ZoneMapMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <MapIcon className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{ZONES.length} zones</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ZoneMapCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ZONES.map((z) => (
        <div key={z.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: z.color }}
          />
          <span className="text-text font-medium flex-1">{z.name}</span>
          <span className="text-text-muted">{z.difficulty}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {WORLD_PIPELINE.length}-stage world pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function ZoneMapFull({ featureMap, defs }: WorldZoneMapPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        World zone architecture with {ZONES.length} zones from Town (safe) to Boss Arena,
        including blockout levels, NavMesh, spawn placement, and level streaming.
      </SurfaceCard>

      {/* Zone Grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={MapIcon} label="Zone Layout" color={ACCENT} />
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${DZIN_SPACING.full.gridGap} mt-2`}>
          {ZONES.map((z, i) => (
            <motion.div
              key={z.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-xl p-3 text-center relative overflow-hidden"
              style={{ borderColor: `${z.color}40` }}
            >
              <div className="text-xs font-mono font-bold" style={{ color: z.color }}>{z.name}</div>
              <div className="text-2xs text-text-muted mt-0.5">{z.difficulty}</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {WORLD_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="World Build Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...WORLD_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function WorldZoneMapPanel({ featureMap, defs }: WorldZoneMapPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="World Zone Map" icon={<MapIcon className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ZoneMapMicro />}
          {density === 'compact' && <ZoneMapCompact />}
          {density === 'full' && <ZoneMapFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
