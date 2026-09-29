import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { usePaneHold } from '@/hooks/usePaneHold';
import { type ListImperativeAPI } from 'react-window';
import type { CookEvent, CookPhase } from '@/lib/packaging/cook-executor';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ZERO_COUNTS, PIN_THRESHOLD_PX } from './constants';
import { classifyCookLogLine, appendCookLog, lineFacets, formatCookTimestamp } from './helpers';
import type { CookLogLine, CookLogFilter, CookLogCounts, CookProgressProps, CookCompletion, CookRecordEvent } from './types';

/** The pane-hold reason the Activity Feed shows if the shell tears a cook down. */
export const COOK_HOLD_REASON = 'UE cook running';

/**
 * THE cook's pane-hold rule — the one place its hold is released. The cook holds
 * its keep-alive pane (`usePaneHold`) from the moment a request starts until the
 * cook SETTLES, and it settles when `result` is set. The single settle point is
 * AFTER the build is recorded: the `recorded` (or `record-error`) event that
 * follows `done`/`error`, a stream that ends first, or an HTTP failure. A bare
 * `done` does not settle — the server has yet to write the build row, and evicting
 * the pane then would abort the stream (and, server side, the UAT process tree)
 * before the row and its id exist. Move the settle point here, nowhere else.
 */
export function cookHoldsPane(
  request: CookProgressProps['request'],
  result: { status: 'success' | 'failed' } | null,
): boolean {
  return request != null && result === null;
}

export function useCookProgress({ request, onComplete }: CookProgressProps) {
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

  const abortRef = useRef<AbortController | null>(null);
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

  usePaneHold(cookHoldsPane(request, result), COOK_HOLD_REASON);

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
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
    logIdRef.current = 0;
    errorCursorRef.current = 0;
    pendingJumpRef.current = false;
    startedAtRef.current = Date.now();

    (async () => {
      // Phase active as lines arrive — captured locally so each log is tagged
      // synchronously (state updates are async and would lag the stream).
      let currentPhase: CookPhase | null = null;
      // The response status was committed at 200 before the first byte, so once
      // the stream is open the transport can no longer report the outcome. The
      // `done`/`error` (then `recorded`) events are the only channel left, and their ABSENCE is the
      // failure: every log line can be well formed and complete while the
      // sequence is short. Without this flag a stream that just stops leaves the
      // cook with no verdict at all, which the UI renders as "still running"
      // forever.
      let settled = false;
      // The `done`/`error` outcome, held until the server says whether it RECORDED
      // the build (`recorded {buildId}` / `record-error`). The cook settles once, there.
      let pending: CookCompletion | null = null;
      const settle = (final: CookCompletion) => {
        settled = true;
        setResult(final);
        onComplete?.(final);
      };
      try {
        const res = await fetch('/api/packaging/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          settle({ status: 'failed', error: `HTTP ${res.status}` });
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
            let ev: CookEvent | CookRecordEvent;
            try { ev = JSON.parse(data) as CookEvent | CookRecordEvent; } catch { continue; }
            if (settled) continue;
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
            } else if (ev.type === 'done') {
              pending = { status: 'success', exePath: ev.exePath };
            } else if (ev.type === 'error') {
              pending = { status: 'failed', error: ev.message };
            } else if (ev.type === 'recorded' && pending) {
              settle({ ...pending, buildId: ev.buildId });
            } else if (ev.type === 'record-error' && pending) {
              settle({ ...pending, recordError: ev.message });
            }
          }
        }
        if (!settled && !ctrl.signal.aborted) {
          settle(pending
            ? { ...pending, recordError: 'The cook stream ended before the build was recorded.' }
            : { status: 'failed', error: 'Cook stream ended without a result — the build may still be running.' });
        }
      } catch (err) {
        if (ctrl.signal.aborted || settled) return;
        settle({ status: 'failed', error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => { ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // Live elapsed ticker: updates once a second while the cook runs, then stops
  // (and freezes to the exact total) once a result arrives. Suspendable: while the
  // module is hidden the label cannot be read, and the effect below re-derives the
  // elapsed total from `startedAtRef` on resume, so nothing is lost by pausing.
  useSuspendableEffect(() => {
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
  };
}
