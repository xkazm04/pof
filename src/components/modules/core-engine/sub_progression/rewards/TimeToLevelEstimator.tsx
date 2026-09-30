'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';
import {
  PLAYSTYLES, cumulativeMinutes, daysToMax, minutesPerLevel, pacingModel, xpPerMinAt,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';

const PLAYSTYLE_COLORS: Record<(typeof PLAYSTYLES)[number]['id'], string> = {
  casual: ACCENT_CYAN,
  hardcore: STATUS_ERROR,
};

interface TimeToLevelEstimatorProps {
  baseXp: number;
  curveExp: number;
}

/** Time-to-level derived from the live curve under the stated earn-rate assumption. */
export function TimeToLevelEstimator({ baseXp, curveExp }: TimeToLevelEstimatorProps) {
  const model = useMemo(() => pacingModel(baseXp, curveExp), [baseXp, curveExp]);

  const { stats, rows } = useMemo(() => {
    const mins = minutesPerLevel(model);
    const cum = cumulativeMinutes(model);
    const days = PLAYSTYLES.map((p) => daysToMax(model, p.minutesPerDay));
    const longest = Math.max(...days, 0);
    return {
      stats: [
        { label: 'XP/min @ cap', value: Math.round(xpPerMinAt(model, model.maxLevel)).toLocaleString() },
        { label: `Min for L${model.maxLevel}`, value: (mins[mins.length - 1] ?? 0).toFixed(2) },
        { label: 'Hours to max', value: (cum[cum.length - 1] / 60).toFixed(2) },
      ],
      rows: PLAYSTYLES.map((p, i) => ({
        ...p,
        days: days[i],
        widthPct: longest > 0 ? (days[i] / longest) * 100 : 0,
      })),
    };
  }, [model]);

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={Clock} label="Time-to-Level Estimator" color={ACCENT} />

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface/50 rounded-lg p-2 border border-border/30 text-center">
            <div className="text-sm font-mono font-bold" style={{ color: ACCENT }}>{s.value}</div>
            <div className="text-2xs font-mono text-text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <p data-testid="ttl-rate-basis" className="mt-2 text-2xs font-mono text-text-muted">
        Assumed rate: {model.xpPerMinAtL1} XP/min at L1 x L^{model.rateGrowth}; XP per level from the Curves tab (base {baseXp}, exp {curveExp}).
      </p>

      <div className="mt-3 pt-4 border-t border-border/40 space-y-3">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Playstyle Comparison</div>
        {rows.map((t) => {
          const color = PLAYSTYLE_COLORS[t.id];
          return (
            <div key={t.id} data-testid={`ttl-row-${t.id}`} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text">{t.label}</span>
                <span className="font-bold" style={{ color }}>{t.days.toFixed(2)} days to max</span>
              </div>
              <div className="relative h-3 bg-surface-deep rounded-full overflow-hidden border border-border/30">
                <div
                  data-testid={`ttl-bar-${t.id}`}
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                  style={{ width: `${t.widthPct}%`, backgroundColor: color, opacity: 0.6 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
