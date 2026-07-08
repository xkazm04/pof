import { ArrowRight } from 'lucide-react';
import { ACCENT_RED, STATUS_NEUTRAL, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { RunDiff, AreaDiffEntry } from '@/lib/harness/run-diff';
import {
  deltaArrow,
  deltaTone,
  fmtPct,
  fmtSignedDuration,
  fmtSignedNumber,
  fmtSignedPct,
  fmtSignedUsd,
} from './helpers';

export function DiffPanel({ diff }: { diff: RunDiff }) {
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
