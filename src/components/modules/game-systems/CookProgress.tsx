'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, type ListImperativeAPI, type RowComponentProps } from 'react-window';
import { AlertCircle, ArrowDown, Check, CheckCircle2, Copy, XCircle } from 'lucide-react';
import type { CookEvent, CookPhase } from '@/lib/packaging/cook-executor';
import { STATUS_SUCCESS, STATUS_ERROR, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { formatDuration } from '@/lib/format';
import { UI_TIMEOUTS } from '@/lib/constants';
import { CountUp } from '@/components/modules/core-engine/sub_world/_shared/CountUp';

interface CookProgressProps {
  request: { profileId: string; projectPath: string; projectName: string; ueVersion: string } | null;
  onComplete?: (result: { status: 'success' | 'failed'; exePath?: string; error?: string }) => void;
}

const PHASE_LABELS: Record<CookPhase, string> = {
  cook: 'Cooking',
  stage: 'Staging',
  package: 'Packaging',
  done: 'Finished',
};

/**
 * Keep a generous tail of the cook stream. RunUAT emits thousands of lines, so
 * the viewer is virtualized (react-window) and only the freshest window is
 * retained — the line that kills a cook is always near the end, and warnings are
 * scattered throughout, so the most-recent {@link MAX_LOG_LINES} cover the hunt.
 */
const MAX_LOG_LINES = 2000;

/** Fixed row height (px) — single-line rows keep virtualization cheap + exact. */
const LOG_ROW_HEIGHT = 18;
/** Log viewport height (px). */
const LOG_VIEWPORT_HEIGHT = 192;
/** Distance from the bottom (px) still treated as "pinned" for auto-scroll. */
const PIN_THRESHOLD_PX = 24;

export type CookLogSeverity = 'error' | 'warning' | 'info';

/** A parsed cook log line: raw text + the elapsed timestamp, phase, and severity. */
export interface CookLogLine {
  /** Monotonic id (stable virtualization key). */
  id: number;
  /** Raw UAT line. */
  line: string;
  /** Elapsed ms since cook start (from the `log` event's `t`). */
  t: number;
  /** Cook phase active when the line arrived — drives the Cook/Stage filters. */
  phase: CookPhase | null;
  /** Classified severity — drives the colored left border + Errors/Warnings filters. */
  severity: CookLogSeverity;
}

/** The log filter facets shown above the console. */
export type CookLogFilter = 'all' | 'error' | 'warning' | 'cook' | 'stage';

/**
 * Classify a raw cook log line by severity so the console can color it. RunUAT /
 * the UE cook commandlet print verbosity inline (`LogFoo: Error:`, `Warning:`),
 * so a word-boundary keyword match is enough — errors win over warnings, and
 * everything else is muted info. Pure + exported so the coloring is unit-tested.
 */
export function classifyCookLogLine(line: string): CookLogSeverity {
  if (/\b(error|errors|fail|failed|failure|fatal|exception|crash|crashed|abort|aborted)\b/i.test(line)) {
    return 'error';
  }
  if (/\b(warn|warning|warnings|deprecated|deprecation)\b/i.test(line)) {
    return 'warning';
  }
  return 'info';
}

/**
 * Append a parsed line, trimming to the newest `max` so the buffer never grows
 * without bound. Pure + exported so the cap behavior is unit-tested without
 * driving thousands of events through the component.
 */
export function appendCookLog(prev: CookLogLine[], entry: CookLogLine, max = MAX_LOG_LINES): CookLogLine[] {
  const next = [...prev, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Format an elapsed-ms timestamp as a zero-padded `MM:SS` prefix. Cooks can run
 * past an hour, so minutes simply keep counting (`125:30`) rather than wrapping.
 */
export function formatCookTimestamp(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Left-border accent per severity — red / amber / blue, per chart-colors tokens. */
const LOG_SEVERITY_BORDER: Record<CookLogSeverity, string> = {
  error: SEVERITY_TOKENS.critical.color, // red
  warning: SEVERITY_TOKENS.warning.color, // amber
  info: SEVERITY_TOKENS.info.color, // blue
};

/** Text tint: errors/warnings pop; info inherits the muted container color. */
const LOG_SEVERITY_TEXT: Record<CookLogSeverity, string | undefined> = {
  error: SEVERITY_TOKENS.critical.color,
  warning: SEVERITY_TOKENS.warning.color,
  info: undefined,
};

const FILTERS: ReadonlyArray<{ id: CookLogFilter; label: string; dot?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors', dot: SEVERITY_TOKENS.critical.color },
  { id: 'warning', label: 'Warnings', dot: SEVERITY_TOKENS.warning.color },
  { id: 'cook', label: 'Cook' },
  { id: 'stage', label: 'Stage' },
];

// ── Virtualized row ──────────────────────────────────────────────────────────

interface CookLogRowData {
  lines: CookLogLine[];
}

function CookLogRow({ index, style, lines, ariaAttributes }: RowComponentProps<CookLogRowData>) {
  const item = lines[index];
  if (!item) return null;
  const textColor = LOG_SEVERITY_TEXT[item.severity];
  return (
    <div
      {...ariaAttributes}
      style={{ ...style, borderLeftColor: LOG_SEVERITY_BORDER[item.severity] }}
      data-severity={item.severity}
      data-phase={item.phase ?? undefined}
      className="flex items-baseline gap-2 border-l-2 pl-2 pr-3 overflow-hidden"
      title={item.line}
    >
      <span className="shrink-0 tabular-nums text-text-muted select-none">{formatCookTimestamp(item.t)}</span>
      <span className="truncate" style={textColor ? { color: textColor } : undefined}>
        {item.line === '' ? ' ' : item.line}
      </span>
    </div>
  );
}

export function CookProgress({ request, onComplete }: CookProgressProps) {
  const [phase, setPhase] = useState<CookPhase | null>(null);
  const [percent, setPercent] = useState<number>(0);
  const [logs, setLogs] = useState<CookLogLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [result, setResult] = useState<{ status: 'success' | 'failed'; exePath?: string; error?: string } | null>(null);
  const [filter, setFilter] = useState<CookLogFilter>('all');
  // Stay pinned to the newest line, but release tailing the moment the user
  // scrolls up so they can read in peace (classic `tail -f` console behavior).
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const logIdRef = useRef(0);
  // Cursor that cycles "Jump to error" through each error in turn.
  const errorCursorRef = useRef(0);
  // Set when a jump is requested while the active filter hides errors — the jump
  // runs once the Errors view re-renders with rows.
  const pendingJumpRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase(null);
    setPercent(0);
    setLogs([]);
    setResult(null);
    setElapsedMs(0);
    setFilter('all');
    setAutoScroll(true);
    logIdRef.current = 0;
    errorCursorRef.current = 0;
    pendingJumpRef.current = false;
    startedAtRef.current = Date.now();

    (async () => {
      // Phase active as lines arrive — captured locally so each log is tagged
      // synchronously (state updates are async and would lag the stream).
      let currentPhase: CookPhase | null = null;
      try {
        const res = await fetch('/api/packaging/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const final = { status: 'failed' as const, error: `HTTP ${res.status}` };
          setResult(final);
          onComplete?.(final);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const data = part.replace(/^data:\s?/, '').trim();
            if (!data) continue;
            let ev: CookEvent;
            try { ev = JSON.parse(data) as CookEvent; } catch { continue; }
            if (ev.type === 'phase') { currentPhase = ev.phase; setPhase(ev.phase); }
            else if (ev.type === 'progress') setPercent(ev.percent);
            else if (ev.type === 'log') {
              const entry: CookLogLine = {
                id: logIdRef.current++,
                line: ev.line,
                t: typeof ev.t === 'number' ? ev.t : 0,
                phase: currentPhase,
                severity: classifyCookLogLine(ev.line),
              };
              setLogs((prev) => appendCookLog(prev, entry));
            } else if (ev.type === 'done') {
              const final = { status: 'success' as const, exePath: ev.exePath };
              setResult(final);
              onComplete?.(final);
            } else if (ev.type === 'error') {
              const final = { status: 'failed' as const, error: ev.message };
              setResult(final);
              onComplete?.(final);
            }
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const final = { status: 'failed' as const, error: err instanceof Error ? err.message : String(err) };
        setResult(final);
        onComplete?.(final);
      }
    })();

    return () => { ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // Live elapsed ticker: updates once a second while the cook runs, then stops
  // (and freezes to the exact total) once a result arrives.
  useEffect(() => {
    if (!request || result) return;
    const id = setInterval(() => {
      if (startedAtRef.current != null) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [request, result]);

  // Freeze the elapsed total the instant the cook finishes (any exit path).
  useEffect(() => {
    if (result && startedAtRef.current != null) setElapsedMs(Date.now() - startedAtRef.current);
  }, [result]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const counts = useMemo(() => {
    let error = 0, warning = 0, cook = 0, stage = 0;
    for (const l of logs) {
      if (l.severity === 'error') error++;
      else if (l.severity === 'warning') warning++;
      if (l.phase === 'cook') cook++;
      else if (l.phase === 'stage') stage++;
    }
    return { all: logs.length, error, warning, cook, stage } as Record<CookLogFilter, number>;
  }, [logs]);

  const displayedLines = useMemo(() => {
    switch (filter) {
      case 'error': return logs.filter((l) => l.severity === 'error');
      case 'warning': return logs.filter((l) => l.severity === 'warning');
      case 'cook': return logs.filter((l) => l.phase === 'cook');
      case 'stage': return logs.filter((l) => l.phase === 'stage');
      default: return logs;
    }
  }, [logs, filter]);

  // Positions of error rows within the *currently displayed* list (for jumping).
  const errorRows = useMemo(() => {
    const idx: number[] = [];
    displayedLines.forEach((l, i) => { if (l.severity === 'error') idx.push(i); });
    return idx;
  }, [displayedLines]);

  // Auto-tail: keep the newest line in view while pinned.
  useEffect(() => {
    if (!autoScroll) return;
    const n = displayedLines.length;
    if (n > 0) listRef.current?.scrollToRow({ index: n - 1, align: 'end' });
  }, [displayedLines, autoScroll]);

  // Finish a deferred jump once the Errors view has rows.
  useEffect(() => {
    if (!pendingJumpRef.current || errorRows.length === 0) return;
    pendingJumpRef.current = false;
    errorCursorRef.current = 1;
    listRef.current?.scrollToRow({ index: errorRows[0], align: 'center', behavior: 'smooth' });
  }, [errorRows]);

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
    // Releasing tailing the moment the user scrolls up is the whole point.
    setAutoScroll((prev) => (prev === nearBottom ? prev : nearBottom));
  }, []);

  const handleJumpToError = useCallback(() => {
    setAutoScroll(false); // jumping up means stop being yanked to the bottom
    if (errorRows.length === 0) {
      // Active filter hides errors → switch to the Errors view, then jump.
      pendingJumpRef.current = true;
      setFilter('error');
      return;
    }
    const pos = errorCursorRef.current % errorRows.length;
    errorCursorRef.current = pos + 1;
    listRef.current?.scrollToRow({ index: errorRows[pos], align: 'center', behavior: 'smooth' });
  }, [errorRows]);

  const handleCopyAll = useCallback(() => {
    const text = logs.map((l) => `[${formatCookTimestamp(l.t)}] ${l.line}`).join('\n');
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [logs]);

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
