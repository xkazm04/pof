'use client';

import { useMemo, useState } from 'react';
import { Target, TrendingUp, TrendingDown, Check, RotateCcw } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_ORANGE,
  OPACITY_10, OPACITY_20, OPACITY_40,
  withOpacity,
} from '@/lib/chart-colors';
import { computeCumulativePath, type WorldModel } from '@/lib/world/world-model';
import type { ScenarioAction, WorldLever } from '@/lib/world/playtime-scenario';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { formatPlaytime, type PlaytimePathMode } from '../_shared/data';
import {
  DEFAULT_TARGET_SEC, TARGET_MIN_SEC, TARGET_MAX_SEC, BUDGET_TOLERANCE,
  classifyZone, buildBudgetReport, type ZoneFlag,
} from './playtime-target';
import { LeverList } from './LeverList';

interface Props {
  mode: PlaytimePathMode;
  /** The what-if scenario (the baseline itself when no lever is applied). */
  world: WorldModel;
  baseline: WorldModel;
  applied: readonly WorldLever[];
  dispatch: (action: ScenarioAction) => void;
}

const FLAG_META: Record<ZoneFlag, { color: string; icon: typeof TrendingUp; label: string }> = {
  over: { color: STATUS_ERROR, icon: TrendingUp, label: 'Over budget' },
  under: { color: STATUS_WARNING, icon: TrendingDown, label: 'Under budget' },
  on: { color: STATUS_SUCCESS, icon: Check, label: 'On budget' },
};

const signed = (sec: number) => `${sec >= 0 ? '+' : '−'}${formatPlaytime(Math.abs(sec))}`;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function PlaytimeBudgetTargeter({ mode, world, baseline, applied, dispatch }: Props) {
  const [targetSec, setTargetSec] = useState<number>(DEFAULT_TARGET_SEC);

  const overall = useMemo(() => computeCumulativePath(world, mode).totalSec, [world, mode]);
  const baselineTotal = useMemo(() => computeCumulativePath(baseline, mode).totalSec, [baseline, mode]);
  const report = useMemo(
    () => buildBudgetReport(world, baseline, mode, targetSec, applied),
    [world, baseline, mode, targetSec, applied],
  );
  const chainNames = useMemo(() => {
    const nameById = new Map(world.zones.map((z) => [z.id, z.name]));
    return report.chain.map((id) => nameById.get(id) ?? id);
  }, [world, report.chain]);

  const overallFlag = classifyZone(overall, targetSec);
  const overallMeta = FLAG_META[overallFlag];
  const pathLabel = mode === 'critical' ? 'Critical path' : 'All paths';
  const tolerancePct = Math.round(BUDGET_TOLERANCE * 100);

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <SectionHeader icon={Target} label="Playtime Budget Targeting" color={ACCENT_ORANGE} />

      {/* Target input row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {pathLabel} target
          </span>
          <input
            type="number"
            min={Math.ceil(TARGET_MIN_SEC / 60)}
            max={Math.floor(TARGET_MAX_SEC / 60)}
            step={5}
            value={Math.round(targetSec / 60)}
            onChange={(e) => setTargetSec(clamp(Number(e.target.value) * 60, TARGET_MIN_SEC, TARGET_MAX_SEC))}
            className="w-20 px-2 py-1 text-sm font-mono bg-surface-deep border rounded focus-ring"
            style={{ borderColor: withOpacity(ACCENT_ORANGE, OPACITY_40), color: ACCENT_ORANGE }}
            aria-label="Target minutes"
          />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">min</span>
        </label>
        <input
          type="range"
          min={TARGET_MIN_SEC}
          max={TARGET_MAX_SEC}
          step={300}
          value={targetSec}
          onChange={(e) => setTargetSec(Number(e.target.value))}
          className="flex-1 min-w-[160px] h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: ACCENT_ORANGE }}
          aria-label="Target seconds slider"
        />
        <span className="text-xs font-mono tabular-nums uppercase tracking-[0.15em]" style={{ color: ACCENT_ORANGE }}>
          {formatPlaytime(targetSec)}
        </span>
      </div>

      {/* Overall verdict (priced on the scenario) */}
      <div
        className="flex items-center gap-3 rounded-md border px-3 py-2 mb-2"
        style={{
          borderColor: withOpacity(overallMeta.color, OPACITY_40),
          backgroundColor: withOpacity(overallMeta.color, OPACITY_10),
        }}
      >
        <overallMeta.icon className="w-4 h-4 flex-shrink-0" style={{ color: overallMeta.color }} />
        <div className="flex flex-col">
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: overallMeta.color }}>
            {overallMeta.label}
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {pathLabel}: {formatPlaytime(overall)} · target: {formatPlaytime(targetSec)} · tolerance ±{tolerancePct}%
          </span>
        </div>
        <span className="ml-auto text-sm font-mono font-bold tabular-nums" style={{ color: overallMeta.color }}>
          {signed(overall - targetSec)}
        </span>
      </div>

      {applied.length > 0 && (
        <div data-testid="playtime-vs-baseline" className="flex items-center gap-2 mb-2 px-1 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_ORANGE }}>
          <span className="font-bold tabular-nums">vs baseline {signed(overall - baselineTotal)}</span>
          <span className="text-text-muted">
            {formatPlaytime(baselineTotal)} → {formatPlaytime(overall)} · {applied.length} lever{applied.length === 1 ? '' : 's'} applied
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'reset' })}
            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border focus-ring"
            style={{ borderColor: withOpacity(ACCENT_ORANGE, OPACITY_40) }}
          >
            <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      )}

      <p className="mb-3 px-1 text-xs font-mono text-text-muted opacity-70">
        Budgets split by level span over the {chainNames.length} zone{chainNames.length === 1 ? '' : 's'} that set the total: {chainNames.join(' → ') || '—'}
      </p>

      {/* Per-zone offenders + applicable levers */}
      {report.rows.length === 0 ? (
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center py-3 opacity-60">
          Every zone on the path is within ±{tolerancePct}% of its level-span budget.
        </div>
      ) : (
        <ul className="space-y-2">
          {report.rows.map((row) => {
            const meta = FLAG_META[row.flag];
            const Icon = meta.icon;
            const moved = Math.abs(row.actualSec - row.baselineSec) > 0.05;
            return (
              <li
                key={row.zoneId}
                data-testid={`playtime-zone-${row.zoneId}`}
                className="rounded-md border px-3 py-2"
                style={{
                  borderColor: withOpacity(meta.color, OPACITY_20),
                  backgroundColor: withOpacity(meta.color, OPACITY_10),
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
                    {row.zoneName}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                    {formatPlaytime(row.actualSec)} / {formatPlaytime(row.budgetSec)}
                    {moved && <span className="opacity-70"> (was {formatPlaytime(row.baselineSec)})</span>}
                  </span>
                  <span className="ml-auto text-xs font-mono font-bold tabular-nums" style={{ color: meta.color }}>
                    {row.flag === 'on' ? meta.label : signed(row.actualSec - row.budgetSec)}
                  </span>
                </div>
                <LeverList
                  levers={row.levers}
                  applied={applied}
                  color={meta.color}
                  onToggle={(lever) => dispatch({ type: 'toggle', lever })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </BlueprintPanel>
  );
}
