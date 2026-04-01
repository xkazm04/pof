'use client';

import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING, DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { isRelatedToSelection, ENTITY_RELATIONS } from '@/lib/dzin/entity-relations';
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

export interface CorePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const ASC_CONNECTIONS = ['AttributeSet', 'Tag Container', 'Abilities', 'Active Effects'] as const;
const ASC_CONNECTIONS_FULL = ['AttributeSet', 'Tag Container', 'Ability Instances', 'Active Effects'] as const;

const GAS_PIPELINE_STEPS = ['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function CoreMicro({ featureMap, defs }: CorePanelProps) {
  const completed = defs.filter((d) => {
    const s = featureMap.get(d.featureName)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;
  const total = defs.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
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
  const { color: dotColor, label: dotLabel } = statusInfo(ascStatus);
  const { selection } = useDzinSelection();

  // Map ASC connections to entity types for selection awareness
  const connEntityMap: Record<string, { type: 'ability' | 'tag'; id: string }> = {
    'Abilities': { type: 'ability', id: 'MeleeAttack' },
    'Tag Container': { type: 'tag', id: 'Ability.MeleeAttack' },
    'AttributeSet': { type: 'tag', id: 'Damage.Physical' },
    'Active Effects': { type: 'ability', id: 'HealOverTime' },
  };

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {/* ASC status */}
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
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
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-text-muted">{conn}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline count */}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
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
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description card */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
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
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Cpu className="w-4 h-4 text-blue-400" /> ASC Connections
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${DZIN_SPACING.full.gridGap}`}>
          {ASC_CONNECTIONS_FULL.map((conn) => (
            <div
              key={conn}
              className="flex items-center gap-2 text-sm bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <span className="w-3 h-3 rounded-full bg-blue-400" style={{ boxShadow: '0 0 0 3px rgba(96,165,250,0.2)' }} />
              <span className="text-text font-medium">{conn}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* GAS Architecture Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="GAS Architecture Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
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
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <CoreMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <CoreCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <CoreFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
