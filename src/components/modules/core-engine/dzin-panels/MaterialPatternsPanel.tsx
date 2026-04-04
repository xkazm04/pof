'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
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

export interface MaterialPatternsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PURPLE;

const PATTERN_CATALOG = [
  { name: 'Procedural Noise', style: 'Organic', variants: 8, color: ACCENT_PURPLE },
  { name: 'Tiling Brick', style: 'Architectural', variants: 12, color: ACCENT_ORANGE },
  { name: 'Fabric Weave', style: 'Textile', variants: 6, color: ACCENT_VIOLET },
  { name: 'Metal Brushed', style: 'Industrial', variants: 10, color: ACCENT_CYAN },
  { name: 'Stone Mosaic', style: 'Natural', variants: 7, color: ACCENT_PINK },
] as const;

const PATTERN_RADAR: RadarDataPoint[] = [
  { axis: 'Tileability', value: 0.9 },
  { axis: 'Detail', value: 0.75 },
  { axis: 'Performance', value: 0.7 },
  { axis: 'Variation', value: 0.8 },
  { axis: 'Style Transfer', value: 0.65 },
];

const PATTERN_PIPELINE = ['Source', 'Parameterize', 'Transfer', 'Tile Check', 'Export'] as const;

const PATTERN_FEATURES = [
  'Pattern catalog browser', 'Style transfer engine', 'Procedural generation',
  'Tileability validator', 'Variant management', 'Material function export',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function PatternMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Palette className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{PATTERN_CATALOG.length} patterns</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PatternCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {PATTERN_CATALOG.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-text font-medium flex-1">{p.name}</span>
          <span className="text-text-muted">{p.variants} variants</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {PATTERN_PIPELINE.length}-stage pattern pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function PatternFull({ featureMap, defs }: MaterialPatternsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Material pattern catalog with {PATTERN_CATALOG.length} pattern families totalling{' '}
        {PATTERN_CATALOG.reduce((s, p) => s + p.variants, 0)} variants, style transfer engine,
        tileability validation, and procedural generation tools.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Pattern Catalog */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Palette} label="Pattern Catalog" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {PATTERN_CATALOG.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="font-mono font-bold" style={{ color: p.color }}>{p.name}</span>
                <span className="text-text-muted ml-auto">{p.style} · {p.variants}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={PATTERN_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {PATTERN_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Pattern Creation Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...PATTERN_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function MaterialPatternsPanel({ featureMap, defs }: MaterialPatternsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Material Patterns" icon={<Palette className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PatternMicro />}
          {density === 'compact' && <PatternCompact />}
          {density === 'full' && <PatternFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
