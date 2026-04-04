'use client';

import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
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
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK, ACCENT_VIOLET, ACCENT_RED,
} from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface CharacterInputPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

interface InputAction {
  name: string;
  binding: string;
  type: string;
  color: string;
}

const INPUT_ACTIONS: InputAction[] = [
  { name: 'IA_Move', binding: 'WASD', type: 'Axis2D', color: ACCENT_EMERALD },
  { name: 'IA_Look', binding: 'Mouse', type: 'Axis2D', color: ACCENT_CYAN },
  { name: 'IA_PrimaryAttack', binding: 'LMB', type: 'Bool', color: ACCENT_RED },
  { name: 'IA_Dodge', binding: 'Space', type: 'Bool', color: ACCENT_ORANGE },
  { name: 'IA_Sprint', binding: 'Shift', type: 'Bool', color: ACCENT_PINK },
  { name: 'IA_Interact', binding: 'E', type: 'Bool', color: ACCENT_VIOLET },
];

const INPUT_FEATURES = ['Enhanced Input actions', 'AARPGPlayerController'] as const;

const INPUT_PIPELINE = ['InputAction', 'Modifier', 'Trigger', 'IMC_Default', 'Controller'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function InputMicro({ featureMap }: CharacterInputPanelProps) {
  const completed = INPUT_FEATURES.filter((f) => {
    const s = featureMap.get(f)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Gamepad2 className="w-5 h-5 text-cyan-400" />
      <span className="font-mono text-xs">{completed}/{INPUT_FEATURES.length}</span>
      <span className="text-2xs text-text-muted">{INPUT_ACTIONS.length} IA</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function InputCompact({ featureMap }: CharacterInputPanelProps) {
  const inputStatus = featureMap.get('Enhanced Input actions')?.status;
  const { color: dotColor, label: dotLabel } = statusInfo(inputStatus);

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
        />
        <span className="font-medium text-text">Enhanced Input</span>
      </div>
      {INPUT_ACTIONS.map((ia) => (
        <div key={ia.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ia.color }} />
          <span className="text-text-muted font-mono">{ia.name}</span>
          <span className="text-2xs text-text-muted/60 ml-auto">{ia.binding}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        IMC: IMC_Default
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function InputFull({ featureMap, defs }: CharacterInputPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        UE5 Enhanced Input system with <span className="font-mono text-xs text-text">InputAction</span> assets
        bound through <span className="font-mono text-xs text-text">IMC_Default</span> mapping context.
        Controller binds actions in <span className="font-mono text-xs text-text">SetupPlayerInputComponent</span>.
      </SurfaceCard>

      {/* Feature cards */}
      {INPUT_FEATURES.map((name) => (
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

      {/* Input Actions Catalog */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Gamepad2 className="w-4 h-4 text-cyan-400" /> Input Actions
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-3 ${DZIN_SPACING.full.gridGap}`}>
          {INPUT_ACTIONS.map((ia, i) => (
            <motion.div
              key={ia.name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ia.color, boxShadow: `0 0 0 3px ${ia.color}33` }}
                />
                <span className="text-xs font-mono font-medium text-text">{ia.name}</span>
              </div>
              <div className="flex justify-between text-2xs text-text-muted">
                <span>{ia.binding}</span>
                <span className="px-1 py-0.5 rounded bg-surface-deep">{ia.type}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Input Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Enhanced Input Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...INPUT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function CharacterInputPanel({ featureMap, defs }: CharacterInputPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Input" icon={<Gamepad2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <InputMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <InputCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <InputFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
