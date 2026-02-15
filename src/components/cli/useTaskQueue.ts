'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-utils';
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

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionInfo, setExecutionInfo] = useState<ExecutionInfo | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [logFilePath, setLogFilePath] = useState<string | null>(null);

  const currentTaskIdRef = useRef<string | null>(null);
  const buildParseCache = useRef<Map<string, BuildParseResult>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNextTaskRef = useRef<NodeJS.Timeout | null>(null);
  const savedStreamUrlRef = useRef<string | null>(null);

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

  // --- SSE event handling ---

  const handleSSEEvent = useCallback((event: CLISSEEvent) => {
    switch (event.type) {
      case 'connected': {
        const data = event.data as ExecutionInfo & { executionId?: string };
        if (data.sessionId) setSessionId(data.sessionId as string);
        setExecutionInfo(data as unknown as ExecutionInfo);
        setError(null);
        break;
      }
      case 'message': {
        const data = event.data as { type: string; content: string; model?: string };
        if (data.type === 'assistant' && data.content) {
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
        }
        addLog({ id: logId, type: 'tool_result', content: fullContent.slice(0, 200), timestamp: event.timestamp });
        break;
      }
      case 'result': {
        const data = event.data as ExecutionResult;
        if (data.sessionId) setSessionId(data.sessionId);
        setLastResult(data);
        setIsStreaming(false);
        onStreamingChange?.(false);
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
        const taskId = currentTaskIdRef.current;
        if (taskId) {
          registerTaskComplete(taskId, instanceId, !data.isError);
          onTaskComplete?.(taskId, !data.isError);
          currentTaskIdRef.current = null;
          setCurrentTaskId(null);
        }

        // Check for detected patterns after execution
        fetch('/api/claude-terminal/improve')
          .then(r => r.json())
          .then(patternData => {
            if (patternData.success && patternData.patterns?.length > 0) {
              const count = patternData.patterns.length;
              const highCount = patternData.patterns.filter(
                (p: { severity: string }) => p.severity === 'high'
              ).length;
              const summary = patternData.patterns.slice(0, 3)
                .map((p: { type: string; toolName?: string }) =>
                  `${p.type}${p.toolName ? ` (${p.toolName})` : ''}`)
                .join(', ');
              addLog({
                id: `signal-${Date.now()}`,
                type: 'system',
                content: `[signals] ${count} issue${count > 1 ? 's' : ''} detected${highCount ? ` (${highCount} high)` : ''}: ${summary}. Type /fix to resolve.`,
                timestamp: Date.now(),
              });
            }
          })
          .catch(() => {}); // Non-critical

        break;
      }
      case 'error': {
        const data = event.data as { error: string };
        setError(data.error);
        setIsStreaming(false);
        onStreamingChange?.(false);
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
        addLog({ id: `error-${Date.now()}`, type: 'error', content: data.error, timestamp: event.timestamp });
        const taskId = currentTaskIdRef.current;
        if (taskId) {
          registerTaskComplete(taskId, instanceId, false);
          onTaskComplete?.(taskId, false);
          currentTaskIdRef.current = null;
          setCurrentTaskId(null);
        }
        break;
      }
    }
  }, [addLog, addFileChange, instanceId, onTaskComplete, onStreamingChange]);

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
    let startResult = await registerTaskStart(task.id, instanceId, task.label);
    if (!startResult.success && startResult.runningTask) {
      await registerTaskComplete(startResult.runningTask.taskId, instanceId, false);
      startResult = await registerTaskStart(task.id, instanceId, task.label);
    }

    currentTaskIdRef.current = task.id;
    setIsStreaming(true);
    onStreamingChange?.(true);
    setError(null);
    setCurrentTaskId(task.id);
    onTaskStart?.(task.id);

    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => sendTaskHeartbeat(task.id), 2 * 60 * 1000);

    const skillsPrefix = !resumeSession && enabledSkills.length > 0 ? buildSkillsPrompt(enabledSkills) : '';
    const taskPrompt = `${skillsPrefix}${task.prompt}`;

    addLog({ id: `task-${Date.now()}`, type: 'system', content: `Starting: ${task.label}`, timestamp: Date.now() });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt: taskPrompt, resumeSessionId: resumeSession ? sessionId : undefined }),
      });
      if (data.logFilePath) setLogFilePath(data.logFilePath);
      connectToStream(data.streamUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start task');
      setIsStreaming(false);
      onStreamingChange?.(false);
      registerTaskComplete(task.id, instanceId, false);
      onTaskComplete?.(task.id, false);
      currentTaskIdRef.current = null;
      setCurrentTaskId(null);
      if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    }
  }, [sessionId, instanceId, projectPath, addLog, connectToStream, onTaskStart, onTaskComplete, enabledSkills, onStreamingChange]);

  // --- Manual submit (user input) ---

  const submitPrompt = useCallback(async (prompt: string, resumeSession: boolean) => {
    setIsStreaming(true);
    onStreamingChange?.(true);
    setError(null);
    addLog({ id: `user-${Date.now()}`, type: 'user', content: prompt, timestamp: Date.now() });

    try {
      const data = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt, resumeSessionId: resumeSession ? sessionId : undefined }),
      });
      if (data.logFilePath) setLogFilePath(data.logFilePath);
      connectToStream(data.streamUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setIsStreaming(false);
      onStreamingChange?.(false);
    }
  }, [projectPath, sessionId, addLog, connectToStream, onStreamingChange]);

  // --- Improvement execution (/fix command) ---

  const executeImprovement = useCallback(async () => {
    try {
      // Fetch current patterns
      const res = await fetch('/api/claude-terminal/improve');
      const data = await res.json();
      if (!data.success || !data.patterns?.length) {
        addLog({
          id: `system-${Date.now()}`,
          type: 'system',
          content: '[signals] No unresolved patterns to fix.',
          timestamp: Date.now(),
        });
        return;
      }

      // Build improvement prompt (safe for client — no node deps)
      const { buildImprovementPrompt } = await import(
        '@/lib/claude-terminal/signals/improvement-prompt'
      );
      const improvementPrompt = buildImprovementPrompt(data.patterns);

      setIsStreaming(true);
      onStreamingChange?.(true);
      setError(null);

      // Send via normal query route — uses resumeSessionId for context continuity
      const queryData = await apiFetch<{ executionId: string; streamUrl: string; logFilePath: string | null }>('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          prompt: improvementPrompt,
          resumeSessionId: sessionId || undefined,
        }),
      });

      if (queryData.logFilePath) setLogFilePath(queryData.logFilePath);
      connectToStream(queryData.streamUrl);

      // Mark patterns as resolved (optimistic)
      fetch('/api/claude-terminal/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patternFingerprints: data.patterns.map((p: { fingerprint: string }) => p.fingerprint),
        }),
      }).catch(() => {}); // Non-critical
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Improvement failed');
      setIsStreaming(false);
      onStreamingChange?.(false);
    }
  }, [projectPath, sessionId, addLog, connectToStream, onStreamingChange, setError]);

  // --- Abort ---

  const handleAbort = useCallback(async () => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    setIsStreaming(false);
    onStreamingChange?.(false);
    if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    const taskId = currentTaskIdRef.current;
    if (taskId) {
      registerTaskComplete(taskId, instanceId, false);
      onTaskComplete?.(taskId, false);
      currentTaskIdRef.current = null;
      setCurrentTaskId(null);
    }
  }, [instanceId, onTaskComplete, onStreamingChange]);

  // --- Clear ---

  const handleClear = useCallback(async () => {
    await clearSessionTasks(instanceId);
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    logBufferRef.current = [];
    setLogs([]);
    setFileChanges([]);
    setError(null);
    setSessionId(null);
    setLogFilePath(null);
    currentTaskIdRef.current = null;
    setCurrentTaskId(null);
    buildParseCache.current.clear();
    if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
  }, [instanceId]);

  // --- Stuck task detection ---

  useEffect(() => {
    if (!visible || !autoStart || !isStreaming || !currentTaskId) {
      if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
      return;
    }
    stuckCheckIntervalRef.current = setInterval(async () => {
      const taskId = currentTaskIdRef.current;
      if (!taskId) return;
      const status = await getTaskStatus(taskId);
      if (status.found && status.status !== 'running') {
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        setIsStreaming(false);
        onStreamingChange?.(false);
        onTaskComplete?.(taskId, status.status === 'completed');
        currentTaskIdRef.current = null;
        setCurrentTaskId(null);
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
      }
      if (status.isStale) {
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
        setIsStreaming(false);
        onStreamingChange?.(false);
        registerTaskComplete(taskId, instanceId, false);
        onTaskComplete?.(taskId, false);
        currentTaskIdRef.current = null;
        setCurrentTaskId(null);
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
      }
    }, 30 * 1000);
    return () => { if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; } };
  }, [visible, autoStart, isStreaming, currentTaskId, instanceId, onTaskComplete, onStreamingChange]);

  // --- Process task queue ---

  useEffect(() => {
    if (pendingNextTaskRef.current) { clearTimeout(pendingNextTaskRef.current); pendingNextTaskRef.current = null; }
    if (!visible || isStreaming || taskQueue.length === 0) return;
    const nextTask = taskQueue.find((t) => t.status === 'pending');
    if (nextTask && autoStart) {
      pendingNextTaskRef.current = setTimeout(() => {
        executeTask(nextTask, sessionId !== null);
      }, 3000);
    } else if (!nextTask && taskQueue.length > 0 && autoStart) {
      onQueueEmpty?.();
    }
    return () => { if (pendingNextTaskRef.current) clearTimeout(pendingNextTaskRef.current); };
  }, [visible, taskQueue, isStreaming, autoStart, sessionId, executeTask, onQueueEmpty]);

  // --- Visibility guard: pause resources when hidden, resume when visible ---

  useEffect(() => {
    if (visible) {
      // Re-show: reconnect SSE if we were streaming when hidden
      if (isStreaming && savedStreamUrlRef.current && !eventSourceRef.current) {
        connectToStream(savedStreamUrlRef.current);
      }
      // Heartbeat and stuck-check intervals are re-created by their own effects
      // (stuck-check depends on isStreaming+currentTaskId, heartbeat is set inside executeTask/connectToStream)
      return;
    }

    // Hidden: tear down client-side resources without aborting the backend task
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      // savedStreamUrlRef stays set so we can reconnect
    }
    if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
    if (pendingNextTaskRef.current) { clearTimeout(pendingNextTaskRef.current); pendingNextTaskRef.current = null; }
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
  }, [visible, isStreaming, connectToStream]);

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
    isStreaming,
    sessionId,
    executionInfo,
    lastResult,
    error,
    currentTaskId,
    logFilePath,
    buildParseCache,
    submitPrompt,
    executeImprovement,
    handleAbort,
    handleClear,
  };
}
