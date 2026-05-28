'use client';

import { useMemo, useState } from 'react';
import { Target, TrendingUp, TrendingDown, Check, Wrench } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_ORANGE,
  OPACITY_10, OPACITY_20, OPACITY_40,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  CRITICAL_PATH, ALL_PATHS, ZONE_PLAYTIME, formatPlaytime,
  type PlaytimePathMode,
} from '../_shared/data';
import {
  DEFAULT_TARGET_SEC, TARGET_MIN_SEC, TARGET_MAX_SEC, BUDGET_TOLERANCE,
  classifyZone, suggestLevers, type ZoneFlag,
} from './playtime-target';

interface Props {
  mode: PlaytimePathMode;
}

const FLAG_META: Record<ZoneFlag, { color: string; icon: typeof TrendingUp; label: string }> = {
  over: { color: STATUS_ERROR, icon: TrendingUp, label: 'Over budget' },
  under: { color: STATUS_WARNING, icon: TrendingDown, label: 'Under budget' },
  on: { color: STATUS_SUCCESS, icon: Check, label: 'On budget' },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function PlaytimeBudgetTargeter({ mode }: Props) {
  const [targetSec, setTargetSec] = useState<number>(DEFAULT_TARGET_SEC);

  const path = mode === 'critical' ? CRITICAL_PATH : ALL_PATHS;

  // Zones actually on this path, in time order.
  const pathZones = useMemo(() => {
    const onPath = new Set(path.nodes.map(n => n.zoneId));
    const order = new Map(path.nodes.map((n, i) => [n.zoneId, i]));
    return ZONE_PLAYTIME
      .filter(z => onPath.has(z.zoneId))
      .sort((a, b) => (order.get(a.zoneId) ?? 0) - (order.get(b.zoneId) ?? 0));
  }, [path]);

  // Even distribution of the global target across path zones, scaled by each
  // zone's existing relative weight (so hub zones don't get the same slice as
  // boss zones).
  const totalCurrent = pathZones.reduce((s, z) => s + z.totalSec, 0) || 1;
  const perZoneTarget = (zp: typeof pathZones[number]) =>
    targetSec * (zp.totalSec / totalCurrent);

  const overall = path.totalSec;
  const overallFlag = classifyZone(overall, targetSec);
  const overallMeta = FLAG_META[overallFlag];
  const deltaSec = overall - targetSec;

  const flagged = useMemo(() =>
    pathZones
      .map(z => {
        const tgt = perZoneTarget(z);
        const flag = classifyZone(z.totalSec, tgt);
        return { z, tgt, flag };
      })
      .filter(x => x.flag !== 'on'),
    // perZoneTarget closes over pathZones+targetSec; both are deps below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathZones, targetSec],
  );

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <SectionHeader icon={Target} label="Playtime Budget Targeting" color={ACCENT_ORANGE} />

      {/* Target input row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Critical-path target
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

      {/* Overall verdict */}
      <div
        className="flex items-center gap-3 rounded-md border px-3 py-2 mb-3"
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
            Critical path: {formatPlaytime(overall)} · target: {formatPlaytime(targetSec)} · tolerance ±{Math.round(BUDGET_TOLERANCE * 100)}%
          </span>
        </div>
        <span className="ml-auto text-sm font-mono font-bold tabular-nums" style={{ color: overallMeta.color }}>
          {deltaSec >= 0 ? '+' : '−'}{formatPlaytime(Math.abs(deltaSec))}
        </span>
      </div>

      {/* Per-zone offenders + concrete levers */}
      {flagged.length === 0 ? (
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center py-3 opacity-60">
          All path zones within ±{Math.round(BUDGET_TOLERANCE * 100)}% of their fair-share budget.
        </div>
      ) : (
        <ul className="space-y-2">
          {flagged.map(({ z, tgt, flag }) => {
            const meta = FLAG_META[flag];
            const Icon = meta.icon;
            const zoneDelta = z.totalSec - tgt;
            const levers = suggestLevers(z, tgt);
            return (
              <li
                key={z.zoneId}
                className="rounded-md border px-3 py-2"
                style={{
                  borderColor: withOpacity(meta.color, OPACITY_20),
                  backgroundColor: withOpacity(meta.color, OPACITY_10),
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
                    {z.zoneName}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                    {formatPlaytime(z.totalSec)} / {formatPlaytime(tgt)}
                  </span>
                  <span className="ml-auto text-xs font-mono font-bold tabular-nums" style={{ color: meta.color }}>
                    {zoneDelta >= 0 ? '+' : '−'}{formatPlaytime(Math.abs(zoneDelta))}
                  </span>
                </div>
                {levers.length > 0 && (
                  <ul className="mt-1.5 space-y-1 pl-1">
                    {levers.map((l, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-text-muted" />
                        <span className="text-[11px] font-mono text-text-muted leading-snug">
                          <span className="font-bold" style={{ color: meta.color }}>{l.label}</span>
                          <span className="opacity-70"> — {l.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </BlueprintPanel>
  );
}
