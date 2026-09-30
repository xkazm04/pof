'use client';

import { useEffect, useCallback, useRef, useState, useReducer } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS, BUILD_PARSE_CACHE_MAX } from '@/lib/constants';
import {
  extractAllCallbackPayloads, callbackIdsIn, getCallback,
  type CallbackStatus, type TaskCallback,
} from '@/lib/cli-task';
import type {
  QueuedTask, FileChange, LogEntry,
  ExecutionInfo, ExecutionResult, CLISSEEvent, ServerFailedCallback, HiddenRunStatus, TaskCompleteMeta,
} from './types';
import type { SkillId } from './skills';
import { injectSkillsIntoPrompt } from './skills';
import {
  registerTaskStart, registerTaskComplete, sendTaskHeartbeat,
  getTaskStatus, clearSessionTasks, attachTaskExecution,
} from './taskRegistry';
import { parseBuildOutput, type BuildParseResult } from './UE5BuildParser';

// Sentinel task id for interactive (submitPrompt) runs, which never get a
// queued-task id. onTaskComplete must fire for them too — hosts release
// session.isRunning from it.
const INTERACTIVE_TASK_ID = 'interactive';

/** The stream/query routes' answer for an execution the server no longer holds (ended > 1 h ago, or a restart). */
const EXECUTION_NOT_FOUND = 'Execution not found';

/**
 * The registry descriptors of every `@@CALLBACK:<id>` a prompt asks for. They ride
 * the query POST so the server that owns the run settles them (run-callbacks.ts) —
 * the tab never POSTs a run's callbacks itself.
 */
function declaredCallbacksOf(prompt: string): TaskCallback[] {
  return callbackIdsIn(prompt)
    .map((id) => getCallback(id))
    .filter((cb): cb is TaskCallback => cb !== undefined);
}

interface UseTaskQueueOpts {
  instanceId: string;
  projectPath: string;
  taskQueue: QueuedTask[];
  autoStart: boolean;
  enabledSkills: SkillId[];
  visible?: boolean;
  /** Fired synchronously when a run is dispatched — the queued task id, or 'interactive' for submitPrompt runs. */
  onTaskStart?: (taskId: string) => void;
  /**
   * Fired exactly once per run when it terminates. `meta.callbackStatus` is
   * ADDITIVE truth about the run's structured callback (confirmed/failed/missing)
   * — present only for runs that emit a callback marker; it never gates or delays
   * this signal (isRunning is always released within the existing bounds).
   */
  onTaskComplete?: (taskId: string, success: boolean, meta?: TaskCompleteMeta) => void;
  /**
   * Fired once per dispatched run, when the query POST returns its server execution
   * id — the host persists it so a reload can re-attach (see attachExecution).
   */
  onExecutionStarted?: (executionId: string) => void;
  onQueueEmpty?: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  onBatchFlushed?: (count: number) => void;
  /**
   * Fired synchronously when submitPrompt dispatches, with the RAW prompt (before
   * skill injection) and its task type — the host's copy of what was sent, so a
   * retry can replay it exactly.
   */
  onDispatch?: (dispatch: { prompt: string; taskType?: string }) => void;
  /**
   * Fired at most once per run, from the result path, with the run's `@@CALLBACK`
   * markers whose POST failed — so the host can re-POST them without a new run.
   * Never fired for a run a newer run has already replaced.
   */
  onCallbacksUnresolved?: (markers: { callbackId: string; payload: string }[]) => void;
  /**
   * Best-known spend attribution for the current session, threaded into the query
   * POST so the run's spend is recorded server-side (covers failed/aborted runs the
   * old client-only path missed). Read imperatively at dispatch time.
   */
  resolveAttribution?: () => { moduleId?: string; taskType?: string; taskLabel?: string | null; sessionKey?: string | null };
}

// ── State machine ───────────────────────────────────────────────────────────

/**
 * Discriminated union for the task execution lifecycle.
 *
 * Valid transitions:
 *   idle       → connecting   (TASK_START / SUBMIT_START)
 *   connecting → streaming    (SSE_CONNECTED)
 *   connecting → error        (START_FAILED)
 *   streaming  → complete     (SSE_RESULT)
 *   streaming  → error        (SSE_ERROR)
 *   streaming  → idle         (ABORT)
 *   complete   → connecting   (TASK_START / SUBMIT_START)
 *   error      → connecting   (TASK_START / SUBMIT_START)
 *   *          → idle         (CLEAR)
 */
type TaskPhase =
  | { phase: 'idle' }
  | { phase: 'connecting'; taskId: string | null }
  | { phase: 'streaming'; taskId: string | null; executionInfo: ExecutionInfo }
  | { phase: 'complete'; lastResult: ExecutionResult }
  | { phase: 'error'; error: string; taskId: string | null };

interface TaskQueueState {
  current: TaskPhase;
  /** Persists across task lifecycle — set once connected, cleared on CLEAR */
  sessionId: string | null;
  /** Persists across task lifecycle — set on each task start */
  logFilePath: string | null;
  /** Model-policy pin the last dispatch resolved to (WS0), or null when unpinned. */
  resolvedModel: string | null;
  /** Thinking effort the last dispatch resolved to, or null when unpinned. */
  resolvedEffort: string | null;
}

