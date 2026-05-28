'use client';

import { GitCompareArrows, Plus, Check, Minus } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { ABComparisonResult, AlertDiffStatus, AlertDiffEntry } from '@/types/combat-simulator';

// ── Metric formatting ─────────────────────────────────────────────────────────

const pctOf1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const num1 = (v: number) => v.toFixed(1);
const sec = (v: number) => `${v.toFixed(1)}s`;
const signed = (v: number, fmt: (n: number) => string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

interface MetricSpec {
  label: string;
  baseline: number;
  candidate: number;
  delta: number;
  higherIsBetter: boolean;
  fmt: (v: number) => string;
}

/** Green when the delta moves the metric in its desired direction, red otherwise. */
function deltaTone(delta: number, higherIsBetter: boolean): string {
  if (delta === 0) return STATUS_NEUTRAL;
  return delta > 0 === higherIsBetter ? STATUS_SUCCESS : STATUS_ERROR;
}

// ── Alert-diff presentation ────────────────────────────────────────────────────

const DIFF_PRESENTATION: Record<AlertDiffStatus, { label: string; tone: string; Icon: typeof Plus }> = {
  appeared: { label: 'NEW', tone: STATUS_ERROR, Icon: Plus },
  disappeared: { label: 'FIXED', tone: STATUS_SUCCESS, Icon: Check },
  persisted: { label: 'STILL', tone: STATUS_NEUTRAL, Icon: Minus },
};

// ── Panel ──────────────────────────────────────────────────────────────────────

export function ABComparisonPanel({ comparison }: { comparison: ABComparisonResult }) {
  const { baseline, candidate, deltas, alertDiff } = comparison;

  const metrics: MetricSpec[] = [
    { label: 'Survival', baseline: baseline.summary.survivalRate, candidate: candidate.summary.survivalRate, delta: deltas.survivalRateDelta, higherIsBetter: true, fmt: pctOf1 },
    { label: 'Player DPS', baseline: baseline.summary.avgDPS, candidate: candidate.summary.avgDPS, delta: deltas.avgDPSDelta, higherIsBetter: true, fmt: num1 },
    { label: 'Avg Duration', baseline: baseline.summary.avgFightDurationSec, candidate: candidate.summary.avgFightDurationSec, delta: deltas.avgDurationDelta, higherIsBetter: false, fmt: sec },
    { label: 'One-Shot Rate', baseline: baseline.summary.oneShotRate, candidate: candidate.summary.oneShotRate, delta: deltas.oneShotRateDelta, higherIsBetter: false, fmt: pctOf1 },
  ];

  const appeared = alertDiff.filter((e) => e.status === 'appeared').length;
  const disappeared = alertDiff.filter((e) => e.status === 'disappeared').length;

  return (
    <SurfaceCard className="p-4 border-violet-400/30">
      <div className="flex items-center gap-2 mb-3">
        <GitCompareArrows className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-medium text-text">A/B Comparison</h2>
        {appeared > 0 && <Badge variant="error">{appeared} new alert{appeared === 1 ? '' : 's'}</Badge>}
        {disappeared > 0 && <Badge variant="success">{disappeared} resolved</Badge>}
      </div>

      {/* Scenario labels */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 mb-1.5 text-2xs">
        <span className="text-text-muted/60 uppercase tracking-wide">Metric</span>
        <div className="text-right">
          <div className="text-text-muted font-medium uppercase tracking-wide">{baseline.label}</div>
          <div className="text-text-muted/50 truncate" title={baseline.scenario.name}>{baseline.scenario.name}</div>
        </div>
        <div className="text-right">
          <div className="text-violet-400 font-medium uppercase tracking-wide">{candidate.label}</div>
          <div className="text-text-muted/50 truncate" title={candidate.scenario.name}>{candidate.scenario.name}</div>
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-1">
        {metrics.map((m) => {
          const tone = deltaTone(m.delta, m.higherIsBetter);
          return (
            <div key={m.label} className="grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 px-2 py-1.5 rounded bg-surface-deep/40">
              <span className="text-2xs text-text">{m.label}</span>
              <span className="text-2xs font-mono text-text-muted text-right">{m.fmt(m.baseline)}</span>
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-2xs font-mono text-text text-right">{m.fmt(m.candidate)}</span>
                <span
                  className="text-2xs font-mono w-14 text-right tabular-nums"
                  style={{ color: tone }}
                  aria-label={`${m.label} delta`}
                >
                  {m.delta === 0 ? '—' : signed(m.delta, m.fmt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance alert diff */}
      <div className="mt-4">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wide mb-1.5">
          Balance Alert Diff
        </div>
        {alertDiff.length === 0 ? (
          <div className="text-2xs text-text-muted/70 italic px-2 py-1.5">
            No balance alerts in either run.
          </div>
        ) : (
          <div className="space-y-1">
            {alertDiff.map((entry, i) => (
              <AlertDiffRow key={`${entry.type}-${i}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

function AlertDiffRow({ entry }: { entry: AlertDiffEntry }) {
  const { label, tone, Icon } = DIFF_PRESENTATION[entry.status];
  const showShift =
    entry.status === 'persisted' &&
    entry.baselineValue !== undefined &&
    entry.candidateValue !== undefined &&
    entry.baselineValue !== entry.candidateValue;

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: `${tone}14` }}>
      <span
        className="flex items-center gap-0.5 text-2xs font-mono font-semibold flex-shrink-0 w-12"
        style={{ color: tone }}
      >
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="text-2xs text-text-muted/90 flex-1">
        {entry.alert.message}
        {showShift && (
          <span className="ml-1 text-text-muted/60 font-mono">
            ({entry.baselineValue!.toFixed(2)} → {entry.candidateValue!.toFixed(2)})
          </span>
        )}
      </span>
    </div>
  );
}
