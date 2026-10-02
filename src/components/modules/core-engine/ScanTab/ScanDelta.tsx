'use client';

import { useState } from 'react';
import { GitCompare, Loader2, AlertTriangle, CheckCircle, Undo2 } from 'lucide-react';
import { PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import type { ScanDeltaState } from '@/types/scan';
import { ACCENT } from './constants';

interface ScanDeltaProps {
  state: ScanDeltaState;
  /** Resolves the given ids server-side in ONE request. */
  onResolve: (ids: string[]) => Promise<void>;
  /** Ids of the last resolve this view made, offered for undo. */
  lastResolved: string[] | null;
  onUndo: () => Promise<void>;
  resolveError: string | null;
}

/**
 * The Re-Scan summary: the latest recorded scan reconciled against the findings
 * still open before it — what is new, what is still there, what the scan no
 * longer finds (resolvable in one click, undoable) — or, when the scan's report
 * never arrived, a plain statement of that instead of an earlier scan's result.
 */
export function ScanDelta({ state, onResolve, lastResolved, onUndo, resolveError }: ScanDeltaProps) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const undo = lastResolved && lastResolved.length > 0 && (
    <span className="flex items-center gap-1.5 text-xs text-text-muted">
      <CheckCircle className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
      Resolved {lastResolved.length}
      <button
        onClick={() => run(onUndo)}
        disabled={busy}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs hover:bg-surface-hover transition-colors disabled:opacity-50"
        style={{ color: ACCENT }}
      >
        <Undo2 className="w-3 h-3" />
        Undo
      </button>
    </span>
  );
  const error = resolveError && (
    <span className="text-2xs" style={{ color: STATUS_WARNING }} role="alert">{resolveError}</span>
  );

  if (state.status === 'none') {
    return undo || error ? <div className="flex items-center gap-3 flex-wrap">{undo}{error}</div> : null;
  }

  if (state.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} />
        Scan running — waiting for its report
      </div>
    );
  }

  if (state.status === 'unrecorded') {
    return (
      <div
        className="flex items-start gap-2 rounded-md px-3 py-2 text-xs border"
        style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}
        role="status"
      >
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          No scan recorded — {state.reason}. The findings below are from earlier scans, not this one.
        </span>
      </div>
    );
  }

  const { delta } = state;
  const at = new Date(delta.scan.createdAt);
  const passes = delta.scan.passes.map((p) => PASS_LABELS[p] ?? p).join(', ');
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-md px-3 py-2 border border-border text-xs">
      <GitCompare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
      <span className="text-text-muted" title={`${passes} · ${delta.scan.findingCount} finding(s)`}>
        Latest scan {Number.isNaN(at.getTime()) ? delta.scan.createdAt : at.toLocaleString()}
      </span>
      <span className="font-medium text-text">
        {`${delta.new.length} new · ${delta.persisting.length} still present · ${delta.cleared.length} no longer found`}
      </span>
      {delta.notRescanned.length > 0 && (
        <span className="text-text-muted" title="Their pass did not run in this scan, so they are neither cleared nor confirmed">
          {`${delta.notRescanned.length} not re-scanned`}
        </span>
      )}
      {delta.cleared.length > 0 && (
        <button
          onClick={() => run(() => onResolve(delta.cleared))}
          disabled={busy}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium border transition-colors disabled:opacity-50"
          style={{ color: STATUS_SUCCESS, borderColor: STATUS_SUCCESS }}
        >
          <CheckCircle className="w-3 h-3" />
          {`Resolve ${delta.cleared.length} no longer found`}
        </button>
      )}
      {undo}
      {error}
    </div>
  );
}
