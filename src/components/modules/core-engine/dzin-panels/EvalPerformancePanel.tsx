'use client';

import { Gauge, Cpu, MemoryStick, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel, PipelineFlow } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalPerformancePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const PERF_METRICS = [
  { name: 'Frame Time', value: '16.2ms', target: '16.6ms', status: 'ok' as const, icon: Clock },
  { name: 'Game Thread', value: '8.4ms', target: '10ms', status: 'ok' as const, icon: Cpu },
  { name: 'Render Thread', value: '11.1ms', target: '12ms', status: 'warn' as const, icon: Gauge },
  { name: 'Memory (RSS)', value: '1.8GB', target: '2GB', status: 'ok' as const, icon: MemoryStick },
  { name: 'Draw Calls', value: '2,847', target: '3,000', status: 'warn' as const, icon: Gauge },
  { name: 'GC Hitches', value: '3/min', target: '1/min', status: 'error' as const, icon: Clock },
] as const;

const HOTSPOTS = [
  { func: 'AWorldZone::StreamTick', ms: 2.4, module: 'arpg-world' },
  { func: 'ULootResolver::Roll', ms: 1.8, module: 'arpg-loot' },
  { func: 'UGASManager::ProcessEffects', ms: 1.2, module: 'arpg-combat' },
] as const;

const STATUS_MAP = { ok: STATUS_SUCCESS, warn: STATUS_WARNING, error: STATUS_ERROR } as const;
const PROFILE_PIPELINE = ['Capture', 'Analyze', 'Hotspot', 'Recommend', 'Report'] as const;

const okCount = PERF_METRICS.filter(m => m.status === 'ok').length;

/* ── Micro density ──────────────────────────────────────────────────────── */

function PerfMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Gauge className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{okCount}/{PERF_METRICS.length}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PerfCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {PERF_METRICS.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_MAP[m.status] }}
          />
          <span className="text-text-muted flex-1">{m.name}</span>
          <span className="font-mono text-text font-medium">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function PerfFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Performance profiling dashboard with frame timing, thread budgets,
        memory usage, and hotspot identification for UE5 optimization.
      </SurfaceCard>

      {/* Metrics grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Gauge} label="Performance Metrics" color={ACCENT} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {PERF_METRICS.map((m, i) => {
            const Icon = m.icon;
            const color = STATUS_MAP[m.status];
            return (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-surface-deep/50 text-xs"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-text-muted truncate">{m.name}</div>
                  <div className="font-mono font-bold text-text">{m.value}</div>
                </div>
                <span className="font-mono text-text-muted text-[10px]">/{m.target}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Hotspots */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Cpu} label="Hotspots" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {HOTSPOTS.map((h, i) => (
            <motion.div
              key={h.func}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}40` }} />
              <span className="font-mono text-text flex-1 truncate">{h.func}</span>
              <span className="text-text-muted">{h.module.replace('arpg-', '')}</span>
              <span className="font-mono font-bold text-text">{h.ms}ms</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Profiling Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...PROFILE_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalPerformancePanel({ featureMap, defs }: EvalPerformancePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Performance" icon={<Gauge className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PerfMicro />}
          {density === 'compact' && <PerfCompact />}
          {density === 'full' && <PerfFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
