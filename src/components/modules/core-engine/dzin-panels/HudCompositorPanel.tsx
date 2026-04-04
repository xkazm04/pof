'use client';

import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_PINK, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import {
  HUD_CONTEXTS,
  WIDGET_PLACEMENTS,
} from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface HudCompositorPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PINK;

const HUD_LAYERS = [
  { name: 'HUD', desc: 'Health/mana bars, ability hotbar, minimap', color: ACCENT_PINK },
  { name: 'Floating', desc: 'Enemy health bars, damage numbers', color: ACCENT_VIOLET },
  { name: 'Overlay', desc: 'Inventory, character stats, quest tracker', color: ACCENT_CYAN },
  { name: 'Modal', desc: 'Pause menu, settings, confirm dialogs', color: ACCENT_ORANGE },
] as const;

const HUD_PIPELINE = ['Widget Create', 'Bind Data', 'Layout', 'Render', 'Update'] as const;

const HUD_FEATURES = [
  'Main HUD widget', 'GAS attribute binding', 'Enemy health bars',
  'Ability cooldown UI', 'Floating damage numbers',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function HudMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Monitor className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{WIDGET_PLACEMENTS.length} widgets</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function HudCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {HUD_LAYERS.map((l) => (
        <div key={l.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: l.color }}
          />
          <span className="text-text font-medium flex-1">{l.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {HUD_CONTEXTS.length} context modes
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function HudFull({ featureMap, defs }: HudCompositorPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        HUD compositor with {HUD_LAYERS.length} z-layers, {WIDGET_PLACEMENTS.length} widget placements,
        and {HUD_CONTEXTS.length} context modes (Combat, Exploration, Dialogue, Death).
      </SurfaceCard>

      {/* Z-Layers */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Monitor} label="HUD Z-Layers" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {HUD_LAYERS.map((l, i) => (
            <motion.div
              key={l.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
              <span className="font-mono font-bold w-16" style={{ color: l.color }}>{l.name}</span>
              <span className="text-text-muted">{l.desc}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {HUD_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="HUD Render Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...HUD_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function HudCompositorPanel({ featureMap, defs }: HudCompositorPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="HUD Compositor" icon={<Monitor className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <HudMicro />}
          {density === 'compact' && <HudCompact />}
          {density === 'full' && <HudFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
