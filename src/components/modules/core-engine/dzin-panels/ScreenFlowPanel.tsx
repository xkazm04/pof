'use client';

import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN, ACCENT_PINK, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET, STATUS_ERROR } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import {
  FLOW_NODES,
  FLOW_EDGES,
  SM_NODES,
} from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ScreenFlowPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const SCREEN_GROUPS = [
  { name: 'Core', desc: 'Main HUD — always visible in gameplay', color: ACCENT_PINK },
  { name: 'Overlay', desc: 'Inventory, CharStats, Pause — toggled screens', color: ACCENT_CYAN },
  { name: 'Floating', desc: 'Enemy bars, damage numbers — world-space', color: ACCENT_VIOLET },
] as const;

const FLOW_PIPELINE = ['Input Event', 'Input Mode Switch', 'Widget Show/Hide', 'Focus Set', 'Render'] as const;

const SCREEN_FEATURES = [
  'Inventory screen', 'Character stats screen',
  'Pause/settings menus', 'Floating damage numbers',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function ScreenFlowMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <ArrowRightLeft className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{FLOW_NODES.length} screens</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ScreenFlowCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {SCREEN_GROUPS.map((g) => (
        <div key={g.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: g.color }}
          />
          <span className="text-text font-medium flex-1">{g.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {FLOW_EDGES.length} transitions · {SM_NODES.length} input modes
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function ScreenFlowFull({ featureMap, defs }: ScreenFlowPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Screen flow graph with {FLOW_NODES.length} screens, {FLOW_EDGES.length} transitions,
        and {SM_NODES.length} input modes (Game, UI, GameAndUI).
      </SurfaceCard>

      {/* Screen Groups */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={ArrowRightLeft} label="Screen Groups" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SCREEN_GROUPS.map((g, i) => (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="font-mono font-bold w-16" style={{ color: g.color }}>{g.name}</span>
              <span className="text-text-muted">{g.desc}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Flow nodes */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Screen Nodes" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {FLOW_NODES.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: n.color }} />
              <span className="font-mono font-medium" style={{ color: n.color }}>{n.label}</span>
              <span className="text-text-muted">({n.group})</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {SCREEN_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Screen Transition Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...FLOW_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function ScreenFlowPanel({ featureMap, defs }: ScreenFlowPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Screen Flow" icon={<ArrowRightLeft className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ScreenFlowMicro />}
          {density === 'compact' && <ScreenFlowCompact />}
          {density === 'full' && <ScreenFlowFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
