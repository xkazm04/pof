'use client';

import { useState } from 'react';
import { Map } from 'lucide-react';
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
import { ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_PINK } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface LevelFlowEditorPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD;

const LEVEL_ZONES = [
  { name: 'Hub Town', difficulty: 'Safe', streaming: 'Always Loaded', color: ACCENT_EMERALD },
  { name: 'Dark Forest', difficulty: 'Medium', streaming: 'Proximity', color: ACCENT_VIOLET },
  { name: 'Cursed Mines', difficulty: 'Hard', streaming: 'On-Demand', color: ACCENT_ORANGE },
  { name: 'Dragon Peak', difficulty: 'Boss', streaming: 'Pre-Load', color: ACCENT_PINK },
  { name: 'Hidden Valley', difficulty: 'Optional', streaming: 'Lazy', color: ACCENT_CYAN },
] as const;

const FLOW_RADAR: RadarDataPoint[] = [
  { axis: 'Pacing', value: 0.8 },
  { axis: 'Difficulty Arc', value: 0.7 },
  { axis: 'Streaming', value: 0.75 },
  { axis: 'Connectivity', value: 0.65 },
  { axis: 'Density', value: 0.85 },
];

const FLOW_PIPELINE = ['Zone Define', 'Difficulty Tag', 'Stream Setup', 'Flow Link', 'Validate'] as const;

const FLOW_FEATURES = [
  'Level flow graph editor', 'Difficulty arc visualization', 'Streaming zone configuration',
  'Zone connectivity map', 'Encounter density tuning', 'World partition integration',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function FlowMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Map className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{LEVEL_ZONES.length} zones</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function FlowCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {LEVEL_ZONES.map((z) => (
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
        {FLOW_PIPELINE.length}-stage flow pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function FlowFull({ featureMap, defs }: LevelFlowEditorPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Level flow editor with {LEVEL_ZONES.length} zones, difficulty arc visualization,
        streaming zone configuration, and world partition integration for seamless level transitions.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Level Zones */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Map} label="Level Zones" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {LEVEL_ZONES.map((z, i) => (
              <motion.div
                key={z.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                <span className="font-mono font-bold" style={{ color: z.color }}>{z.name}</span>
                <span className="text-text-muted ml-auto">{z.streaming}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={FLOW_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {FLOW_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Level Flow Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...FLOW_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function LevelFlowEditorPanel({ featureMap, defs }: LevelFlowEditorPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Level Flow Editor" icon={<Map className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <FlowMicro />}
          {density === 'compact' && <FlowCompact />}
          {density === 'full' && <FlowFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
