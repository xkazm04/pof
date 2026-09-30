import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { usePaneHold } from '@/hooks/usePaneHold';
import { type ListImperativeAPI } from 'react-window';
import type { CookPhase } from '@/lib/packaging/cook-executor';
import type { CookJobInfo, CookJobKind } from '@/lib/packaging/cook-jobs';
import { UI_TIMEOUTS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import { ZERO_COUNTS, PIN_THRESHOLD_PX } from './constants';
import { classifyCookLogLine, appendCookLog, lineFacets, formatCookTimestamp } from './helpers';
import { driveCookStream, COOK_JOBS_URL, type CookStreamHandlers, type CookStreamStart } from './cookJobStream';
import type { CookLogLine, CookLogFilter, CookLogCounts, CookProgressProps, CookCompletion } from './types';

/** The pane-hold reason the Activity Feed shows if the shell tears a cook down. */
export const COOK_HOLD_REASON = 'UE cook running';

/**
 * THE cook's pane-hold rule — the one place its hold is released. The cook holds
 * its keep-alive pane (`usePaneHold`) from the moment a request starts until the
 * cook SETTLES, and it settles when `result` is set. The single settle point is
 * AFTER the build is recorded: the `recorded` (or `record-error`) event that
 * follows `done`/`error`, a stream that ends first, or an HTTP failure. A bare
 * `done` does not settle — the server has yet to write the build row, and evicting
 * the pane then would drop the console before the row and its id exist. Move the
 * settle point here, nowhere else.
 *
 * The cook itself no longer depends on the hold: it is a server job
 * (`src/lib/packaging/cook-jobs.ts`) that outlives this component, and a remounted
 * console reattaches. The hold keeps the live console (and the batch chains that
 * wait on its settle) in place; an `attached` console holds it the same way.
 */
export function cookHoldsPane(
  request: CookProgressProps['request'],
  result: { status: 'success' | 'failed' } | null,
  attached = false,
): boolean {
  return (request != null || attached) && result === null;
}

export function useCookProgress({ request, projectPath, onComplete }: CookProgressProps) {
  const [phase, setPhase] = useState<CookPhase | null>(null);
  const [percent, setPercent] = useState<number>(0);
  const [logs, setLogs] = useState<CookLogLine[]>([]);
  // Per-facet tallies maintained incrementally (add on append, subtract on the
  // trimmed-off head) so a long cook never re-scans the full ≤2000-line buffer
  // just to recount. Identical to scanning `logs` from scratch each tick.
  const [counts, setCounts] = useState<CookLogCounts>(ZERO_COUNTS);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [result, setResult] = useState<CookCompletion | null>(null);
  const [filter, setFilter] = useState<CookLogFilter>('all');
  // Stay pinned to the newest line, but release tailing the moment the user
  // scrolls up so they can read in peace (classic `tail -f` console behavior).
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  // The server job this console follows; `attached` = found on the server, not
  // started by this console's own request.
  const [job, setJob] = useState<{ jobId: string; kind: CookJobKind } | null>(null);
  const [attached, setAttached] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const logIdRef = useRef(0);
  // Authoritative log buffer + running tallies, mutated synchronously per log
  // event so neither the spread nor the recount depends on a (possibly stale)
  // render closure, and so React StrictMode double-invokes can't double-count.
  const logsRef = useRef<CookLogLine[]>([]);
  const countsRef = useRef<CookLogCounts>(ZERO_COUNTS);
  // Cursor that cycles "Jump to error" through each error in turn.
  const errorCursorRef = useRef(0);
  // Set when a jump is requested while the active filter hides errors — the jump
  // runs once the Errors view re-renders with rows.
  const pendingJumpRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  usePaneHold(cookHoldsPane(request, result, attached), COOK_HOLD_REASON);

  /** Follow a cook through the job driver; the console clears when the driver starts. */
  const follow = useCallback((start: CookStreamStart, signal: AbortSignal, startedAt: number) => {
    // Phase active as lines arrive — captured locally so each log is tagged
    // synchronously (state updates are async and would lag the stream).
    let currentPhase: CookPhase | null = null;
    // The driver settles ONCE, after the build is recorded (cookJobStream.ts): the
    // `done`/`error` outcome is held until `recorded {buildId}` / `record-error`,
    // and a stream that closes first is re-queried against the job, not guessed at.
    const handlers: CookStreamHandlers = {
      // A new cook: clear the previous one's console.
      onStart: () => {
        setPhase(null);
        setPercent(0);
        setLogs([]);
        setCounts(ZERO_COUNTS);
        logsRef.current = [];
        countsRef.current = ZERO_COUNTS;
        setResult(null);
        setElapsedMs(0);
        setFilter('all');
        setAutoScroll(true);
        setCancelling(false);
        setCancelError(null);
        setJob(start.mode === 'attach' ? { jobId: start.job.jobId, kind: start.job.kind } : null);
        setAttached(start.mode === 'attach');
        logIdRef.current = 0;
        errorCursorRef.current = 0;
        pendingJumpRef.current = false;
        startedAtRef.current = startedAt;
      },
      onJob: (j) => setJob(j),
      onSettle: (final) => {
        setResult(final);
        onCompleteRef.current?.(final);
      },
      onEvent: (ev) => {
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
          const prev = logsRef.current;
          const next = appendCookLog(prev, entry);
          // Mirror append/trim into the running tallies (O(1)): +1 for the
          // new line's facets, −1 for any head line that fell off the cap.
          // Equivalent to rescanning `next` from scratch each tick.
          const add = lineFacets(entry);
          const trimmed = prev.length + 1 > next.length ? prev[0] : null;
          const sub = trimmed ? lineFacets(trimmed) : null;
          const c = countsRef.current;
          const nextCounts: CookLogCounts = {
            all: next.length,
            error: c.error + (add.error ? 1 : 0) - (sub?.error ? 1 : 0),
            warning: c.warning + (add.warning ? 1 : 0) - (sub?.warning ? 1 : 0),
            cook: c.cook + (add.cook ? 1 : 0) - (sub?.cook ? 1 : 0),
            stage: c.stage + (add.stage ? 1 : 0) - (sub?.stage ? 1 : 0),
          };
          logsRef.current = next;
          countsRef.current = nextCounts;
          setLogs(next);
          setCounts(nextCounts);
        }
      },
    };
    void driveCookStream(start, signal, handlers);
  }, []);

  // Start (and follow) a cook for a local request. Unmount only DETACHES: the cook
  // is a server job and keeps running; a remounted console reattaches below.
  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    follow({ mode: 'request', request }, ctrl.signal, Date.now());
    return () => { ctrl.abort(); };
  }, [request, follow]);

  // No local request: attach to a cook job already holding the open project (this
  // tab reloaded, another tab started it, or the nightly is running).
  useEffect(() => {
    if (request || !projectPath) return;
    const ctrl = new AbortController();
    void (async () => {
      const q = await tryApiFetch<{ job: CookJobInfo | null }>(
        `${COOK_JOBS_URL}?projectPath=${encodeURIComponent(projectPath)}`, { signal: ctrl.signal },
      );
      if (ctrl.signal.aborted || !q.ok || !q.data.job || q.data.job.settled) return;
      follow({ mode: 'attach', job: q.data.job }, ctrl.signal, q.data.job.startedAt);
    })();
    return () => { ctrl.abort(); };
  }, [request, projectPath, follow]);

  /** Ask the server to cancel the job; the stream then carries error{cancelled} + recorded. */
  const cancel = useCallback(async () => {
    if (!job) return;
    setCancelling(true);
    setCancelError(null);
    const r = await tryApiFetch<{ job: CookJobInfo }>(
      `${COOK_JOBS_URL}?jobId=${encodeURIComponent(job.jobId)}`, { method: 'DELETE' },
    );
    if (!r.ok) { setCancelling(false); setCancelError(r.error); }
  }, [job]);

  // Live elapsed ticker: updates once a second while the cook runs, then stops
  // (and freezes to the exact total) once a result arrives. Suspendable: while the
  // module is hidden the label cannot be read, and the effect below re-derives the
  // elapsed total from `startedAtRef` on resume, so nothing is lost by pausing.
  useSuspendableEffect(() => {
    if ((!request && !attached) || result) return;
    const id = setInterval(() => {
      if (startedAtRef.current != null) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [request, attached, result]);

  // Freeze the elapsed total the instant the cook finishes (any exit path).
  useEffect(() => {
    if (result && startedAtRef.current != null) setElapsedMs(Date.now() - startedAtRef.current);
  }, [result]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

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

  return {
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
    jobId: job?.jobId ?? null,
    jobKind: job?.kind ?? null,
    attached,
    cancel,
    cancelling,
    cancelError,
  };
}
