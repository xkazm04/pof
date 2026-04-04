'use client';

import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_RED, ACCENT_CYAN, STATUS_SUBDUED } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AnimationStateMachinePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

interface AnimState {
  name: string;
  color: string;
  transitions: string[];
}

const ANIM_STATES: AnimState[] = [
  { name: 'Locomotion', color: ACCENT_EMERALD, transitions: ['Attacking', 'Dodging', 'HitReact', 'Death'] },
  { name: 'Attacking', color: ACCENT_RED, transitions: ['Locomotion', 'Dodging', 'HitReact', 'Death'] },
  { name: 'Dodging', color: ACCENT_CYAN, transitions: ['Locomotion', 'Attacking'] },
  { name: 'HitReact', color: ACCENT_ORANGE, transitions: ['Locomotion', 'Death'] },
  { name: 'Death', color: STATUS_SUBDUED, transitions: [] },
];

const SM_FEATURES = ['UARPGAnimInstance', 'Animation state machine', 'Root motion toggle'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function StateMachineMicro({ featureMap }: AnimationStateMachinePanelProps) {
  const completed = SM_FEATURES.filter((f) => {
    const s = featureMap.get(f)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <GitBranch className="w-5 h-5 text-orange-400" />
      <span className="font-mono text-xs">{completed}/{SM_FEATURES.length}</span>
      <span className="text-2xs text-text-muted">{ANIM_STATES.length} states</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function StateMachineCompact({ featureMap }: AnimationStateMachinePanelProps) {
  const smStatus = featureMap.get('Animation state machine')?.status;
  const { color: dotColor, label: dotLabel } = statusInfo(smStatus);

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
        />
        <span className="font-medium text-text">State Machine</span>
      </div>
      {ANIM_STATES.map((state) => (
        <div key={state.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: state.color }} />
          <span className="text-text-muted">{state.name}</span>
          {state.transitions.length > 0 && (
            <span className="text-2xs text-text-muted/60">→ {state.transitions.length}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function StateMachineFull({ featureMap, defs }: AnimationStateMachinePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        AnimBP state machine with 5 states: <span className="font-mono text-xs text-text">Locomotion</span>,{' '}
        <span className="font-mono text-xs text-text">Attacking</span>,{' '}
        <span className="font-mono text-xs text-text">Dodging</span>,{' '}
        <span className="font-mono text-xs text-text">HitReact</span>,{' '}
        <span className="font-mono text-xs text-text">Death</span>. Root motion toggles per-state.
      </SurfaceCard>

      {/* Feature cards */}
      {SM_FEATURES.map((name) => (
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

      {/* State Graph */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="State Transitions" />
        <div className={`space-y-2 ${DZIN_SPACING.full.contentMt}`}>
          {ANIM_STATES.map((state, si) => (
            <motion.div
              key={state.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: si * 0.06 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: state.color, boxShadow: `0 0 0 3px ${state.color}33` }}
                />
                <span className="text-xs font-bold text-text">{state.name}</span>
              </div>
              {state.transitions.length > 0 ? (
                <div className="ml-5 flex flex-wrap gap-1.5">
                  {state.transitions.map((t) => {
                    const target = ANIM_STATES.find((s) => s.name === t);
                    return (
                      <span
                        key={t}
                        className="text-2xs font-mono px-1.5 py-0.5 rounded border border-border/50 bg-surface"
                        style={{ color: target?.color }}
                      >
                        → {t}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="ml-5 text-2xs text-text-muted italic">Terminal state</span>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AnimationStateMachinePanel({ featureMap, defs }: AnimationStateMachinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="State Machine" icon={<GitBranch className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <StateMachineMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <StateMachineCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <StateMachineFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
