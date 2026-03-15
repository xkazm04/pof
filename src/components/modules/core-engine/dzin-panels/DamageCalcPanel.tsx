'use client';

import { Calculator } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DamageCalcPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const GAS_STEPS = [
  { label: 'CommitAbility', desc: 'Lock resources, check tags', color: '#3b82f6' },
  { label: 'CheckCost', desc: 'Verify mana/stamina available', color: '#8b5cf6' },
  { label: 'ApplyCost', desc: 'Deduct resource from AttributeSet', color: '#a855f7' },
  { label: 'SpawnProjectile', desc: 'Create projectile actor (if ranged)', color: '#f59e0b' },
  { label: 'OnHit', desc: 'Collision triggers effect application', color: '#f97316' },
  { label: 'ApplyDamage', desc: 'GameplayEffect modifies target HP', color: '#ef4444' },
  { label: 'PostGEExecute', desc: 'Run post-effect callbacks', color: '#10b981' },
];

/* ── GAS Architecture Explorer (copied from AbilitySpellbook -- private) ── */

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
              className="text-[11px] font-mono font-bold"
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
              className="text-[9px] font-mono fill-[var(--text-muted)]"
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

/* ── Micro density ──────────────────────────────────────────────────────── */

function DamageCalcMicro() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Calculator className="w-5 h-5" style={{ color: '#f97316' }} />
      <span className="font-mono text-xs">{GAS_STEPS.length} steps</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function DamageCalcCompact() {
  return (
    <div className="space-y-1.5 p-2 text-xs">
      {GAS_STEPS.map((step) => (
        <div key={step.label} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: step.color }}
          />
          <span className="font-mono font-medium text-text truncate">{step.label}</span>
          <span className="text-text-muted text-[10px] truncate ml-auto">{step.desc}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function DamageCalcFull() {
  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel icon={Calculator} label="Damage Execution Pipeline" color="#f97316" />
        <div className="mt-2.5 relative z-10">
          <GASArchitectureExplorer />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main DamageCalcPanel ──────────────────────────────────────────────── */

export function DamageCalcPanel({ featureMap: _featureMap, defs: _defs }: DamageCalcPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Damage Calc" icon={<Calculator className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <DamageCalcMicro />}
          {density === 'compact' && <DamageCalcCompact />}
          {density === 'full' && <DamageCalcFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
