'use client';

import { Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODULE_COLORS } from '@/lib/chart-colors';
import {
  FeatureCard as SharedFeatureCard, PipelineFlow,
} from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { GAS_STEPS } from './data';
import type { SectionProps } from './types';

const ACCENT = MODULE_COLORS.systems;

export function CoreSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3">
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted leading-relaxed">
          The Ability System Component (ASC) is the central hub that manages abilities, attributes, tags, and effects.
          It must be attached to the character base class and implement <span className="font-mono text-xs text-text">IAbilitySystemInterface</span>.
        </p>
      </BlueprintPanel>

      <SharedFeatureCard name="AbilitySystemComponent" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={MODULE_COLORS.core} />

      {/* Connection diagram */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader icon={Cpu} label="ASC Connections" color={ACCENT} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {['AttributeSet', 'Tag Container', 'Ability Instances', 'Active Effects'].map((conn, i) => (
            <motion.div
              key={conn}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] p-2.5 rounded-lg border"
              style={{ borderColor: `${ACCENT}25`, backgroundColor: `${ACCENT}08` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
              <span className="text-text font-medium" style={{ textShadow: `0 0 12px ${ACCENT}40` }}>{conn}</span>
            </motion.div>
          ))}
        </div>
      </BlueprintPanel>

      {/* GAS Architecture Pipeline */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="GAS Architecture Pipeline" color={ACCENT} />
        <div className="mt-3">
          <PipelineFlow steps={['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution']} accent={ACCENT} />
        </div>
      </BlueprintPanel>

      {/* GAS Execution Sequence */}
      <BlueprintPanel color={MODULE_COLORS.core} className="p-3">
        <SectionHeader icon={Cpu} label="GAS Execution Sequence" color={MODULE_COLORS.core} />
        <div className="mt-4">
          <GASArchitectureExplorer />
        </div>
      </BlueprintPanel>
    </div>
  );
}

/* ── GAS Architecture Explorer component ──────────────────────────────── */

function GASArchitectureExplorer() {
  const stepH = 36;
  const stepW = 180;
  const arrowGap = 16;
  const totalH = GAS_STEPS.length * stepH + (GAS_STEPS.length - 1) * arrowGap + 20;
  const cx = stepW / 2 + 40;

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${stepW + 80} ${totalH}`} className="overflow-visible">
      {GAS_STEPS.map((step, i) => {
        const y = 10 + i * (stepH + arrowGap);
        const isLast = i === GAS_STEPS.length - 1;
        return (
          <g key={step.label}>
            <motion.rect
              x={cx - stepW / 2} y={y}
              width={stepW} height={stepH}
              rx={8} fill={`${step.color}15`}
              stroke={step.color} strokeWidth={1.5}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
            />
            <motion.text
              x={cx} y={y + 18}
              textAnchor="middle"
              className="text-xs font-mono font-bold"
              fill={step.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.12 + 0.05 }}
            >
              {step.label}
            </motion.text>
            <motion.text
              x={cx} y={y + 34}
              textAnchor="middle"
              className="text-xs font-mono fill-[var(--text-muted)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.12 + 0.1 }}
            >
              {step.desc}
            </motion.text>
            {!isLast && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.12 + 0.15 }}
              >
                <line
                  x1={cx} y1={y + stepH}
                  x2={cx} y2={y + stepH + arrowGap}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}
                />
                <polygon
                  points={`${cx - 4},${y + stepH + arrowGap - 6} ${cx},${y + stepH + arrowGap} ${cx + 4},${y + stepH + arrowGap - 6}`}
                  fill="rgba(255,255,255,0.25)"
                />
              </motion.g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
