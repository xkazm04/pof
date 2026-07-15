'use client';

import { useEffect, useCallback, useRef, useState, useReducer } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS, BUILD_PARSE_CACHE_MAX } from '@/lib/constants';
import { extractAllCallbackPayloads, resolveCallback, type CallbackStatus } from '@/lib/cli-task';
import type {
  QueuedTask, FileChange, LogEntry,
  ExecutionInfo, ExecutionResult, CLISSEEvent,
} from './types';
import type { SkillId } from './skills';
import { injectSkillsIntoPrompt } from './skills';
import {
  registerTaskStart, registerTaskComplete, sendTaskHeartbeat,
  getTaskStatus, clearSessionTasks,
} from './taskRegistry';
import { parseBuildOutput, type BuildParseResult } from './UE5BuildParser';

// Sentinel task id for interactive (submitPrompt) runs, which never get a
// queued-task id. onTaskComplete must fire for them too — hosts release
// session.isRunning from it.
const INTERACTIVE_TASK_ID = 'interactive';

interface UseTaskQueueOpts {
  instanceId: string;
  projectPath: string;
  taskQueue: QueuedTask[];
  autoStart: boolean;
  enabledSkills: SkillId[];
  visible?: boolean;
  onTaskStart?: (taskId: string) => void;
  /**
   * Fired exactly once per run when it terminates. `meta.callbackStatus` is
   * ADDITIVE truth about the run's structured callback (confirmed/failed/missing)
   * — present only for runs that emit a callback marker; it never gates or delays
   * this signal (isRunning is always released within the existing bounds).
   */
  onTaskComplete?: (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus }) => void;
  onQueueEmpty?: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  onBatchFlushed?: (count: number) => void;
  /** Fired with the run's token/cost result when a `result` event arrives. */
  onResult?: (result: ExecutionResult) => void;
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
    onResult,
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

  // Stable ref so the result handler can report token/cost spend without
  // re-subscribing the SSE stream when the callback identity changes.
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

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
   * Fire the one-shot completion for any NON-result terminal path (error, stream
   * onerror, abort, stuck poller). Latched by `completedRef` so it runs at most
   * once per run. The clean SSE `result` path does NOT go through here — it latches
   * synchronously on result arrival and fires its own completion after the bounded
   * callback-settle race, so it can carry the resolved `callbackStatus`.
   */
  const completeOnce = useCallback((success: boolean, callbackStatus?: CallbackStatus) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const tid = currentTaskIdRef.current;
    if (tid) registerTaskComplete(tid, instanceId, success);
    onTaskComplete?.(tid ?? INTERACTIVE_TASK_ID, success, callbackStatus ? { callbackStatus } : undefined);
  }, [instanceId, onTaskComplete]);

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

        // Report token/cost spend for this run (e.g. persisted to the spend dashboard).
        onResultRef.current?.(data);

        // Resolve EVERY structured callback present in assistant output (a run may
        // emit more than one). `callbackStatus` is ADDITIVE truth carried into the
        // completion signal: 'missing' when no marker was emitted, 'confirmed' when
        // all POSTs succeeded, 'failed' if any was rejected. It is computed inside
        // the settle race — if the race times out first it stays undefined, i.e.
        // the callback simply did not confirm in time (treated as unconfirmed).
        const cbMarkers = extractAllCallbackPayloads(assistantOutputRef.current);
        let callbackStatus: CallbackStatus | undefined = cbMarkers.length === 0 ? 'missing' : undefined;
        const cbPromise =
          cbMarkers.length === 0
            ? Promise.resolve()
            : Promise.all(
                cbMarkers.map((m) =>
                  resolveCallback(m.callbackId, m.payload).then((cbResult) => {
                    if (cbResult.success) {
                      addLog({ id: `cb-ok-${Date.now()}-${m.callbackId}`, type: 'system', content: `Callback submitted successfully`, timestamp: Date.now() });
                    } else {
                      addLog({ id: `cb-err-${Date.now()}-${m.callbackId}`, type: 'error', content: `Callback failed: ${cbResult.error}`, timestamp: Date.now() });
                    }
                    return cbResult.success;
                  }),
                ),
              ).then((results) => {
                callbackStatus = results.every(Boolean) ? 'confirmed' : 'failed';
              });

        assistantOutputRef.current = '';

        // Complete the task once the callback POST settles — but never wait on
        // it indefinitely. resolveCallback's POST can hang; gating onTaskComplete
        // on it alone strands session.isRunning forever (the SP-B chunk-1 run #4
        // hang). Race it against callbackSettleMax so the completion — and the
        // isRunning release — always fires within a bounded window.
        Promise.race([
          cbPromise,
          new Promise<void>((resolve) => setTimeout(resolve, UI_TIMEOUTS.callbackSettleMax)),
        ]).finally(() => {
          // completedRef is already latched (set synchronously above), so this is
          // the single completion firing for the clean-result path. Interactive
          // runs (submitPrompt) have no queued task id, but the completion signal
          // must still fire — it releases session.isRunning.
          const tid = currentTaskIdRef.current;
          if (tid) registerTaskComplete(tid, instanceId, !data.isError);
          onTaskComplete?.(tid ?? INTERACTIVE_TASK_ID, !data.isError, callbackStatus ? { callbackStatus } : undefined);
        });

        break;
      }
      case 'error': {
        const data = event.data as { error: string };
        dispatch({ type: 'SSE_ERROR', error: data.error });
        clearHeartbeat();
        addLog({ id: `error-${Date.now()}`, type: 'error', content: data.error, timestamp: event.timestamp });
        assistantOutputRef.current = '';
        completeOnce(false);
        break;
      }
    }
  }, [addLog, addFileChange, instanceId, onTaskComplete, clearHeartbeat, completeOnce]);

  const connectToStream = useCallback((streamUrl: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    savedStreamUrlRef.current = streamUrl;
    // Fresh live connection for this run — arm the shared completion latch. The
    // clean-result path re-latches synchronously on result arrival; every other
    // terminal path (onerror, abort, stuck poller) reads this same ref so the run
    // completes exactly once regardless of which observes the stream end.
    completedRef.current = false;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CLISSEEvent;
        handleSSEEvent(data);
        if (data.type === 'result' || data.type === 'error') {
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
    dispatchedTaskIds.current.add(task.id);

    let startResult = await registerTaskStart(task.id, instanceId, task.label);
    if (!startResult.success && startResult.runningTask) {
      await registerTaskComplete(startResult.runningTask.taskId, instanceId, false);
      startResult = await registerTaskStart(task.id, instanceId, task.label);
    }

    assistantOutputRef.current = '';
    completedRef.current = false;
    dispatch({ type: 'TASK_START', taskId: task.id });
    onTaskStart?.(task.id);

    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => sendTaskHeartbeat(task.id), UI_TIMEOUTS.heartbeatInterval);

    const { prompt: taskPrompt } = injectSkillsIntoPrompt({
      basePrompt: task.prompt, enabledSkills, resumeSession, runLabel: task.label,
    });

    addLog({ id: `task-${Date.now()}`, type: 'system', content: `Starting: ${task.label}`, timestamp: Date.now() });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt: taskPrompt, resumeSessionId: resumeSession ? state.sessionId : undefined }),
      });
      executionIdRef.current = data.executionId;
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start task' });
      // Latch completion so a later stray path can't double-fire. Uses task.id
      // directly (currentTaskIdRef may not have caught up to the TASK_START yet).
      if (!completedRef.current) {
        completedRef.current = true;
        registerTaskComplete(task.id, instanceId, false);
        onTaskComplete?.(task.id, false);
      }
      clearHeartbeat();
    }
  }, [state.sessionId, instanceId, projectPath, addLog, connectToStream, onTaskStart, onTaskComplete, enabledSkills, clearHeartbeat]);

  // --- Manual submit (user input) ---

  const submitPrompt = useCallback(async (prompt: string, resumeSession: boolean, opts?: { taskType?: string }) => {
    assistantOutputRef.current = '';
    completedRef.current = false;
    dispatch({ type: 'SUBMIT_START' });
    // Echo the RAW user prompt to the log (no skills clutter); only the dispatched
    // prompt sent to the CLI carries the injected packs.
    addLog({ id: `user-${Date.now()}`, type: 'user', content: prompt, timestamp: Date.now() });

    // Same skill-injection path as the queued executeTask — this is what makes the
    // normal module-button flow (which runs through submitPrompt) actually receive
    // the session's resolved skill packs. First-run only (resume never re-injects).
    const { prompt: dispatchPrompt } = injectSkillsIntoPrompt({
      basePrompt: prompt, enabledSkills, resumeSession, runLabel: opts?.taskType ?? 'interactive',
    });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null; model: string | null; effort: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // taskType lets the route resolve the model-policy pin (WS0) for this run.
        body: JSON.stringify({ projectPath, prompt: dispatchPrompt, resumeSessionId: resumeSession ? state.sessionId : undefined, taskType: opts?.taskType }),
      });
      executionIdRef.current = data.executionId;
      dispatch({ type: 'SET_RESOLVED_MODEL', model: data.model ?? null, effort: data.effort ?? null });
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start' });
      // Release session.isRunning for hosts that latched on SUBMIT_START.
      completeOnce(false);
    }
  }, [projectPath, state.sessionId, addLog, connectToStream, completeOnce, enabledSkills]);

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
        onTaskComplete?.(tid, status.status === 'completed');
        dispatch({ type: 'STUCK_RESOLVED', success: status.status === 'completed' });
        return;
      }
      if (status.isStale) {
        completedRef.current = true;
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        clearHeartbeat();
        registerTaskComplete(tid, instanceId, false);
        onTaskComplete?.(tid, false);
        dispatch({ type: 'STUCK_RESOLVED', success: false });
      }
    }, UI_TIMEOUTS.stuckCheckInterval);
    return () => { if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; } };
  }, [visible, autoStart, streaming, taskId, instanceId, onTaskComplete, clearHeartbeat]);

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
      // Re-show: reconnect SSE if we were streaming when hidden
      if (streaming && savedStreamUrlRef.current && !eventSourceRef.current) {
        connectToStream(savedStreamUrlRef.current);
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

  // --- Cleanup on unmount ---

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
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
    handleAbort,
    handleClear,
  };
}
