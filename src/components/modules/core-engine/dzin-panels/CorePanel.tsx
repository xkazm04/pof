'use client';

import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { isRelatedToSelection, ENTITY_RELATIONS } from '@/lib/dzin/entity-relations';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  STATUS_COLORS,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface CorePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const ASC_CONNECTIONS = ['AttributeSet', 'Tag Container', 'Abilities', 'Active Effects'] as const;
const ASC_CONNECTIONS_FULL = ['AttributeSet', 'Tag Container', 'Ability Instances', 'Active Effects'] as const;

const GAS_PIPELINE_STEPS = ['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution'] as const;

/* ── Helpers ────────────────────────────────────────────────────────────── */

function statusDotColor(status: FeatureStatus | undefined): string {
  if (!status) return STATUS_COLORS.unknown.dot;
  return STATUS_COLORS[status].dot;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function CoreMicro({ featureMap, defs }: CorePanelProps) {
  const completed = defs.filter((d) => {
    const s = featureMap.get(d.featureName)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;
  const total = defs.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Cpu className="w-5 h-5 text-blue-400" />
      <span className="font-mono text-xs">{completed}/{total}</span>
      <div className="w-8 h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function CoreCompact({ featureMap }: CorePanelProps) {
  const ascStatus = featureMap.get('AbilitySystemComponent')?.status;
  const dotColor = statusDotColor(ascStatus);
  const { selection } = useDzinSelection();

  // Map ASC connections to entity types for selection awareness
  const connEntityMap: Record<string, { type: 'ability' | 'tag'; id: string }> = {
    'Abilities': { type: 'ability', id: 'MeleeAttack' },
    'Tag Container': { type: 'tag', id: 'Ability.MeleeAttack' },
  };

  return (
    <div className="space-y-2 p-2 text-xs">
      {/* ASC status */}
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span className="font-medium text-text">AbilitySystemComponent</span>
      </div>

      {/* Connection items */}
      <div className="space-y-1 pl-1">
        {ASC_CONNECTIONS.map((conn) => {
          const entity = connEntityMap[conn];
          const isRelated = entity
            ? isRelatedToSelection(entity.type, entity.id, selection, ENTITY_RELATIONS)
            : true;
          return (
            <motion.div
              key={conn}
              className="flex items-center gap-2"
              animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
              transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-text-muted">{conn}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline count */}
      <div className="border-t border-border/40 pt-1.5 text-text-muted">
        Pipeline: {GAS_PIPELINE_STEPS.length} steps
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function CoreFull({ featureMap, defs }: CorePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className="space-y-2.5">
      {/* Description card */}
      <SurfaceCard level={3} className="p-3 bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed">
        The Ability System Component (ASC) is the central hub that manages abilities, attributes, tags, and effects.
        It must be attached to the character base class and implement <span className="font-mono text-xs text-text">IAbilitySystemInterface</span>.
      </SurfaceCard>

      {/* Feature card */}
      <FeatureCard
        name="AbilitySystemComponent"
        featureMap={featureMap}
        defs={defs}
        expanded={expanded}
        onToggle={onToggle}
        accent={ACCENT}
      />

      {/* ASC Connections grid */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" /> ASC Connections
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ASC_CONNECTIONS_FULL.map((conn) => (
            <div
              key={conn}
              className="flex items-center gap-2 text-sm bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-text font-medium">{conn}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* GAS Architecture Pipeline */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="GAS Architecture Pipeline" />
        <div className="mt-3">
          <PipelineFlow steps={[...GAS_PIPELINE_STEPS]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main CorePanel ─────────────────────────────────────────────────────── */

export function CorePanel({ featureMap, defs }: CorePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Core" icon={<Cpu className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <CoreMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <CoreCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <CoreFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
