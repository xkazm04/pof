'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
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
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface CharacterOverviewPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const CLASS_HIERARCHY = [
  { name: 'ACharacter', ue: true },
  { name: 'AARPGCharacterBase', ue: false },
  { name: 'AARPGPlayerCharacter', ue: false },
] as const;

const FRAMEWORK_CLASSES = ['AARPGGameMode', 'AARPGPlayerController', 'UARPGGameInstance'] as const;

const CHARACTER_PIPELINE = ['CharacterBase', 'PlayerCharacter', 'Controller', 'GameMode', 'GameInstance'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function OverviewMicro({ featureMap, defs }: CharacterOverviewPanelProps) {
  const completed = defs.filter((d) => {
    const s = featureMap.get(d.featureName)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;
  const total = defs.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <User className="w-5 h-5 text-blue-400" />
      <span className="font-mono text-xs">{completed}/{total}</span>
      <div className="w-8 h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function OverviewCompact({ featureMap }: CharacterOverviewPanelProps) {
  const baseStatus = featureMap.get('AARPGCharacterBase')?.status;
  const { color: baseColor, label: baseLabel } = statusInfo(baseStatus);

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: baseColor, boxShadow: `0 0 0 3px ${baseColor}33` }}
          title={baseLabel}
        />
        <span className="font-medium text-text">CharacterBase</span>
      </div>
      <div className="space-y-1 pl-1">
        {FRAMEWORK_CLASSES.map((cls) => {
          const s = featureMap.get(cls)?.status;
          const { color } = statusInfo(s);
          return (
            <div key={cls} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-text-muted">{cls.replace(/^[AU]ARPG/, '')}</span>
            </div>
          );
        })}
      </div>
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        Pipeline: {CHARACTER_PIPELINE.length} classes
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function OverviewFull({ featureMap, defs }: CharacterOverviewPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Character module defines the class hierarchy from <span className="font-mono text-xs text-text">AARPGCharacterBase</span> (shared by player and enemies) through concrete player/controller classes, camera setup, and game framework classes.
      </SurfaceCard>

      {/* Class Hierarchy */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <User className="w-4 h-4 text-blue-400" /> Class Hierarchy
        </div>
        <div className="space-y-1">
          {CLASS_HIERARCHY.map((cls, i) => (
            <div key={cls.name} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${i * 16}px` }}>
              <span className={`w-3 h-3 rounded-full ${cls.ue ? 'bg-gray-500' : 'bg-blue-400'}`}
                style={{ boxShadow: cls.ue ? undefined : '0 0 0 3px rgba(96,165,250,0.2)' }} />
              <span className={`font-mono text-xs ${cls.ue ? 'text-text-muted' : 'text-text font-medium'}`}>
                {cls.name}
              </span>
              {cls.ue && <span className="text-2xs text-text-muted">(UE5)</span>}
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {['AARPGCharacterBase', 'AARPGPlayerCharacter', 'AARPGPlayerController', 'Enhanced Input actions', 'Isometric camera', 'WASD movement', 'Sprint system', 'Dodge/dash', 'AARPGGameMode', 'UARPGGameInstance'].map((name) => (
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

      {/* Framework Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Character Framework Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...CHARACTER_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function CharacterOverviewPanel({ featureMap, defs }: CharacterOverviewPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Character Overview" icon={<User className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <OverviewMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <OverviewCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <OverviewFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
