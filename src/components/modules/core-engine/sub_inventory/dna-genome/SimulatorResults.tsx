'use client';

import { motion } from 'framer-motion';
import { Activity, Sparkles, Dna } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_PINK, withOpacity,
  OPACITY_10, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import { SectionHeader, CornerBrackets, NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import { ACCENT, AXIS_CONFIGS } from './data';

const GOD_ROLL_THRESHOLD = 0.85;

// NOTE: `SimulationStats` type cannot be imported from rolling-engine — the
// module's exports are broken upstream (pre-existing baseline error in
// MonteCarloSimulator). Use a structural type to avoid duplicating the
// broken import here.
interface SimulationStats {
  avgCoherence: number;
  avgAffixCount: number;
  observedMutationRate: number;
  configuredMutationRate: number;
  godRollProbability: number;
  coherenceHistogram: number[];
  iterations: number;
  axisFrequency: Record<string, number>;
  affixFrequency: Record<string, {
    perRoll: number;
    appearances: number;
    affix: { id: string; name: string; axis: string; isPrefix: boolean };
  }>;
}

interface Props {
  stats: SimulationStats;
}

export function SimulatorResults({ stats }: Props) {
  const histogramMax = Math.max(1, ...stats.coherenceHistogram);

  const sortedAffixes = Object.values(stats.affixFrequency)
    .sort((a, b) => b.perRoll - a.perRoll);

  const mutationDelta = stats.observedMutationRate - stats.configuredMutationRate;
  const mutationDeltaColor = Math.abs(mutationDelta) < 0.02
    ? STATUS_SUCCESS
    : Math.abs(mutationDelta) < 0.05 ? STATUS_WARNING : STATUS_ERROR;

  return (
    <div className="space-y-3">
      {/* Top-line stats */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryStat
          label="Avg Coherence"
          value={`${(stats.avgCoherence * 100).toFixed(1)}%`}
          color={stats.avgCoherence > 0.6 ? STATUS_SUCCESS : stats.avgCoherence > 0.3 ? STATUS_WARNING : STATUS_ERROR}
        />
        <SummaryStat
          label="Avg Affixes"
          value={stats.avgAffixCount.toFixed(2)}
          color={ACCENT}
        />
        <SummaryStat
          label="Observed Mut."
          value={`${(stats.observedMutationRate * 100).toFixed(1)}%`}
          sub={`cfg ${(stats.configuredMutationRate * 100).toFixed(0)}% · Δ ${mutationDelta >= 0 ? '+' : ''}${(mutationDelta * 100).toFixed(1)}pp`}
          color={mutationDeltaColor}
        />
        <SummaryStat
          label="God-Roll"
          value={`${(stats.godRollProbability * 100).toFixed(2)}%`}
          sub={`≥${(GOD_ROLL_THRESHOLD * 100).toFixed(0)}% coherent + max affixes`}
          color={ACCENT_PINK}
        />
      </div>

      {/* Coherence histogram */}
      <div className="space-y-1.5">
        <SectionHeader icon={Activity} label="Coherence Histogram" color={ACCENT} />
        <div className="flex items-end gap-0.5 h-24 px-1">
          {stats.coherenceHistogram.map((count, i) => {
            const pct = (count / histogramMax) * 100;
            const sharePct = (count / stats.iterations) * 100;
            const bucketLo = i * 10;
            const bucketHi = (i + 1) * 10;
            const bucketColor = bucketLo >= 60 ? STATUS_SUCCESS : bucketLo >= 30 ? STATUS_WARNING : STATUS_ERROR;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end group relative"
                title={`${bucketLo}-${bucketHi}% coherent: ${count} rolls (${sharePct.toFixed(1)}%)`}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.4, delay: i * 0.03 }}
                  className="w-full rounded-t"
                  style={{
                    backgroundColor: withOpacity(bucketColor, OPACITY_37),
                    borderTop: `1px solid ${bucketColor}`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between px-1">
          {[0, 25, 50, 75, 100].map((v) => (
            <span key={v} className="text-xs font-mono text-text-muted/60">{v}%</span>
          ))}
        </div>
      </div>

      {/* Per-axis frequency */}
      <div className="space-y-1.5">
        <SectionHeader icon={Sparkles} label="Observed Axis Frequency" color={ACCENT} />
        <div className="space-y-1">
          {AXIS_CONFIGS.map((cfg) => {
            const pct = stats.axisFrequency[cfg.axis] * 100;
            return (
              <div key={cfg.axis} className="grid grid-cols-[110px_1fr_56px] items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <cfg.icon className="w-3 h-3" style={{ color: cfg.color }} />
                  <span className="text-xs font-mono uppercase tracking-[0.12em]" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
                <NeonBar pct={pct} color={cfg.color} height={6} />
                <span className="text-xs font-mono font-bold text-right tabular-nums" style={{ color: cfg.color }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-affix frequency */}
      <div className="space-y-1.5">
        <SectionHeader icon={Dna} label="Per-Affix Frequency (avg per roll)" color={ACCENT} />
        <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {sortedAffixes.length === 0 && (
            <p className="text-xs text-text-muted italic">No affixes rolled (rarity floor produces 0 slots)</p>
          )}
          {sortedAffixes.map((entry) => {
            const cfg = AXIS_CONFIGS.find((c) => c.axis === entry.affix.axis);
            const color = cfg?.color ?? ACCENT;
            const pct = entry.perRoll * 100;
            const barPct = Math.min(100, entry.perRoll * 100);
            return (
              <div
                key={entry.affix.id}
                className="relative grid grid-cols-[150px_1fr_72px_44px] items-center gap-2 px-2 py-0.5 rounded text-xs font-mono overflow-hidden"
                style={{ backgroundColor: withOpacity(color, OPACITY_10) }}
              >
                <CornerBrackets color={color} size={5} />
                <span className="font-bold truncate" style={{ color }}>
                  {entry.affix.isPrefix ? entry.affix.name : `Item ${entry.affix.name}`}
                </span>
                <NeonBar pct={barPct} color={color} height={4} />
                <span className="text-text-muted text-right tabular-nums">
                  {entry.appearances.toLocaleString()}
                </span>
                <span className="font-bold text-right tabular-nums" style={{ color }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Small summary tile (local helper) ─────────────────────────────────── */

function SummaryStat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div
      className="relative p-2 rounded-md border overflow-hidden"
      style={{
        borderColor: withOpacity(color, OPACITY_20),
        backgroundColor: withOpacity(color, OPACITY_10),
      }}
    >
      <CornerBrackets color={color} size={6} />
      <div className="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="text-base font-mono font-bold tabular-nums leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs font-mono text-text-muted/70 truncate" title={sub}>{sub}</div>}
    </div>
  );
}
