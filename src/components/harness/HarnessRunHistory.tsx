'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, GitCompareArrows, Loader2, RefreshCw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import {
  ACCENT_RED,
  OPACITY_15,
  STATUS_NEUTRAL,
  STATUS_SUCCESS,
  STATUS_WARNING,
  withOpacity,
} from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';
import type { RunDiff, AreaDiffEntry } from '@/lib/harness/run-diff';

interface RunsResponse { runs: HarnessRunSummary[] }

const STATUS_TONE: Record<HarnessRunSummary['status'], string> = {
  running: STATUS_WARNING,
  paused: STATUS_NEUTRAL,
  completed: STATUS_SUCCESS,
  error: ACCENT_RED,
};

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits)}%`;
}

function deltaTone(value: number, betterWhenLower = false): string {
  if (Math.abs(value) < 1e-6) return STATUS_NEUTRAL;
  const isPositive = value > 0;
  const good = betterWhenLower ? !isPositive : isPositive;
  return good ? STATUS_SUCCESS : ACCENT_RED;
}

function deltaArrow(value: number): string {
  if (Math.abs(value) < 1e-6) return '·';
  return value > 0 ? '▲' : '▼';
}

function fmtSignedNumber(value: number, decimals = 0): string {
  const abs = Math.abs(value).toFixed(decimals);
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${abs}`;
}

function fmtSignedUsd(value: number): string {
  return `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(4)}`;
}

function fmtSignedPct(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;
}

