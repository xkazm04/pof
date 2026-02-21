'use client';

import { useEffect, useCallback, useRef, useState, useReducer } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { extractCallbackPayload, resolveCallback } from '@/lib/cli-task';
import type {
  QueuedTask, FileChange, LogEntry,
  ExecutionInfo, ExecutionResult, CLISSEEvent,
} from './types';
import type { SkillId } from './skills';
import { buildSkillsPrompt } from './skills';
import {
  registerTaskStart, registerTaskComplete, sendTaskHeartbeat,
  getTaskStatus, clearSessionTasks,
} from './taskRegistry';
import { parseBuildOutput, type BuildParseResult } from './UE5BuildParser';

interface UseTaskQueueOpts {
  instanceId: string;
  projectPath: string;
  taskQueue: QueuedTask[];
  autoStart: boolean;
  enabledSkills: SkillId[];
  visible?: boolean;
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, success: boolean) => void;
  onQueueEmpty?: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  onBatchFlushed?: (count: number) => void;
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
}

type TaskQueueAction =
  | { type: 'TASK_START'; taskId: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SSE_CONNECTED'; info: ExecutionInfo; sessionId?: string }
  | { type: 'SSE_RESULT'; result: ExecutionResult; sessionId?: string }
  | { type: 'SSE_ERROR'; error: string }
  | { type: 'START_FAILED'; error: string }
  | { type: 'SET_LOG_FILE'; path: string }
  | { type: 'ABORT' }
  | { type: 'TASK_DONE' }
  | { type: 'STUCK_RESOLVED'; success: boolean }
  | { type: 'CLEAR' };

const INITIAL_STATE: TaskQueueState = {
  current: { phase: 'idle' },
  sessionId: null,
  logFilePath: null,
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
  currentTaskIdRef.current = taskId;

  /** Tracks task IDs already dispatched to prevent duplicate execution */
  const dispatchedTaskIds = useRef<Set<string>>(new Set());
  /** Capped at 200 entries — oldest evicted first when full */
  const buildParseCache = useRef<Map<string, BuildParseResult>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  /** Accumulated assistant output for current task — used for callback extraction */
  const assistantOutputRef = useRef<string>('');
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNextTaskRef = useRef<NodeJS.Timeout | null>(null);
  const savedStreamUrlRef = useRef<string | null>(null);

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
          buildParseCache.current.set(logId, parsed);
          if (buildParseCache.current.size > 200) {
            const firstKey = buildParseCache.current.keys().next().value;
            if (firstKey !== undefined) buildParseCache.current.delete(firstKey);
          }
        }
        addLog({ id: logId, type: 'tool_result', content: fullContent.slice(0, 200), timestamp: event.timestamp });
        break;
      }
      case 'result': {
        const data = event.data as ExecutionResult;
        dispatch({ type: 'SSE_RESULT', result: data, sessionId: data.sessionId });
        clearHeartbeat();

        // Process structured callback if present in assistant output
        const cbMatch = extractCallbackPayload(assistantOutputRef.current);
        if (cbMatch) {
          resolveCallback(cbMatch.callbackId, cbMatch.payload).then((cbResult) => {
            if (cbResult.success) {
              addLog({ id: `cb-ok-${Date.now()}`, type: 'system', content: `Callback submitted successfully`, timestamp: Date.now() });
            } else {
              addLog({ id: `cb-err-${Date.now()}`, type: 'error', content: `Callback failed: ${cbResult.error}`, timestamp: Date.now() });
            }
          });
        }
        assistantOutputRef.current = '';

        const tid = currentTaskIdRef.current;
        if (tid) {
          registerTaskComplete(tid, instanceId, !data.isError);
          onTaskComplete?.(tid, !data.isError);
        }

        break;
      }
      case 'error': {
        const data = event.data as { error: string };
        dispatch({ type: 'SSE_ERROR', error: data.error });
        clearHeartbeat();
        addLog({ id: `error-${Date.now()}`, type: 'error', content: data.error, timestamp: event.timestamp });
        assistantOutputRef.current = '';
        const tid = currentTaskIdRef.current;
        if (tid) {
          registerTaskComplete(tid, instanceId, false);
          onTaskComplete?.(tid, false);
        }
        break;
      }
    }
  }, [addLog, addFileChange, instanceId, onTaskComplete, clearHeartbeat]);

  const connectToStream = useCallback((streamUrl: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    savedStreamUrlRef.current = streamUrl;
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
    eventSource.onerror = () => { eventSource.close(); eventSourceRef.current = null; };
  }, [handleSSEEvent]);

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
    dispatch({ type: 'TASK_START', taskId: task.id });
    onTaskStart?.(task.id);

    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => sendTaskHeartbeat(task.id), UI_TIMEOUTS.heartbeatInterval);

    const skillsPrefix = !resumeSession && enabledSkills.length > 0 ? buildSkillsPrompt(enabledSkills) : '';
    const taskPrompt = `${skillsPrefix}${task.prompt}`;

    addLog({ id: `task-${Date.now()}`, type: 'system', content: `Starting: ${task.label}`, timestamp: Date.now() });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt: taskPrompt, resumeSessionId: resumeSession ? state.sessionId : undefined }),
      });
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start task' });
      registerTaskComplete(task.id, instanceId, false);
      onTaskComplete?.(task.id, false);
      clearHeartbeat();
    }
  }, [state.sessionId, instanceId, projectPath, addLog, connectToStream, onTaskStart, onTaskComplete, enabledSkills, clearHeartbeat]);

  // --- Manual submit (user input) ---

  const submitPrompt = useCallback(async (prompt: string, resumeSession: boolean) => {
    assistantOutputRef.current = '';
    dispatch({ type: 'SUBMIT_START' });
    addLog({ id: `user-${Date.now()}`, type: 'user', content: prompt, timestamp: Date.now() });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt, resumeSessionId: resumeSession ? state.sessionId : undefined }),
      });
      if (data.logFilePath) dispatch({ type: 'SET_LOG_FILE', path: data.logFilePath });
      connectToStream(data.streamUrl);
    } catch (e) {
      dispatch({ type: 'START_FAILED', error: e instanceof Error ? e.message : 'Failed to start' });
    }
  }, [projectPath, state.sessionId, addLog, connectToStream]);

  // --- Abort ---

  const handleAbort = useCallback(async () => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    clearHeartbeat();
    const tid = currentTaskIdRef.current;
    if (tid) {
      registerTaskComplete(tid, instanceId, false);
      onTaskComplete?.(tid, false);
    }
    dispatch({ type: 'ABORT' });
  }, [instanceId, onTaskComplete, clearHeartbeat]);

  // --- Clear ---

  const handleClear = useCallback(async () => {
    await clearSessionTasks(instanceId);
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    logBufferRef.current = [];
    setLogs([]);
    setFileChanges([]);
    dispatchedTaskIds.current.clear();
    buildParseCache.current.clear();
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
      const tid = currentTaskIdRef.current;
      if (!tid) return;
      const status = await getTaskStatus(tid);
      if (status.found && status.status !== 'running') {
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        clearHeartbeat();
        onTaskComplete?.(tid, status.status === 'completed');
        dispatch({ type: 'STUCK_RESOLVED', success: status.status === 'completed' });
      }
      if (status.isStale) {
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
    buildParseCache,
    submitPrompt,
    handleAbort,
    handleClear,
  };
}
