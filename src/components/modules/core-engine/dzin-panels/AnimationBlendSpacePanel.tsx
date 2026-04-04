'use client';

import { useState } from 'react';
import { Blend } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AnimationBlendSpacePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_VIOLET;

interface BlendSample {
  name: string;
  paramValue: number;
  color: string;
}

const BLEND_SAMPLES: BlendSample[] = [
  { name: 'Idle', paramValue: 0, color: ACCENT_CYAN },
  { name: 'Walk', paramValue: 200, color: ACCENT_EMERALD },
  { name: 'Run', paramValue: 400, color: ACCENT_VIOLET },
];

const BLEND_AXIS = { label: 'Speed', min: 0, max: 400, unit: 'cm/s' };

const BS_FEATURES = ['Locomotion Blend Space', 'UARPGAnimInstance'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function BlendSpaceMicro({ featureMap }: AnimationBlendSpacePanelProps) {
  const completed = BS_FEATURES.filter((f) => {
    const s = featureMap.get(f)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Blend className="w-5 h-5 text-violet-400" />
      <span className="font-mono text-xs">{completed}/{BS_FEATURES.length}</span>
      <span className="text-2xs text-text-muted">1D BS</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function BlendSpaceCompact({ featureMap }: AnimationBlendSpacePanelProps) {
  const bsStatus = featureMap.get('Locomotion Blend Space')?.status;
  const { color: dotColor, label: dotLabel } = statusInfo(bsStatus);

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
        />
        <span className="font-medium text-text">Blend Space 1D</span>
      </div>
      {BLEND_SAMPLES.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
          <span className="text-text-muted">{s.name}</span>
          <span className="text-2xs text-text-muted/60 ml-auto font-mono">{s.paramValue}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        Axis: {BLEND_AXIS.label} (0–{BLEND_AXIS.max})
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function BlendSpaceFull({ featureMap, defs }: AnimationBlendSpacePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        1D Blend Space driven by <span className="font-mono text-xs text-text">Speed</span> variable from
        the AnimInstance. Blends between Idle → Walk → Run based on character movement speed.
        Can be created headlessly via <span className="font-mono text-xs text-text">UCommandlet</span>.
      </SurfaceCard>

      {/* Feature cards */}
      {BS_FEATURES.map((name) => (
        <FeatureCard
          key={name}
          name={name}
          featureMap={featureMap}
          defs={defs}
          expanded={expanded}
          onToggle={onToggle}
          accent={ACCENT}
        />
      ))}

      {/* Blend Space Visualization */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Blend Space Samples" />
        <div className={`${DZIN_SPACING.full.contentMt}`}>
          {/* Axis bar */}
          <div className="relative h-8 bg-surface rounded-lg border border-border/50 mb-3 overflow-hidden">
            {BLEND_SAMPLES.map((s) => {
              const pct = (s.paramValue / BLEND_AXIS.max) * 100;
              return (
                <motion.div
                  key={s.name}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${pct}%` }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: pct / 500 }}
                >
                  <span
                    className="w-4 h-4 rounded-full border-2 border-surface"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="flex justify-between text-2xs text-text-muted font-mono mb-3">
            <span>{BLEND_AXIS.min}</span>
            <span>{BLEND_AXIS.label} ({BLEND_AXIS.unit})</span>
            <span>{BLEND_AXIS.max}</span>
          </div>

          {/* Sample list */}
          <div className={`grid grid-cols-3 ${DZIN_SPACING.full.gridGap}`}>
            {BLEND_SAMPLES.map((s) => (
              <div
                key={s.name}
                className="flex flex-col items-center bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
              >
                <span
                  className="w-3 h-3 rounded-full mb-1"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 0 3px ${s.color}33` }}
                />
                <span className="text-xs font-medium text-text">{s.name}</span>
                <span className="text-2xs font-mono text-text-muted">{s.paramValue} {BLEND_AXIS.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AnimationBlendSpacePanel({ featureMap, defs }: AnimationBlendSpacePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Blend Space" icon={<Blend className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BlendSpaceMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <BlendSpaceCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <BlendSpaceFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
