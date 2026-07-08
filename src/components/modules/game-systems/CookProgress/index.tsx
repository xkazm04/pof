'use client';

import { List } from 'react-window';
import { AlertCircle, ArrowDown, Check, CheckCircle2, Copy, XCircle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { formatDuration } from '@/lib/format';
import { CountUp } from '@/components/modules/core-engine/sub_world/_shared/CountUp';
import { PHASE_LABELS, FILTERS, LOG_ROW_HEIGHT, LOG_VIEWPORT_HEIGHT } from './constants';
import { CookLogRow } from './CookLogRow';
import { useCookProgress } from './useCookProgress';
import type { CookLogRowData, CookProgressProps } from './types';

// Re-export the public API so `@/components/modules/game-systems/CookProgress`
// continues to resolve every original export via this folder index.
export { classifyCookLogLine, appendCookLog, formatCookTimestamp } from './helpers';
export type { CookLogSeverity, CookLogLine, CookLogFilter } from './types';

export function CookProgress({ request, onComplete }: CookProgressProps) {
  const {
    phase,
    percent,
    logs,
    counts,
    elapsedMs,
    result,
    filter,
    setFilter,
    autoScroll,
    setAutoScroll,
    copied,
    listRef,
    displayedLines,
    handleListScroll,
    handleJumpToError,
    handleCopyAll,
  } = useCookProgress({ request, onComplete });

  if (!request && !result) return null;

  // Spoken status: changes on phase transitions and on the final result, but
  // NOT on every percent tick — so screen readers stay informed without being
  // flooded by progress updates.
  const liveMessage = result
    ? result.status === 'success'
      ? `Cook succeeded.${result.exePath ? ` Output at ${result.exePath}.` : ''}`
      : `Cook failed.${result.error ? ` ${result.error}` : ''}`
    : phase
      ? `${PHASE_LABELS[phase]} in progress.`
      : 'Cook starting.';

  const running = !result && phase !== 'done';
  // Rough ETA: linear-extrapolate the remaining percent from the rate so far.
  const etaMs =
    running && percent > 0 && percent < 100 && elapsedMs > 0
      ? (elapsedMs * (100 - percent)) / percent
      : null;
  const etaLabel = etaMs != null ? `~${formatDuration(etaMs)}` : '—';

  const emptyMessage = logs.length === 0 ? 'Waiting for output…' : 'No matching lines';

  return (
    <div data-testid="pof-cook-progress" className="rounded border border-border p-3 bg-surface text-xs font-mono space-y-2">
      <div
        data-testid="pof-cook-progress-live"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {liveMessage}
      </div>

      <div className="flex items-center gap-3">
        <span
          data-testid="pof-cook-progress-phase"
          className={`font-semibold${running ? ' cook-phase-shimmer' : ''}`}
        >
          {phase ? PHASE_LABELS[phase] : 'Starting…'}
        </span>
        <div
          className="flex-1 h-1 bg-border rounded overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={phase ? `${PHASE_LABELS[phase]} progress` : 'Cook progress'}
        >
          <div
            data-testid="pof-cook-progress-percent"
            data-percent={percent}
            className="h-full bg-accent-strong transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <CountUp
          value={percent}
          format={(n) => `${n}%`}
          className="text-text-muted tabular-nums"
        />
      </div>

      <div className="flex items-center justify-between text-2xs text-text-muted tabular-nums">
        <span data-testid="pof-cook-progress-elapsed">
          {result ? 'Total' : 'Elapsed'} {formatDuration(elapsedMs)}
        </span>
        {running && (
          <span data-testid="pof-cook-progress-eta">ETA {etaLabel}</span>
        )}
      </div>

      {/* Log toolbar: severity/phase filters + tail lock + copy-all */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap text-2xs">
          <div role="group" aria-label="Filter cook log" className="flex items-center gap-1 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  data-testid={`pof-cook-log-filter-${f.id}`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                    active
                      ? 'border-border-bright bg-surface-hover text-text'
                      : 'border-border text-text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  {f.dot && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.dot }} aria-hidden="true" />
                  )}
                  {f.label}
                  <span className="tabular-nums opacity-70">{counts[f.id]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAutoScroll((v) => !v)}
              aria-pressed={autoScroll}
              data-testid="pof-cook-log-autoscroll"
              title={autoScroll ? 'Auto-scroll on — click to lock' : 'Auto-scroll locked — click to resume tailing'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                autoScroll
                  ? 'border-border-bright bg-surface-hover text-text'
                  : 'border-border text-text-muted hover:text-text hover:bg-surface-hover'
              }`}
            >
              <ArrowDown className="w-3 h-3" aria-hidden="true" />
              Tail
            </button>
            <button
              type="button"
              onClick={handleCopyAll}
              data-testid="pof-cook-log-copy"
              title="Copy all log lines with timestamps"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            >
              {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Virtualized log viewport with a sticky jump-to-error affordance */}
      <div className="relative" data-testid="pof-cook-progress-log">
        {displayedLines.length > 0 ? (
          <List<CookLogRowData>
            listRef={listRef}
            rowCount={displayedLines.length}
            rowHeight={LOG_ROW_HEIGHT}
            defaultHeight={LOG_VIEWPORT_HEIGHT}
            overscanCount={12}
            rowComponent={CookLogRow}
            rowProps={{ lines: displayedLines }}
            onScroll={handleListScroll}
            aria-label="Cook log output"
            className="text-2xs leading-snug text-text-muted"
            style={{ height: LOG_VIEWPORT_HEIGHT }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-2xs text-text-muted"
            style={{ height: LOG_VIEWPORT_HEIGHT }}
          >
            {emptyMessage}
          </div>
        )}

        {counts.error > 0 && (
          <button
            type="button"
            onClick={handleJumpToError}
            data-testid="pof-cook-log-jump-error"
            title="Jump to the next error"
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border shadow-lg backdrop-blur-sm transition-colors hover:brightness-110"
            style={{
              color: SEVERITY_TOKENS.critical.color,
              backgroundColor: SEVERITY_TOKENS.critical.bg,
              borderColor: SEVERITY_TOKENS.critical.border,
            }}
          >
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            Jump to error
            <span className="tabular-nums opacity-80">{counts.error}</span>
          </button>
        )}
      </div>

      {result && (
        <div
          data-testid="pof-cook-progress-result"
          data-status={result.status}
          className="flex items-center gap-1.5"
          style={{ color: result.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}
        >
          {result.status === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            : <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
          <span>
            {result.status === 'success'
              ? <>Cook succeeded: <span data-testid="pof-cook-progress-exe-path">{result.exePath}</span></>
              : <>Cook failed: {result.error}</>}
          </span>
        </div>
      )}
    </div>
  );
}