function fmtSignedDuration(value: number | null): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : '−'}${fmtDuration(Math.abs(value))}`;
}

function StatusPill({ status }: { status: HarnessRunSummary['status'] }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border"
      style={{ color: tone, background: withOpacity(tone, OPACITY_15), borderColor: tone }}
    >
      {status}
    </span>
  );
}

/**
 * Compact list of past harness runs with a two-row compare action. Each row
 * shows pass-rate, cost, duration, and status. The operator can pick a base
 * (A) + head (B) and surface the run-vs-run diff inline.
 */
export function HarnessRunHistory() {
  const [runs, setRuns] = useState<HarnessRunSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [headId, setHeadId] = useState<string | null>(null);
  const [diff, setDiff] = useState<RunDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tryApiFetch<RunsResponse>('/api/harness/runs').then((r) => {
      if (cancelled) return;
      if (r.ok) { setRuns(r.data.runs); setError(null); }
      else setError(r.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshTick]);

  const canCompare = baseId && headId && baseId !== headId;

  async function runCompare() {
    if (!baseId || !headId) return;
    setDiffLoading(true); setDiffError(null); setDiff(null);
    const r = await tryApiFetch<RunDiff>(`/api/harness/runs/diff?a=${encodeURIComponent(baseId)}&b=${encodeURIComponent(headId)}`);
    if (r.ok) setDiff(r.data); else setDiffError(r.error);
    setDiffLoading(false);
  }

  function pick(slot: 'A' | 'B', id: string) {
    if (slot === 'A') {
      setBaseId((prev) => (prev === id ? null : id));
    } else {
      setHeadId((prev) => (prev === id ? null : id));
    }
  }

  const empty = !loading && !error && runs && runs.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <span>Run history — every harness start is recorded with its plan, progress, guide and cost snapshot. Pick two runs to compare.</span>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border/40 text-text-muted hover:text-text focus-ring"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </header>

      <CompareBar
        baseId={baseId}
        headId={headId}
        runs={runs ?? []}
        onCompare={runCompare}
        canCompare={!!canCompare}
        loading={diffLoading}
      />

      {loading && (
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading runs…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: ACCENT_RED }}>
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
      {empty && (
        <div className="text-text-muted text-xs italic">
          No runs yet — start the harness to record the first one.
        </div>
      )}

      {runs && runs.length > 0 && (
        <RunTable
          runs={runs}
          baseId={baseId}
          headId={headId}
          onPick={pick}
        />
      )}

      {diffError && (
        <div className="flex items-center gap-2 text-xs" style={{ color: ACCENT_RED }}>
          <AlertTriangle className="w-3 h-3" /> {diffError}
        </div>
      )}
      {diff && <DiffPanel diff={diff} />}
    </div>
  );
}

function CompareBar(props: {
  baseId: string | null;
  headId: string | null;
  runs: HarnessRunSummary[];
  onCompare: () => void;
  canCompare: boolean;
  loading: boolean;
}) {
  const { baseId, headId, runs, onCompare, canCompare, loading } = props;
  const baseRun = useMemo(() => runs.find((r) => r.runId === baseId), [runs, baseId]);
  const headRun = useMemo(() => runs.find((r) => r.runId === headId), [runs, headId]);

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border/40 bg-surface-deep/30">
      <SlotChip slot="A" run={baseRun} />
      <ArrowRight className="w-3 h-3 text-text-muted" />
      <SlotChip slot="B" run={headRun} />
      <button
        type="button"
        onClick={onCompare}
        disabled={!canCompare || loading}
        className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: canCompare ? STATUS_SUCCESS : 'transparent', color: canCompare ? STATUS_SUCCESS : undefined }}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCompareArrows className="w-3 h-3" />}
        Compare
      </button>
    </div>
  );
}

function SlotChip({ slot, run }: { slot: 'A' | 'B'; run: HarnessRunSummary | undefined }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-border/60 text-[10px] text-text-muted">
        {slot}
      </span>
      {run ? (
        <span className="font-mono">{run.runId.slice(-8)}</span>
      ) : (
        <span className="text-text-muted italic">pick a row</span>
      )}
    </div>
  );
}

function RunTable(props: {
  runs: HarnessRunSummary[];
  baseId: string | null;
  headId: string | null;
  onPick: (slot: 'A' | 'B', id: string) => void;
}) {
  const { runs, baseId, headId, onPick } = props;
  return (
    <div className="overflow-x-auto rounded border border-border/40">
      <table className="w-full text-xs">
        <thead className="bg-surface-deep/40 text-text-muted">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Compare</th>
            <th className="px-2 py-1.5 text-left font-medium">Run</th>
            <th className="px-2 py-1.5 text-left font-medium">Started</th>
            <th className="px-2 py-1.5 text-left font-medium">Status</th>
            <th className="px-2 py-1.5 text-right font-medium">Pass</th>
            <th className="px-2 py-1.5 text-right font-medium">Areas</th>
            <th className="px-2 py-1.5 text-right font-medium">Duration</th>
            <th className="px-2 py-1.5 text-right font-medium">Cost</th>
            <th className="px-2 py-1.5 text-right font-medium">Sess.</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const isA = r.runId === baseId;
            const isB = r.runId === headId;
            return (
              <tr key={r.runId} className="border-t border-border/20 hover:bg-surface-deep/20">
                <td className="px-2 py-1.5 flex gap-1">
                  <SlotButton label="A" active={isA} onClick={() => onPick('A', r.runId)} />
                  <SlotButton label="B" active={isB} onClick={() => onPick('B', r.runId)} />
                </td>
                <td className="px-2 py-1.5 font-mono text-text">{r.runId.slice(-8)}</td>
                <td className="px-2 py-1.5 text-text-muted">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="px-2 py-1.5"><StatusPill status={r.status} /></td>
                <td className="px-2 py-1.5 text-right text-text tabular-nums">
                  {fmtPct(r.passRate, 0)}
                  <span className="text-text-muted"> · {r.passingFeatures}/{r.totalFeatures}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span style={{ color: STATUS_SUCCESS }}>{r.completedAreas}</span>
                  {r.failedAreas > 0 && <> <span style={{ color: ACCENT_RED }}>·{r.failedAreas}</span></>}
                  <span className="text-text-muted">/{r.totalAreas}</span>
                </td>
                <td className="px-2 py-1.5 text-right text-text-muted tabular-nums">{fmtDuration(r.durationMs)}</td>
                <td className="px-2 py-1.5 text-right text-text tabular-nums">{fmtUsd(r.spentUsd)}</td>
                <td className="px-2 py-1.5 text-right text-text-muted tabular-nums">{r.sessions}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlotButton({ label, active, onClick }: { label: 'A' | 'B'; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="w-5 h-5 inline-flex items-center justify-center rounded-full border text-[10px] focus-ring"
      style={{
        borderColor: active ? STATUS_SUCCESS : undefined,
        color: active ? STATUS_SUCCESS : undefined,
        background: active ? withOpacity(STATUS_SUCCESS, OPACITY_15) : undefined,
      }}
    >
      {label}
    </button>
  );
}

function DiffPanel({ diff }: { diff: RunDiff }) {
  return (
    <div className="space-y-3 p-3 rounded border border-border/40 bg-surface-deep/30">
      <div className="flex items-baseline gap-2 text-xs text-text-muted">
        <span className="font-mono text-text">{diff.base.runId.slice(-8)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-mono text-text">{diff.head.runId.slice(-8)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <DeltaTile label="Pass rate" value={fmtSignedPct(diff.passRateDelta)} sub={`${fmtPct(diff.passRateA, 0)} → ${fmtPct(diff.passRateB, 0)}`} tone={deltaTone(diff.passRateDelta)} arrow={diff.passRateDelta} />
        <DeltaTile label="Features" value={fmtSignedNumber(diff.passingDelta)} sub={`passing — total ${fmtSignedNumber(diff.totalFeaturesDelta)}`} tone={deltaTone(diff.passingDelta)} arrow={diff.passingDelta} />
        <DeltaTile label="Cost" value={fmtSignedUsd(diff.costDeltaUsd)} sub={`${diff.sessionDelta >= 0 ? '+' : '−'}${Math.abs(diff.sessionDelta)} sessions`} tone={deltaTone(diff.costDeltaUsd, /*betterWhenLower*/ true)} arrow={diff.costDeltaUsd} />
        <DeltaTile label="Duration" value={fmtSignedDuration(diff.durationMsDelta)} sub={diff.iterationDelta !== 0 ? `${fmtSignedNumber(diff.iterationDelta)} iterations` : 'same iterations'} tone={deltaTone(diff.durationMsDelta ?? 0, /*betterWhenLower*/ true)} arrow={diff.durationMsDelta ?? 0} />
        <DeltaTile label="Regressions" value={String(diff.regressed.length)} sub={`${diff.improved.length} improved`} tone={diff.regressed.length > 0 ? ACCENT_RED : STATUS_SUCCESS} arrow={diff.regressed.length} />
      </div>

      {diff.regressed.length > 0 && (
        <AreaList title="Regressed" tone={ACCENT_RED} areas={diff.regressed} />
      )}
      {diff.improved.length > 0 && (
        <AreaList title="Improved" tone={STATUS_SUCCESS} areas={diff.improved} />
      )}
      {(diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {diff.added.length > 0 && <AreaList title="Added" tone={STATUS_NEUTRAL} areas={diff.added} />}
          {diff.removed.length > 0 && <AreaList title="Removed" tone={STATUS_NEUTRAL} areas={diff.removed} />}
        </div>
      )}
      {diff.regressed.length === 0 && diff.improved.length === 0 && diff.added.length === 0 && diff.removed.length === 0 && (
        <div className="text-xs text-text-muted italic">No per-area changes between these runs.</div>
      )}
    </div>
  );
}

function DeltaTile(props: { label: string; value: string; sub: string; tone: string; arrow: number }) {
  return (
    <div className="rounded border border-border/30 p-2 bg-surface-deep/20">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{props.label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-[10px]" style={{ color: props.tone }}>{deltaArrow(props.arrow)}</span>
        <span className="text-sm tabular-nums" style={{ color: props.tone }}>{props.value}</span>
      </div>
      <div className="text-[10px] text-text-muted">{props.sub}</div>
    </div>
  );
}

function AreaList({ title, tone, areas }: { title: string; tone: string; areas: AreaDiffEntry[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: tone }}>{title} ({areas.length})</div>
      <ul className="space-y-0.5 text-xs">
        {areas.map((a) => (
          <li key={a.areaId} className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-border/20">
            <span className="truncate">{a.label}</span>
            <span className="tabular-nums text-text-muted">
              {a.passingA}/{a.totalA} → {a.passingB}/{a.totalB}
              {' '}
              <span style={{ color: tone }}>({fmtSignedPct((a.passRateB - a.passRateA) * 100)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
