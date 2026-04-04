'use client';

import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import {
  SM_EDGES,
  ANIM_CATALOG,
  A11Y_CATEGORIES,
  A11Y_OVERALL_GRADE,
} from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface MenuFlowPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const MENU_SCREENS = [
  { name: 'Main Menu', desc: 'Title screen — New Game, Continue, Settings, Quit', color: ACCENT_ORANGE },
  { name: 'Pause Menu', desc: 'In-game pause overlay — Resume, Settings, Quit', color: ACCENT_PINK },
  { name: 'Settings', desc: 'Graphics, Audio, Controls, Accessibility', color: ACCENT_CYAN },
  { name: 'Game Over', desc: 'Death screen with respawn/load options', color: ACCENT_VIOLET },
  { name: 'Loading', desc: 'Async level load with progress bar and tips', color: ACCENT_EMERALD },
] as const;

const MENU_PIPELINE = ['Input Capture', 'Menu Stack Push', 'Animate In', 'User Action', 'Animate Out', 'Stack Pop'] as const;

const MENU_FEATURES = [
  'Pause/settings menus', 'Inventory screen',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function MenuFlowMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <LayoutGrid className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{MENU_SCREENS.length} menus</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MenuFlowCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {MENU_SCREENS.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: m.color }}
          />
          <span className="text-text font-medium flex-1">{m.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {ANIM_CATALOG.length} transitions · A11Y: {A11Y_OVERALL_GRADE}
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function MenuFlowFull({ featureMap, defs }: MenuFlowPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Menu flow system with {MENU_SCREENS.length} screens, {SM_EDGES.length} input-mode transitions,
        {ANIM_CATALOG.length} widget animations, and accessibility grade {A11Y_OVERALL_GRADE}.
      </SurfaceCard>

      {/* Menu Screens */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={LayoutGrid} label="Menu Screens" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {MENU_SCREENS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
              <span className="font-mono font-bold w-20" style={{ color: m.color }}>{m.name}</span>
              <span className="text-text-muted">{m.desc}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Accessibility */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Accessibility Audit" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {A11Y_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="font-mono w-32">{cat.name}</span>
              <span className="font-bold" style={{ color: cat.color }}>{cat.grade}</span>
              <span className="text-text-muted">{cat.issues} issues</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {MENU_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Menu Stack Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...MENU_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function MenuFlowPanel({ featureMap, defs }: MenuFlowPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Menu Flow" icon={<LayoutGrid className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MenuFlowMicro />}
          {density === 'compact' && <MenuFlowCompact />}
          {density === 'full' && <MenuFlowFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
