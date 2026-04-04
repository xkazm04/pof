'use client';

import { Zap, ArrowDown, BarChart3 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DamagePipelinePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const PIPELINE_STAGES = [
  { name: 'Raw Damage', value: 250, multiplier: 1.0, color: ACCENT },
  { name: 'Crit Modifier', value: 375, multiplier: 1.5, color: STATUS_SUCCESS },
  { name: 'Armor Mitigation', value: 300, multiplier: 0.8, color: STATUS_WARNING },
  { name: 'Resistance', value: 240, multiplier: 0.8, color: STATUS_WARNING },
  { name: 'Vulnerability', value: 288, multiplier: 1.2, color: STATUS_ERROR },
  { name: 'Final Damage', value: 288, multiplier: 1.0, color: STATUS_SUCCESS },
] as const;

const EXECUTION_BREAKDOWN = [
  { label: 'Base Physical', value: 180, pct: 62 },
  { label: 'Elemental (Fire)', value: 70, pct: 24 },
  { label: 'Bonus (Bleed)', value: 38, pct: 14 },
] as const;

const MULTIPLIER_SOURCES = [
  { source: 'Critical Strike', mult: 1.5, active: true },
  { source: 'Armor Rating (450)', mult: 0.8, active: true },
  { source: 'Fire Resistance (15%)', mult: 0.8, active: true },
  { source: 'Vulnerability Debuff', mult: 1.2, active: true },
  { source: 'Shield Block', mult: 0.6, active: false },
  { source: 'Evasion', mult: 0.0, active: false },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function PipelineMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Zap className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{PIPELINE_STAGES.length} stages</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PipelineCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Damage Pipeline</span>
        <span className="font-mono text-text">{PIPELINE_STAGES.length} stages</span>
      </div>
      {PIPELINE_STAGES.map((stage) => (
        <div key={stage.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-text-muted flex-1 truncate">{stage.name}</span>
          <span className="font-mono text-text">{stage.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function PipelineFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Damage flow pipeline showing each calculation stage from raw input to final applied damage.
      </SurfaceCard>

      {/* Stage Flow */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={ArrowDown} label="Stage Flow" color={ACCENT} />
        <div className="space-y-1 mt-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-text flex-1 truncate">{stage.name}</span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-mono"
                  style={{
                    backgroundColor: `${stage.color}${OPACITY_15}`,
                    color: stage.color,
                  }}
                >
                  x{stage.multiplier.toFixed(1)}
                </span>
                <span className="font-mono text-text w-10 text-right">{stage.value}</span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowDown className="w-3 h-3 text-text-muted/40" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Multiplier Sources */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Zap} label="Multiplier Sources" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {MULTIPLIER_SOURCES.map((src, i) => (
            <motion.div
              key={src.source}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: src.active ? STATUS_SUCCESS : 'var(--text-muted)' }}
              />
              <span className={`flex-1 truncate ${src.active ? 'text-text' : 'text-text-muted line-through'}`}>
                {src.source}
              </span>
              <span
                className="font-mono text-2xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: src.active
                    ? `${src.mult >= 1 ? STATUS_SUCCESS : STATUS_WARNING}${OPACITY_15}`
                    : 'transparent',
                  color: src.active
                    ? (src.mult >= 1 ? STATUS_SUCCESS : STATUS_WARNING)
                    : 'var(--text-muted)',
                }}
              >
                x{src.mult.toFixed(1)}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Execution Breakdown */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={BarChart3} label="Execution Breakdown" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {EXECUTION_BREAKDOWN.map((entry, i) => (
            <motion.div
              key={entry.label}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-text">{entry.label}</span>
                <span className="font-mono text-text-muted">{entry.value} ({entry.pct}%)</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${ACCENT}${OPACITY_15}` }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  initial={{ width: 0 }}
                  animate={{ width: `${entry.pct}%` }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DamagePipelinePanel({ featureMap, defs }: DamagePipelinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Damage Pipeline" icon={<Zap className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PipelineMicro />}
          {density === 'compact' && <PipelineCompact />}
          {density === 'full' && <PipelineFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
