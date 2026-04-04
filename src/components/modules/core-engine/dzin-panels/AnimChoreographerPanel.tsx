'use client';

import { useState } from 'react';
import { Swords } from 'lucide-react';
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

export interface AnimChoreographerPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_VIOLET;

const COMBO_CHAINS = [
  { name: 'Light Chain', steps: 4, branch: 'Heavy Finisher', color: ACCENT_VIOLET },
  { name: 'Heavy Chain', steps: 3, branch: 'Launch Kick', color: ACCENT_ORANGE },
  { name: 'Aerial Chain', steps: 3, branch: 'Slam', color: ACCENT_CYAN },
  { name: 'Dodge Cancel', steps: 2, branch: 'Counter', color: ACCENT_EMERALD },
  { name: 'Spell Weave', steps: 5, branch: 'Ultimate', color: ACCENT_PINK },
] as const;

const CHOREO_RADAR: RadarDataPoint[] = [
  { axis: 'Responsiveness', value: 0.85 },
  { axis: 'Combo Depth', value: 0.75 },
  { axis: 'Cancel Windows', value: 0.7 },
  { axis: 'AI Readability', value: 0.6 },
  { axis: 'Visual Feedback', value: 0.8 },
];

const CHOREO_PIPELINE = ['Input Buffer', 'State Check', 'Montage Select', 'Notify Fire', 'Blend Out'] as const;

const CHOREO_FEATURES = [
  'Combo graph editor', 'AI choreographer suggestions', 'State machine transitions',
  'Cancel window configuration', 'Montage section linking', 'Hit-confirm branching',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function ChoreoMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Swords className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{COMBO_CHAINS.length} chains</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ChoreoCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {COMBO_CHAINS.map((c) => (
        <div key={c.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: c.color }}
          />
          <span className="text-text font-medium flex-1">{c.name}</span>
          <span className="text-text-muted">{c.steps} steps</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {CHOREO_PIPELINE.length}-stage combo pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function ChoreoFull({ featureMap, defs }: AnimChoreographerPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        AI combo choreographer with {COMBO_CHAINS.length} chain types, state machine editor for
        transitions, cancel window tuning, and hit-confirm branching logic.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Combo Chains */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Swords} label="Combo Chains" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {COMBO_CHAINS.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span className="font-mono font-bold" style={{ color: c.color }}>{c.name}</span>
                <span className="text-text-muted ml-auto">{c.branch}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={CHOREO_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {CHOREO_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Combo Execution Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...CHOREO_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AnimChoreographerPanel({ featureMap, defs }: AnimChoreographerPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Anim Choreographer" icon={<Swords className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ChoreoMicro />}
          {density === 'compact' && <ChoreoCompact />}
          {density === 'full' && <ChoreoFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
