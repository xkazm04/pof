'use client';

import { TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ItemEconomyPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const ECONOMY_METRICS = [
  { label: 'Gold Influx', value: '1,250/hr', status: 'ok' as const },
  { label: 'Item Sink Rate', value: '68%', status: 'ok' as const },
  { label: 'Rarity Inflation', value: '1.12x', status: 'warn' as const },
  { label: 'Power Curve', value: 'Linear', status: 'ok' as const },
] as const;

const ECONOMY_RADAR: RadarDataPoint[] = [
  { axis: 'Supply', value: 0.75 },
  { axis: 'Demand', value: 0.85 },
  { axis: 'Sink', value: 0.6 },
  { axis: 'Growth', value: 0.7 },
  { axis: 'Balance', value: 0.8 },
];

const STATUS_MAP = {
  ok: STATUS_SUCCESS,
  warn: STATUS_WARNING,
  error: STATUS_ERROR,
} as const;

const ALERTS = [
  { severity: 'warn' as const, msg: 'Rarity inflation above 1.1x — consider tightening drop weights' },
  { severity: 'ok' as const, msg: 'Gold economy stable within 5% of target' },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function EconomyMicro() {
  const warnCount = ALERTS.filter((a) => a.severity === 'warn').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <TrendingUp className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{warnCount > 0 ? `${warnCount} alert` : 'Stable'}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EconomyCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ECONOMY_METRICS.map((m) => (
        <div key={m.label} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_MAP[m.status] }}
          />
          <span className="text-text-muted flex-1">{m.label}</span>
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
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Item economy simulator tracking gold influx, item sink rates, rarity inflation, and
        power curve health across level brackets.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Metrics */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={TrendingUp} label="Economy Metrics" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {ECONOMY_METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_MAP[m.status], boxShadow: `0 0 6px ${STATUS_MAP[m.status]}40` }}
                />
                <span className="text-text-muted flex-1">{m.label}</span>
                <span className="font-mono font-bold text-text">{m.value}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={ECONOMY_RADAR} size={140} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Alerts */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Economy Alerts</div>
        <div className="space-y-1.5">
          {ALERTS.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span
                className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: STATUS_MAP[a.severity] }}
              />
              <span className="text-text-muted">{a.msg}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemEconomyPanel({ featureMap, defs }: ItemEconomyPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Item Economy" icon={<TrendingUp className="w-4 h-4" />}>
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