type TaskQueueAction =
  | { type: 'TASK_START'; taskId: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SSE_CONNECTED'; info: ExecutionInfo; sessionId?: string }
  | { type: 'SSE_RESULT'; result: ExecutionResult; sessionId?: string }
  | { type: 'SSE_ERROR'; error: string }
  | { type: 'START_FAILED'; error: string }
  | { type: 'SET_LOG_FILE'; path: string }
  | { type: 'SET_RESOLVED_MODEL'; model: string | null; effort: string | null }
  | { type: 'ABORT' }
  | { type: 'TASK_DONE' }
  | { type: 'STUCK_RESOLVED'; success: boolean }
  | { type: 'CLEAR' };

const INITIAL_STATE: TaskQueueState = {
  current: { phase: 'idle' },
  sessionId: null,
  logFilePath: null,
  resolvedModel: null,
  resolvedEffort: null,
};

function taskQueueReducer(state: TaskQueueState, action: TaskQueueAction): TaskQueueState {
  switch (action.type) {
    case 'TASK_START':
      return {
        ...state,
        current: { phase: 'connecting', taskId: action.taskId },
      };

    case 'SUBMIT_START':
      return {
        ...state,
        current: { phase: 'connecting', taskId: null },
      };

    case 'SSE_CONNECTED': {
      const taskId = state.current.phase === 'connecting' ? state.current.taskId : null;
      return {
        ...state,
        current: { phase: 'streaming', taskId, executionInfo: action.info },
        sessionId: action.sessionId ?? state.sessionId,
      };
    }

    case 'SSE_RESULT':
      return {
        ...state,
        current: { phase: 'complete', lastResult: action.result },
        sessionId: action.sessionId ?? state.sessionId,
      };

    case 'SSE_ERROR':
      return {
        ...state,
        current: { phase: 'error', error: action.error, taskId: getTaskId(state.current) },
      };

    case 'START_FAILED':
      return {
        ...state,
        current: { phase: 'error', error: action.error, taskId: getTaskId(state.current) },
      };

    case 'SET_LOG_FILE':
      return { ...state, logFilePath: action.path };

    case 'SET_RESOLVED_MODEL':
      return { ...state, resolvedModel: action.model, resolvedEffort: action.effort };

    case 'ABORT':
    case 'TASK_DONE':
    case 'STUCK_RESOLVED':
      return {
        ...state,
        current: { phase: 'idle' },
      };

    case 'CLEAR':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

/** Extract taskId from any phase that carries one */
function getTaskId(phase: TaskPhase): string | null {
  if ('taskId' in phase) return phase.taskId;
  return null;
}

// ── Derived selectors ───────────────────────────────────────────────────────

function isStreaming(state: TaskQueueState): boolean {
  return state.current.phase === 'connecting' || state.current.phase === 'streaming';
}

function currentTaskId(state: TaskQueueState): string | null {
  return getTaskId(state.current);
}

function currentError(state: TaskQueueState): string | null {
  return state.current.phase === 'error' ? state.current.error : null;
}

function currentExecutionInfo(state: TaskQueueState): ExecutionInfo | null {
  return state.current.phase === 'streaming' ? state.current.executionInfo : null;
}

function lastResult(state: TaskQueueState): ExecutionResult | null {
  return state.current.phase === 'complete' ? state.current.lastResult : null;
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Manages task execution, SSE event handling, stuck task detection,
 * heartbeat, abort, queue processing, and RAF-batched log updates.
 */
export function useTaskQueue(opts: UseTaskQueueOpts) {
  const {
    instanceId, projectPath, taskQueue, autoStart, enabledSkills,
    visible = true,
    onTaskStart, onTaskComplete, onQueueEmpty, onStreamingChange, onBatchFlushed,
    resolveAttribution, onDispatch, onCallbacksUnresolved, onExecutionStarted,
  } = opts;

  const [state, dispatch] = useReducer(taskQueueReducer, INITIAL_STATE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);

  // Derived values from state machine
  const streaming = isStreaming(state);
  const taskId = currentTaskId(state);
  const error = currentError(state);
  const executionInfo = currentExecutionInfo(state);
  const result = lastResult(state);

  // Keep a ref for the current taskId so callbacks can read it without re-rendering
  const currentTaskIdRef = useRef<string | null>(null);
  useEffect(() => { currentTaskIdRef.current = taskId; }, [taskId]);

  /** Tracks task IDs already dispatched to prevent duplicate execution */
  const dispatchedTaskIds = useRef<Set<string>>(new Set());
  /** Capped at BUILD_PARSE_CACHE_MAX entries — oldest evicted first when full */
  const [buildParseCache, setBuildParseCache] = useState<Map<string, BuildParseResult>>(() => new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  /** Accumulated assistant output for current task — used for callback extraction */
  const assistantOutputRef = useRef<string>('');
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNextTaskRef = useRef<NodeJS.Timeout | null>(null);
  const savedStreamUrlRef = useRef<string | null>(null);
  /** Server-side execution id for the in-flight run, so abort can kill the process. */
  const executionIdRef = useRef<string | null>(null);
  /**
   * Single completion latch for the CURRENT run, shared by every path that can end
   * it — the SSE result/error handlers, the stream `onerror`, abort, and the stuck
   * poller. It replaces the old connection-local `completed` boolean so the poller
   * (a separate effect that could never see that closure) can no longer fire a
   * second completion in the window between the result SSE and the callback-settle
   * delayed completion. Reset to false when a fresh run connects.
   */
  const completedRef = useRef(false);

  // Synchronous re-entrancy latch for run dispatch. The reducer's `streaming`
  // flag (and any `isStreaming` derived from it) doesn't flip to true until
  // React commits the next render, so two dispatches in the same tick — e.g.
  // two `pof-cli-prompt` events, or a double-click — both read the stale
  // pre-update value and both start a run, the second clobbering the first's
  // eventSource/executionId with no handle left to abort the orphan. This ref
  // flips the instant a dispatch begins and is checked before it, closing the
  // click-to-rerender gap. Cleared when the run completes or fails to start.
  const dispatchingRef = useRef(false);

  // Notify parent when streaming state changes
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current !== streaming) {
      prevStreamingRef.current = streaming;
      onStreamingChange?.(streaming);
    }
  }, [streaming, onStreamingChange]);

  // RAF-batched log updates
  const logBufferRef = useRef<LogEntry[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const onBatchFlushedRef = useRef(onBatchFlushed);
  useEffect(() => { onBatchFlushedRef.current = onBatchFlushed; }, [onBatchFlushed]);

  // Stable ref so dispatch can read the current attribution without re-creating
  // the dispatch callbacks when the resolver identity changes.
  const resolveAttributionRef = useRef(resolveAttribution);
  useEffect(() => { resolveAttributionRef.current = resolveAttribution; }, [resolveAttribution]);
  const onDispatchRef = useRef(onDispatch);
  useEffect(() => { onDispatchRef.current = onDispatch; }, [onDispatch]);
  const onCallbacksUnresolvedRef = useRef(onCallbacksUnresolved);
  useEffect(() => { onCallbacksUnresolvedRef.current = onCallbacksUnresolved; }, [onCallbacksUnresolved]);
  const onExecutionStartedRef = useRef(onExecutionStarted);
  useEffect(() => { onExecutionStartedRef.current = onExecutionStarted; }, [onExecutionStarted]);
  /**
   * The current run was ATTACHED (attachExecution), not dispatched by this page: its
   * callbacks were declared by a page that no longer exists and are settled by the
   * server alone, so this tab reports no callback verdict for it (callbackStatus
   * undefined) and never hands its markers to Resubmit.
   */
  const attachedRef = useRef(false);
  /** Highest stream `seq` delivered for the current run — the re-show resume cursor. */
  const lastSeqRef = useRef(0);
  /** Bumped on every dispatch — lets a late callback settle tell whether its run is still current. */
  const runTokenRef = useRef(0);
  /** The current run's declared callbacks — the server settles them; non-empty means "await its verdict". */
  const declaredCallbacksRef = useRef<TaskCallback[]>([]);
  /** Resolves the clean-result path's wait with the server's `callbacks` verdict. */
  const callbacksWaiterRef = useRef<((status: CallbackStatus | undefined) => void) | null>(null);

  const flushLogBuffer = useCallback(() => {
    rafIdRef.current = null;
    const buffered = logBufferRef.current;
    if (buffered.length === 0) return;
    logBufferRef.current = [];
    setLogs((prev) => [...prev, ...buffered]);
    onBatchFlushedRef.current?.(buffered.length);
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    logBufferRef.current.push(entry);
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushLogBuffer);
    }
  }, [flushLogBuffer]);

  const addFileChange = useCallback((change: FileChange) => {
    setFileChanges((prev) => {
      const exists = prev.some((c) => c.filePath === change.filePath && c.toolUseId === change.toolUseId);
      return exists ? prev : [...prev, change];
    });
  }, []);

  // --- Heartbeat cleanup helper ---

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * The ONE terminal transition of a run, used by every path that ends it (clean
   * result, error SSE, stream onerror, abort, start failure, both stuck-poller
   * verdicts). The caller must already hold the `completedRef` latch. It releases
   * the dispatch latch, records the registry completion, and fires onTaskComplete —
   * so no terminal path can forget one of them (the stuck-poller paths used to
   * leave dispatchingRef set, silently dropping every later dispatch).
   */
  const finishRun = useCallback((
    success: boolean,
    opts?: { callbackStatus?: CallbackStatus; outcomeUnknown?: boolean; taskId?: string | null; register?: boolean },
  ) => {
    dispatchingRef.current = false; // run terminated — allow the next dispatch
    const tid = opts?.taskId !== undefined ? opts.taskId : currentTaskIdRef.current;
    if (tid && opts?.register !== false) registerTaskComplete(tid, instanceId, success);
    const id = tid ?? INTERACTIVE_TASK_ID;
    const meta: TaskCompleteMeta = {};
    if (opts?.callbackStatus) meta.callbackStatus = opts.callbackStatus;
    if (opts?.outcomeUnknown) meta.outcomeUnknown = true;
    if (meta.callbackStatus || meta.outcomeUnknown) onTaskComplete?.(id, success, meta);
    else onTaskComplete?.(id, success);
  }, [instanceId, onTaskComplete]);

  /**
   * Latch-and-finish for the NON-result terminal paths (error, stream onerror,
   * abort, submit start failure). The clean SSE `result` path latches
   * synchronously on arrival and calls finishRun after the bounded callback-settle
   * race, so it can carry the resolved `callbackStatus`.
   */
  const completeOnce = useCallback((success: boolean, opts?: { outcomeUnknown?: boolean }) => {
    if (completedRef.current) return;
    completedRef.current = true;
    finishRun(success, opts);
  }, [finishRun]);

  /**
   * The run's execution is gone from the server (it ended over an hour ago, or the
   * server restarted): nothing is left to watch or abort, and its outcome was never
   * observed — end it as UNKNOWN (never as a failure) with a plain system line.
   */
  const endLostRun = useCallback(() => {
    if (completedRef.current) return;
    const execId = executionIdRef.current;
    executionIdRef.current = null;
    savedStreamUrlRef.current = null;
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    clearHeartbeat();
    addLog({
      id: `lost-${Date.now()}`, type: 'system', timestamp: Date.now(),
      content: `Run ${execId ?? ''} is no longer on the server (it ended over an hour ago, or the server restarted) — its outcome is unknown.`,
    });
    completeOnce(false, { outcomeUnknown: true });
  }, [addLog, clearHeartbeat, completeOnce]);

  /**
   * Surface the server's callback verdict for the current run: log it and hand any
   * failed payloads to the host (Resubmit re-POSTs them through the client registry).
   */
  const applyServerVerdict = useCallback((status: CallbackStatus, failed: ServerFailedCallback[], runToken: number) => {
    if (status === 'confirmed') {
      addLog({ id: `cb-ok-${Date.now()}`, type: 'system', content: 'Callback submitted successfully', timestamp: Date.now() });
    }
    for (const f of failed) {
      addLog({ id: `cb-err-${Date.now()}-${f.callbackId}`, type: 'error', content: `Callback failed: ${f.error}`, timestamp: Date.now() });
    }
    if (failed.length > 0 && runTokenRef.current === runToken) {
      onCallbacksUnresolvedRef.current?.(failed.map((f) => ({ callbackId: f.callbackId, payload: f.payload })));
    }
  }, [addLog]);

  // --- SSE event handling ---

  const handleSSEEvent = useCallback((event: CLISSEEvent) => {
    switch (event.type) {
      case 'connected': {
        const data = event.data as ExecutionInfo & { executionId?: string };
        dispatch({
          type: 'SSE_CONNECTED',
          info: data as unknown as ExecutionInfo,
          sessionId: data.sessionId as string | undefined,
        });
        break;
      }
      case 'message': {
        const data = event.data as { type: string; content: string; model?: string };
        if (data.type === 'assistant' && data.content) {
          assistantOutputRef.current += data.content;
          addLog({ id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'assistant', content: data.content, timestamp: event.timestamp, model: data.model });
        }
        break;
      }
      case 'tool_use': {
        const data = event.data as { toolUseId: string; toolName: string; toolInput: Record<string, unknown> };
        addLog({ id: `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'tool_use', content: data.toolName, timestamp: event.timestamp, toolName: data.toolName, toolInput: data.toolInput });
        if (['Edit', 'Write', 'Read'].includes(data.toolName)) {
          const filePath = data.toolInput.file_path as string;
          if (filePath) {
            addFileChange({ id: `fc-${Date.now()}`, sessionId: instanceId, filePath, changeType: data.toolName === 'Edit' ? 'edit' : data.toolName === 'Write' ? 'write' : 'read', timestamp: event.timestamp, toolUseId: data.toolUseId });
          }
        }
        break;
      }
      case 'tool_result': {
        const data = event.data as { toolUseId: string; content: string };
        const fullContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
        const logId = `result-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const parsed = parseBuildOutput(fullContent);
        if (parsed.isBuildOutput) {
          setBuildParseCache(prev => {
            const next = new Map(prev);
            next.set(logId, parsed);
            if (next.size > BUILD_PARSE_CACHE_MAX) {
              const firstKey = next.keys().next().value;
              if (firstKey !== undefined) next.delete(firstKey);
            }
            return next;
          });
        }
        addLog({ id: logId, type: 'tool_result', content: fullContent.slice(0, 200), timestamp: event.timestamp });
        break;
      }
      case 'result': {
        const data = event.data as ExecutionResult;
        // Latch the run as complete SYNCHRONOUSLY on result arrival, before the
        // async callback-settle race below. This closes the window in which the
        // stuck poller (or a late stream onerror) could fire a second completion
        // while this path is still awaiting the callback POST.
        completedRef.current = true;
        dispatch({ type: 'SSE_RESULT', result: data, sessionId: data.sessionId });
        clearHeartbeat();
        // Spend is now recorded SERVER-SIDE for every spawn (see cli-service
        // recordExecutionSpend) — the old client-only result path is gone, so
        // failed/aborted/autonomous runs are no longer missed or double-counted.

        // The SERVER settles the run's declared @@CALLBACKs (run-callbacks.ts) — the
        // tab never POSTs them, so a hidden, re-shown or reloaded tab can neither
        // drop nor duplicate a result. `callbackStatus` stays ADDITIVE truth carried
        // into the completion signal: the server's verdict arrives as the `callbacks`
        // frame right after `result`. A run that declared none reports 'missing'
        // when no marker was emitted, 'failed' when one was (nothing can submit it).
        let verdict: Promise<CallbackStatus | undefined>;
        if (attachedRef.current) {
          // Attached after a reload: the callbacks were declared by the page that
          // dispatched the run and are the server's alone to settle — no verdict here.
          verdict = Promise.resolve(undefined);
        } else if (declaredCallbacksRef.current.length > 0) {
          verdict = new Promise((resolve) => { callbacksWaiterRef.current = resolve; });
        } else {
          const stray = extractAllCallbackPayloads(assistantOutputRef.current);
          if (stray.length > 0) {
            addLog({ id: `cb-err-${Date.now()}`, type: 'error', content: 'Callback failed: the run emitted a callback it never declared', timestamp: Date.now() });
            onCallbacksUnresolvedRef.current?.(stray);
          }
          verdict = Promise.resolve(stray.length === 0 ? 'missing' : 'failed');
        }
        assistantOutputRef.current = '';

        // Never wait on the verdict indefinitely: gating onTaskComplete on it alone
        // could strand session.isRunning (the SP-B chunk-1 run #4 hang). Race it
        // against callbackSettleMax so the completion — and the isRunning release —
        // always fires within a bounded window (undefined = did not confirm in time).
        let settleTimer: ReturnType<typeof setTimeout> | undefined;
        Promise.race([
          verdict,
          new Promise<undefined>((resolve) => { settleTimer = setTimeout(() => resolve(undefined), UI_TIMEOUTS.callbackSettleMax); }),
        ]).then((callbackStatus) => {
          clearTimeout(settleTimer);
          callbacksWaiterRef.current = null;
          // completedRef is already latched (set synchronously above), so this is
          // the single completion firing for the clean-result path. Interactive
          // runs (submitPrompt) have no queued task id, but the completion signal
          // must still fire — it releases session.isRunning.
          finishRun(!data.isError, { callbackStatus });
        });

        break;
      }
      case 'callbacks': {
        // The server's settlement of this run's declared callbacks (see above).
        if (attachedRef.current) break; // an attached run reports no callback verdict (see result)
        const data = event.data as { status?: CallbackStatus | null; failed?: ServerFailedCallback[] };
        const status = data.status ?? undefined;
        if (status) applyServerVerdict(status, Array.isArray(data.failed) ? data.failed : [], runTokenRef.current);
        callbacksWaiterRef.current?.(status);
        break;
      }
      case 'error': {
        const data = event.data as { error: string };
        dispatch({ type: 'SSE_ERROR', error: data.error });
        if (data.error === EXECUTION_NOT_FOUND) {
          assistantOutputRef.current = '';
          endLostRun();
          break;
        }
        clearHeartbeat();
        addLog({ id: `error-${Date.now()}`, type: 'error', content: data.error, timestamp: event.timestamp });
        assistantOutputRef.current = '';
        completeOnce(false);
        break;
      }
    }
  }, [addLog, addFileChange, instanceId, clearHeartbeat, completeOnce, finishRun, applyServerVerdict, endLostRun]);

  /**
   * Open the run's stream. A fresh connection replays the whole execution log; a
   * `resume` (re-show) asks only for what came after the last `seq` delivered, so
   * the transcript is never replayed on top of itself.
   */
  const connectToStream = useCallback((streamUrl: string, resume = false) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    savedStreamUrlRef.current = streamUrl;
    if (!resume) lastSeqRef.current = 0;
    const after = lastSeqRef.current;
    // Fresh live connection for this run — arm the shared completion latch. The
    // clean-result path re-latches synchronously on result arrival; every other
    // terminal path (onerror, abort, stuck poller) reads this same ref so the run
    // completes exactly once regardless of which observes the stream end.
    completedRef.current = false;
    const eventSource = new EventSource(after > 0 ? `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}after=${after}` : streamUrl);
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CLISSEEvent;
        if (typeof data.seq === 'number') {
          if (data.seq <= lastSeqRef.current) return; // already delivered to this run
          lastSeqRef.current = data.seq;
        }
        handleSSEEvent(data);
        // A run that declared callbacks ends with the server's `callbacks` verdict.
        const ends = data.type === 'error' || data.type === 'callbacks'
          || (data.type === 'result' && declaredCallbacksRef.current.length === 0);
        if (ends) {
          eventSource.close();
          eventSourceRef.current = null;
          savedStreamUrlRef.current = null;
        }
      } catch (e) { console.error('Failed to parse SSE:', e); }
    };
    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      // Abnormal stream termination — e.g. the Claude process exited non-zero
      // without emitting a clean result/error SSE event. Complete the in-flight
      // task as failed so onTaskComplete fires and session.isRunning is
      // released; otherwise every same-module dispatch stays blocked behind a
      // disabled "Claude" button (the SP-B chunk-1 37-minute hang). completeOnce
      // no-ops if a result/error already latched completion.
      completeOnce(false);
    };
  }, [handleSSEEvent, completeOnce]);

  // --- Task execution ---

  const executeTask = useCallback(async (task: QueuedTask, resumeSession: boolean) => {
    // Idempotency guard: skip if this task was already dispatched
    if (dispatchedTaskIds.current.has(task.id)) return;
    // Synchronous re-entrancy guard: a run is already dispatching/streaming.
    // Checked before the reducer's streaming flag has committed, so a second
    // dispatch in the same tick can't slip through and clobber the first.
    if (dispatchingRef.current) return;
    dispatchingRef.current = true;
    runTokenRef.current++;
    dispatchedTaskIds.current.add(task.id);

    let startResult = await registerTaskStart(task.id, instanceId, task.label);
    if (!startResult.success && startResult.runningTask) {
      // Conflict recovery: before force-completing the stale registry row, kill
      // the orphaned server-side CLI process if we know which execution backs
      // it. Only marking the row failed would leave the old process alive and
      // editing the same project files concurrently with the new dispatch —
      // with no client-side handle left to ever abort it.
      const orphanExecId = startResult.runningTask.executionId;
      if (orphanExecId) {
        try {
          await apiFetch(`/api/claude-terminal/query?executionId=${encodeURIComponent(orphanExecId)}`, { method: 'DELETE' });
        } catch { /* best-effort: the process may have already exited */ }
      }
      await registerTaskComplete(startResult.runningTask.taskId, instanceId, false);
      startResult = await registerTaskStart(task.id, instanceId, task.label);
    }

    assistantOutputRef.current = '';
    completedRef.current = false;
    attachedRef.current = false;
    dispatch({ type: 'TASK_START', taskId: task.id });
    onTaskStart?.(task.id);

    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => sendTaskHeartbeat(task.id), UI_TIMEOUTS.heartbeatInterval);

    const { prompt: taskPrompt } = injectSkillsIntoPrompt({
      basePrompt: task.prompt, enabledSkills, resumeSession, runLabel: task.label,
    });

    addLog({ id: `task-${Date.now()}`, type: 'system', content: `Starting: ${task.label}`, timestamp: Date.now() });

    const callbacks = declaredCallbacksOf(taskPrompt);
    declaredCallbacksRef.current = callbacks;

    try {
      const attribution = resolveAttributionRef.current?.() ?? {};
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // taskLabel from the queued task; module/type/sessionKey from the session.
        // `callbacks`: the server settles them when the run ends (never this tab).
        body: JSON.stringify({ projectPath, prompt: taskPrompt, resumeSessionId: resumeSession ? state.sessionId : undefined, ...attribution, taskLabel: task.label, ...(callbacks.length > 0 ? { callbacks } : {}) }),
      });
      executionIdRef.current = data.executionId;
      onExecutionStartedRef.current?.(data.executionId);
      // Record which execution backs this task so a future 409-conflict
      // recovery (above) can kill the real process. Fire-and-forget.
      void attachTaskExecution(task.id, data.executionId);
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start task' });
      // Latch completion so a later stray path can't double-fire. Uses task.id
      // directly (currentTaskIdRef may not have caught up to the TASK_START yet).
      if (!completedRef.current) {
        completedRef.current = true;
        finishRun(false, { taskId: task.id });
      }
      clearHeartbeat();
    }
  }, [state.sessionId, instanceId, projectPath, addLog, connectToStream, onTaskStart, finishRun, enabledSkills, clearHeartbeat]);

  // --- Manual submit (user input) ---

  const submitPrompt = useCallback(async (prompt: string, resumeSession: boolean, opts?: { taskType?: string }) => {
    // Synchronous re-entrancy guard: two prompts dispatched in the same tick
    // (two pof-cli-prompt events, or click + Enter) would both pass a
    // streaming-flag check that hasn't committed yet, and the second would
    // overwrite eventSourceRef/executionIdRef — orphaning the first run's
    // server process with no handle to abort it. Bail if a run is dispatching.
    if (dispatchingRef.current) return;
    dispatchingRef.current = true;
    assistantOutputRef.current = '';
    completedRef.current = false;
    attachedRef.current = false;
    dispatch({ type: 'SUBMIT_START' });
    // Announce the run start synchronously — before any await — so the host's run
    // door opens before any terminal path can fire (see store/sessionRun.ts).
    onTaskStart?.(INTERACTIVE_TASK_ID);
    runTokenRef.current++;
    onDispatchRef.current?.({ prompt, taskType: opts?.taskType });
    // Echo the RAW user prompt to the log (no skills clutter); only the dispatched
    // prompt sent to the CLI carries the injected packs.
    addLog({ id: `user-${Date.now()}`, type: 'user', content: prompt, timestamp: Date.now() });

    // Same skill-injection path as the queued executeTask — this is what makes the
    // normal module-button flow (which runs through submitPrompt) actually receive
    // the session's resolved skill packs. First-run only (resume never re-injects).
    const { prompt: dispatchPrompt } = injectSkillsIntoPrompt({
      basePrompt: prompt, enabledSkills, resumeSession, runLabel: opts?.taskType ?? 'interactive',
    });

    const callbacks = declaredCallbacksOf(dispatchPrompt);
    declaredCallbacksRef.current = callbacks;

    try {
      const attribution = resolveAttributionRef.current?.() ?? {};
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null; model: string | null; effort: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // taskType lets the route resolve the model-policy pin (WS0) AND attribute spend;
        // this dispatch's explicit taskType wins over the session's last-known one.
        // `callbacks`: the server settles them when the run ends (never this tab).
        body: JSON.stringify({ projectPath, prompt: dispatchPrompt, resumeSessionId: resumeSession ? state.sessionId : undefined, ...attribution, taskType: opts?.taskType ?? attribution.taskType, ...(callbacks.length > 0 ? { callbacks } : {}) }),
      });
      executionIdRef.current = data.executionId;
      onExecutionStartedRef.current?.(data.executionId);
      dispatch({ type: 'SET_RESOLVED_MODEL', model: data.model ?? null, effort: data.effort ?? null });
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start' });
      // Release session.isRunning for hosts that latched on SUBMIT_START.
      completeOnce(false);
    }
  }, [projectPath, state.sessionId, addLog, connectToStream, completeOnce, onTaskStart, enabledSkills]);

  // --- Attach (re-open a live server run this page did not dispatch) ---

  /**
   * Resume the server run `executionId` — e.g. the one a session owned before a
   * reload. Starts the run through onTaskStart (Running, Abort armed), opens ONE
   * stream that replays its transcript from the start, and ends it with its real
   * outcome. It never POSTs a query (no second spawn) and never a callback. Returns
   * false when a run is already dispatching/streaming here.
   */
  const attachExecution = useCallback((executionId: string): boolean => {
    if (!executionId || dispatchingRef.current) return false;
    dispatchingRef.current = true;
    runTokenRef.current++;
    attachedRef.current = true;
    declaredCallbacksRef.current = [];
    assistantOutputRef.current = '';
    completedRef.current = false;
    executionIdRef.current = executionId;
    dispatch({ type: 'SUBMIT_START' });
    onTaskStart?.(INTERACTIVE_TASK_ID);
    addLog({ id: `attach-${Date.now()}`, type: 'system', content: `Re-attached to run ${executionId}`, timestamp: Date.now() });
    connectToStream(`/api/claude-terminal/stream?executionId=${encodeURIComponent(executionId)}`);
    return true;
  }, [addLog, connectToStream, onTaskStart]);

  // --- Abort ---

  const handleAbort = useCallback(async () => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    clearHeartbeat();
    // Closing the SSE stream does NOT stop the spawned claude.cmd — it keeps editing files
    // and billing tokens until the 100-min timeout. Kill the server-side process by id.
    const execId = executionIdRef.current;
    executionIdRef.current = null;
    if (execId) {
      try {
        await apiFetch(`/api/claude-terminal/query?executionId=${encodeURIComponent(execId)}`, { method: 'DELETE' });
      } catch { /* best-effort: the process may have already exited */ }
    }
    completeOnce(false);
    dispatch({ type: 'ABORT' });
  }, [completeOnce, clearHeartbeat]);

  // --- Clear ---

  const handleClear = useCallback(async () => {
    await clearSessionTasks(instanceId);
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    logBufferRef.current = [];
    setLogs([]);
    setFileChanges([]);
    dispatchedTaskIds.current.clear();
    setBuildParseCache(new Map());
    clearHeartbeat();
    if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
    dispatch({ type: 'CLEAR' });
  }, [instanceId, clearHeartbeat]);

  // --- Stuck task detection ---

  useEffect(() => {
    if (!visible || !autoStart || !streaming || !taskId) {
      if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
      return;
    }
    stuckCheckIntervalRef.current = setInterval(async () => {
      // Respect the shared completion latch — the SSE result/error paths set it
      // synchronously, so a poll that races the callback-settle window must not
      // fire a second completion. (Re-checked after the await below too.)
      if (completedRef.current) return;
      const tid = currentTaskIdRef.current;
      if (!tid) return;
      const status = await getTaskStatus(tid);
      if (completedRef.current) return;
      if (status.found && status.status !== 'running') {
        completedRef.current = true;
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        clearHeartbeat();
        // The registry already holds this verdict — do not re-register it.
        finishRun(status.status === 'completed', { taskId: tid, register: false });
        dispatch({ type: 'STUCK_RESOLVED', success: status.status === 'completed' });
        return;
      }
      if (status.isStale) {
        completedRef.current = true;
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        clearHeartbeat();
        finishRun(false, { taskId: tid });
        dispatch({ type: 'STUCK_RESOLVED', success: false });
      }
    }, UI_TIMEOUTS.stuckCheckInterval);
    return () => { if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; } };
  }, [visible, autoStart, streaming, taskId, finishRun, clearHeartbeat]);

  // --- Hidden-run settle: a hidden terminal still ends its run ---
  // Hiding closes the EventSource (below) — an attention cost — but the run's
  // existence is the server's: poll its execution status and end the run from there,
  // with the server's callback verdict, without waiting for the tab to be re-shown.
  useEffect(() => {
    if (visible || !streaming) return;
    const poll = setInterval(async () => {
      if (completedRef.current) return;
      const execId = executionIdRef.current;
      if (!execId) return;
      let ex: HiddenRunStatus;
      try {
        ex = (await apiFetch<{ execution: HiddenRunStatus }>(`/api/claude-terminal/query?executionId=${encodeURIComponent(execId)}`)).execution;
      } catch (e) {
        // Gone from the server: nothing will ever end it — record it as unknown.
        if (e instanceof Error && e.message === EXECUTION_NOT_FOUND && executionIdRef.current === execId) {
          endLostRun();
          dispatch({ type: 'STUCK_RESOLVED', success: false });
        }
        return; /* otherwise transient — the next poll (or a re-show) retries */
      }
      if (completedRef.current || executionIdRef.current !== execId || ex.status === 'running') return;
      const clean = ex.status === 'completed';
      const declared = declaredCallbacksRef.current.length > 0;
      if (clean && declared && !ex.callbackStatus) return; // the server is still settling
      completedRef.current = true;
      savedStreamUrlRef.current = null; // settled: a re-show must not re-attach
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      clearHeartbeat();
      const callbackStatus = clean && declared ? ex.callbackStatus ?? undefined : undefined;
      if (callbackStatus) applyServerVerdict(callbackStatus, ex.callbacksFailed ?? [], runTokenRef.current);
      const success = clean && !ex.isError;
      finishRun(success, callbackStatus ? { callbackStatus } : undefined);
      dispatch({ type: 'STUCK_RESOLVED', success });
    }, UI_TIMEOUTS.stuckCheckInterval);
    return () => clearInterval(poll);
  }, [visible, streaming, finishRun, clearHeartbeat, applyServerVerdict, endLostRun]);

  // --- Process task queue ---

  useEffect(() => {
    if (pendingNextTaskRef.current) { clearTimeout(pendingNextTaskRef.current); pendingNextTaskRef.current = null; }
    if (!visible || streaming || taskQueue.length === 0) return;
    const nextTask = taskQueue.find((t) => t.status === 'pending');
    if (nextTask && autoStart) {
      pendingNextTaskRef.current = setTimeout(() => {
        executeTask(nextTask, state.sessionId !== null);
      }, UI_TIMEOUTS.nextTaskDelay);
    } else if (!nextTask && taskQueue.length > 0 && autoStart) {
      onQueueEmpty?.();
    }
    return () => { if (pendingNextTaskRef.current) clearTimeout(pendingNextTaskRef.current); };
  }, [visible, taskQueue, streaming, autoStart, state.sessionId, executeTask, onQueueEmpty]);

  // --- Visibility guard: pause resources when hidden, resume when visible ---

  useEffect(() => {
    if (visible) {
      // Re-show: reconnect SSE if we were streaming when hidden — resuming after the
      // last event already on screen, never replaying the transcript on top of itself.
      if (streaming && savedStreamUrlRef.current && !eventSourceRef.current) {
        connectToStream(savedStreamUrlRef.current, true);
      }
      // Restart heartbeats too. They're started only once in executeTask and
      // cleared on hide (below); without this, a run hidden longer than the
      // heartbeat interval never sends another heartbeat, so the next
      // stuck-check sees a stale last-heartbeat and force-fails a HEALTHY run
      // purely because the tab was backgrounded. Re-arm for the current task.
      if (streaming && currentTaskIdRef.current && !heartbeatIntervalRef.current) {
        const tid = currentTaskIdRef.current;
        void sendTaskHeartbeat(tid); // immediate beat so staleness resets on re-show
        heartbeatIntervalRef.current = setInterval(() => sendTaskHeartbeat(tid), UI_TIMEOUTS.heartbeatInterval);
      }
      return;
    }

    // Hidden: tear down client-side resources without aborting the backend task
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    clearHeartbeat();
    if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
    if (pendingNextTaskRef.current) { clearTimeout(pendingNextTaskRef.current); pendingNextTaskRef.current = null; }
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
  }, [visible, streaming, connectToStream, clearHeartbeat]);
  // `currentTaskIdRef`/`heartbeatIntervalRef` are refs (stable) — intentionally
  // not in deps; the effect re-runs on visible/streaming change, which is when
  // the heartbeat must be re-armed or torn down.

  // --- Cleanup on unmount ---

  useEffect(() => {
    return () => {
      // Null the ref too: a StrictMode remount must see no live stream so its
      // visibility effect can resume (with the cursor) instead of holding a dead one.
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (stuckCheckIntervalRef.current) clearInterval(stuckCheckIntervalRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return {
    logs,
    fileChanges,
    isStreaming: streaming,
    sessionId: state.sessionId,
    executionInfo,
    lastResult: result,
    error,
    currentTaskId: taskId,
    logFilePath: state.logFilePath,
    resolvedModel: state.resolvedModel,
    resolvedEffort: state.resolvedEffort,
    buildParseCache,
    submitPrompt,
    attachExecution,
    handleAbort,
    handleClear,
  };
}
