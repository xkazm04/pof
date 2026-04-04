'use client';

import { Coins, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel, PipelineFlow } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalEconomyPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const ECONOMY_METRICS = [
  { name: 'Gold Inflation', value: '+2.3%/hr', status: 'ok' as const, trend: 'up' as const },
  { name: 'Item Sink Rate', value: '67%', status: 'ok' as const, trend: 'stable' as const },
  { name: 'Drop Value Avg', value: '142g', status: 'warn' as const, trend: 'up' as const },
  { name: 'Vendor Balance', value: '-12k', status: 'error' as const, trend: 'down' as const },
  { name: 'Craft Cost Ratio', value: '1.8x', status: 'ok' as const, trend: 'stable' as const },
] as const;

const CODE_GEN_TEMPLATES = [
  { name: 'UCurrencySubsystem', lang: 'C++', lines: 340 },
  { name: 'UEconomyRebalancer', lang: 'C++', lines: 180 },
  { name: 'UVendorPriceTable', lang: 'C++', lines: 220 },
] as const;

const STATUS_MAP = { ok: STATUS_SUCCESS, warn: STATUS_WARNING, error: STATUS_ERROR } as const;
const ECONOMY_PIPELINE = ['Simulate', 'Analyze', 'Balance', 'Generate', 'Verify'] as const;

const healthyCount = ECONOMY_METRICS.filter(m => m.status === 'ok').length;

/* ── Micro density ──────────────────────────────────────────────────────── */

function EconomyMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Coins className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{healthyCount}/{ECONOMY_METRICS.length} ok</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EconomyCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ECONOMY_METRICS.map((m) => (
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

function EconomyFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Economy simulator and code generation hub — tracks currency flow, item sinks,
        vendor balance, and generates UE5 C++ economy subsystem boilerplate.
      </SurfaceCard>

      {/* Economy metrics */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Coins} label="Economy Metrics" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {ECONOMY_METRICS.map((m, i) => {
            const TrendIcon = m.trend === 'up' ? TrendingUp : m.trend === 'down' ? TrendingDown : ArrowRight;
            return (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_MAP[m.status], boxShadow: `0 0 6px ${STATUS_MAP[m.status]}40` }}
                />
                <span className="text-text-muted flex-1">{m.name}</span>
                <TrendIcon className="w-3 h-3" style={{ color: STATUS_MAP[m.status] }} />
                <span className="font-mono font-bold text-text">{m.value}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Code gen templates */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Coins} label="Code Gen Templates" color={ACCENT_CYAN} />
        <div className="space-y-1.5 mt-2">
          {CODE_GEN_TEMPLATES.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="font-mono text-text font-medium flex-1">{t.name}</span>
              <span className="text-text-muted">{t.lang}</span>
              <span className="font-mono text-text-muted">{t.lines}L</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Economy Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...ECONOMY_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalEconomyPanel({ featureMap, defs }: EvalEconomyPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Economy Simulator" icon={<Coins className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <EconomyMicro />}
          {density === 'compact' && <EconomyCompact />}
          {density === 'full' && <EconomyFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
