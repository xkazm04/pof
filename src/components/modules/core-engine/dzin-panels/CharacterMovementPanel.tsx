'use client';

import { useState } from 'react';
import { Move } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface CharacterMovementPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD;

const MOVEMENT_FEATURES = ['WASD movement', 'Sprint system', 'Dodge/dash'] as const;

const MOVEMENT_PARAMS = [
  { label: 'Walk Speed', value: '400', unit: 'cm/s' },
  { label: 'Sprint Speed', value: '700', unit: 'cm/s' },
  { label: 'Sprint Multiplier', value: '1.75x', unit: '' },
  { label: 'Dodge Distance', value: '600', unit: 'cm' },
  { label: 'Dodge Cooldown', value: '0.8', unit: 's' },
  { label: 'Rotation Rate', value: '540', unit: '°/s' },
] as const;

const MOVEMENT_PIPELINE = ['Input', 'Controller', 'CMC', 'Orient-to-Mvmt', 'Camera-Relative'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function MovementMicro({ featureMap }: CharacterMovementPanelProps) {
  const completed = MOVEMENT_FEATURES.filter((f) => {
    const s = featureMap.get(f)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;

  const pct = MOVEMENT_FEATURES.length > 0 ? (completed / MOVEMENT_FEATURES.length) * 100 : 0;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Move className="w-5 h-5 text-emerald-400" />
      <span className="font-mono text-xs">{completed}/{MOVEMENT_FEATURES.length}</span>
      <div className="w-8 h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MovementCompact({ featureMap }: CharacterMovementPanelProps) {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <Move className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-medium text-text">Movement</span>
      </div>
      {MOVEMENT_FEATURES.map((feat) => {
        const s = featureMap.get(feat)?.status;
        const { color } = statusInfo(s);
        return (
          <div key={feat} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-text-muted">{feat}</span>
          </div>
        );
      })}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        CMC + Orient-to-Movement
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function MovementFull({ featureMap, defs }: CharacterMovementPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Camera-relative WASD movement using <span className="font-mono text-xs text-text">UCharacterMovementComponent</span> with
        orient-to-movement rotation, hold-to-sprint, and dodge roll with invulnerability frames.
      </SurfaceCard>

      {/* Feature cards */}
      {MOVEMENT_FEATURES.map((name) => (
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

      {/* Movement Parameters */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Move className="w-4 h-4 text-emerald-400" /> Movement Parameters
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-3 ${DZIN_SPACING.full.gridGap}`}>
          {MOVEMENT_PARAMS.map((param) => (
            <div
              key={param.label}
              className="flex flex-col bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <span className="text-2xs text-text-muted uppercase">{param.label}</span>
              <span className="text-sm font-mono text-text font-medium">
                {param.value}<span className="text-text-muted text-2xs ml-0.5">{param.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Movement Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Movement Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...MOVEMENT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function CharacterMovementPanel({ featureMap, defs }: CharacterMovementPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Movement" icon={<Move className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MovementMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <MovementCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <MovementFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
