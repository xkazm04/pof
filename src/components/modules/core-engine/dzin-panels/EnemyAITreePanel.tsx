'use client';

import { useState } from 'react';
import { Brain } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_RED, ACCENT_EMERALD, ACCENT_CYAN, STATUS_WARNING } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EnemyAITreePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_RED;

const BT_STATES = [
  { name: 'Idle', desc: 'Default state, awaiting perception stimulus', color: ACCENT_EMERALD },
  { name: 'Patrol', desc: 'Move between EQS patrol points', color: ACCENT_CYAN },
  { name: 'Chase', desc: 'Pursue target within aggro range', color: STATUS_WARNING },
  { name: 'Attack', desc: 'Execute combat ability on target', color: ACCENT_RED },
  { name: 'Flee', desc: 'Retreat when health below threshold', color: STATUS_WARNING },
] as const;

const BT_PIPELINE = ['BTDecorator', 'BTService', 'BTTask', 'EQS Query', 'GA Execute'] as const;

const AI_FEATURES = [
  'AARPGAIController', 'Behavior Tree', 'AI Perception',
  'EQS queries', 'Enemy Gameplay Abilities',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function AITreeMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Brain className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{BT_STATES.length} states</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function AITreeCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {BT_STATES.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-text font-medium flex-1">{s.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {BT_PIPELINE.length} BT node types
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function AITreeFull({ featureMap, defs }: EnemyAITreePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Behavior tree state machine with {BT_STATES.length} states, BT decorators/services/tasks,
        EQS queries, and gameplay ability execution.
      </SurfaceCard>

      {/* BT States */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Brain} label="Behavior Tree States" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {BT_STATES.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-mono font-bold w-14" style={{ color: s.color }}>{s.name}</span>
              <span className="text-text-muted">{s.desc}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {AI_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="BT Execution Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...BT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function EnemyAITreePanel({ featureMap, defs }: EnemyAITreePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="AI Behavior Tree" icon={<Brain className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <AITreeMicro />}
          {density === 'compact' && <AITreeCompact />}
          {density === 'full' && <AITreeFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
