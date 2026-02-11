'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, useListRef, type RowComponentProps, type ListImperativeAPI } from 'react-window';
import {
  Terminal, User, Bot, Wrench, CheckCircle, AlertCircle,
  Send, Square, Loader2, Trash2, RotateCcw, ChevronDown,
  FileEdit, FilePlus, Eye, ListOrdered, FileText, Copy,
} from 'lucide-react';
import type {
  CompactTerminalProps, QueuedTask, FileChange, LogEntry,
  ExecutionInfo, ExecutionResult, CLISSEEvent,
} from './types';
import { buildSkillsPrompt } from './skills';
import {
  registerTaskStart, registerTaskComplete, sendTaskHeartbeat,
  getTaskStatus, clearSessionTasks,
} from './taskRegistry';

const LOG_ICON_SIZE = 'w-3 h-3';

const LOG_TYPE_ICONS: Record<LogEntry['type'], { icon: typeof User; colorClass: string }> = {
  user: { icon: User, colorClass: 'text-blue-400' },
  assistant: { icon: Bot, colorClass: 'text-purple-400' },
  tool_use: { icon: Wrench, colorClass: 'text-yellow-400' },
  tool_result: { icon: CheckCircle, colorClass: 'text-green-400' },
  error: { icon: AlertCircle, colorClass: 'text-red-400' },
  system: { icon: ListOrdered, colorClass: 'text-cyan-400' },
};

const TOOL_ICONS: Record<string, { icon: typeof FileEdit; colorClass: string }> = {
  Edit: { icon: FileEdit, colorClass: 'text-yellow-400' },
  Write: { icon: FilePlus, colorClass: 'text-green-400' },
  Read: { icon: Eye, colorClass: 'text-blue-400' },
};

const LOG_ITEM_HEIGHT = 24;
const ANIMATED_LOG_COUNT = 5;
const VIRTUALIZATION_THRESHOLD = 50;

const getLogIcon = (type: LogEntry['type'], toolName?: string) => {
  if (type === 'tool_use' && toolName) {
    const toolIcon = TOOL_ICONS[toolName];
    if (toolIcon) {
      const Icon = toolIcon.icon;
      return <Icon className={`${LOG_ICON_SIZE} ${toolIcon.colorClass}`} />;
    }
  }
  const config = LOG_TYPE_ICONS[type];
  if (config) {
    const Icon = config.icon;
    return <Icon className={`${LOG_ICON_SIZE} ${config.colorClass}`} />;
  }
  return <Bot className={`${LOG_ICON_SIZE} text-gray-400`} />;
};

const formatLogContent = (log: LogEntry) => {
  if (log.type === 'tool_use' && log.toolInput?.file_path) {
    const fileName = String(log.toolInput.file_path).split(/[/\\]/).pop();
    return `${log.toolName}: ${fileName}`;
  }
  if (log.type === 'tool_result') {
    return log.content.length > 120 ? log.content.slice(0, 120) + '...' : log.content;
  }
  return log.content.length > 200 ? log.content.slice(0, 200) + '...' : log.content;
};

const getLogTextClass = (type: LogEntry['type']) => {
  switch (type) {
    case 'error': return 'text-red-400';
    case 'user': return 'text-blue-300';
    case 'tool_result': return 'text-[#6b7294] font-mono';
    case 'system': return 'text-cyan-400';
    default: return 'text-[#e0e4f0]';
  }
};

interface LogRowData { logs: LogEntry[]; }

function LogRow({ index, style, logs }: RowComponentProps<LogRowData>) {
  const log = logs[index];
  return (
    <div style={style} className="flex items-start gap-2 px-3 py-0.5 hover:bg-[#1a1a3a]/40 transition-colors duration-150">
      <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
      <span className={`text-xs leading-relaxed break-all truncate ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
    </div>
  );
}

export function CompactTerminal({
  instanceId, projectPath, title = 'Terminal', className = '',
  taskQueue = [], onTaskStart, onTaskComplete, onQueueEmpty,
  autoStart = false, enabledSkills = [], onStreamingChange, visible = true,
}: CompactTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionInfo, setExecutionInfo] = useState<ExecutionInfo | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [logFilePath, setLogFilePath] = useState<string | null>(null);
  const [logCopied, setLogCopied] = useState(false);

  const currentTaskIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useListRef(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNextTaskRef = useRef<NodeJS.Timeout | null>(null);

  const useVirtualization = logs.length > VIRTUALIZATION_THRESHOLD;

  const { virtualizedLogs, animatedLogs } = useMemo(() => {
    if (!useVirtualization) return { virtualizedLogs: [], animatedLogs: logs };
    const splitIndex = Math.max(0, logs.length - ANIMATED_LOG_COUNT);
    return { virtualizedLogs: logs.slice(0, splitIndex), animatedLogs: logs.slice(splitIndex) };
  }, [logs, useVirtualization]);

  useEffect(() => {
    if (isAutoScroll) {
      if (useVirtualization && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogs.length - 1, align: 'end' });
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isAutoScroll, useVirtualization, virtualizedLogs.length]);

  // Restore scroll position when becoming visible after being hidden (display:none → block)
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisibleRef.current && isAutoScroll) {
      requestAnimationFrame(() => {
        if (useVirtualization && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogs.length - 1, align: 'end' });
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
    prevVisibleRef.current = visible;
  }, [visible, isAutoScroll, useVirtualization, virtualizedLogs.length]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setIsAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (stuckCheckIntervalRef.current) clearInterval(stuckCheckIntervalRef.current);
    };
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const addFileChange = useCallback((change: FileChange) => {
    setFileChanges(prev => {
      const exists = prev.some(c => c.filePath === change.filePath && c.toolUseId === change.toolUseId);
      return exists ? prev : [...prev, change];
    });
  }, []);

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
        addLog({ id: `result-${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'tool_result', content: typeof data.content === 'string' ? data.content.slice(0, 200) : JSON.stringify(data.content).slice(0, 200), timestamp: event.timestamp });
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
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CLISSEEvent;
        handleSSEEvent(data);
        if (data.type === 'result' || data.type === 'error') { eventSource.close(); eventSourceRef.current = null; }
      } catch (e) { console.error('Failed to parse SSE:', e); }
    };
    eventSource.onerror = () => { eventSource.close(); eventSourceRef.current = null; };
  }, [handleSSEEvent]);

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
      const response = await fetch('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt: taskPrompt, resumeSessionId: resumeSession ? sessionId : undefined }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error);
        setIsStreaming(false);
        onStreamingChange?.(false);
        registerTaskComplete(task.id, instanceId, false);
        onTaskComplete?.(task.id, false);
        currentTaskIdRef.current = null;
        setCurrentTaskId(null);
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
        return;
      }

      const data = await response.json();
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

  // Stuck task detection
  useEffect(() => {
    if (!autoStart || !isStreaming || !currentTaskId) {
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
  }, [autoStart, isStreaming, currentTaskId, instanceId, onTaskComplete, onStreamingChange]);

  // Process task queue
  useEffect(() => {
    if (pendingNextTaskRef.current) { clearTimeout(pendingNextTaskRef.current); pendingNextTaskRef.current = null; }
    if (isStreaming || taskQueue.length === 0) return;
    const nextTask = taskQueue.find(t => t.status === 'pending');
    if (nextTask && autoStart) {
      pendingNextTaskRef.current = setTimeout(() => {
        executeTask(nextTask, sessionId !== null);
      }, 3000);
    } else if (!nextTask && taskQueue.length > 0 && autoStart) {
      onQueueEmpty?.();
    }
    return () => { if (pendingNextTaskRef.current) clearTimeout(pendingNextTaskRef.current); };
  }, [taskQueue, isStreaming, autoStart, sessionId, executeTask, onQueueEmpty]);

  const handleSubmit = useCallback(async (resumeSession = false) => {
    if (!input.trim() || isStreaming) return;
    const prompt = input.trim();
    setInput('');
    setIsStreaming(true);
    onStreamingChange?.(true);
    setError(null);
    setInputHistory(prev => [...prev, prompt].slice(-50));
    setHistoryIndex(-1);
    addLog({ id: `user-${Date.now()}`, type: 'user', content: prompt, timestamp: Date.now() });

    try {
      const response = await fetch('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, prompt, resumeSessionId: resumeSession ? sessionId : undefined }),
      });
      if (!response.ok) {
        const err = await response.json();
        setError(err.error);
        setIsStreaming(false);
        onStreamingChange?.(false);
        return;
      }
      const data = await response.json();
      if (data.logFilePath) setLogFilePath(data.logFilePath);
      connectToStream(data.streamUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setIsStreaming(false);
      onStreamingChange?.(false);
    }
  }, [input, isStreaming, projectPath, sessionId, addLog, connectToStream, onStreamingChange]);

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

  const handleClear = useCallback(async () => {
    await clearSessionTasks(instanceId);
    setLogs([]);
    setFileChanges([]);
    setError(null);
    setSessionId(null);
    setLogFilePath(null);
    currentTaskIdRef.current = null;
    setCurrentTaskId(null);
    if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    if (stuckCheckIntervalRef.current) { clearInterval(stuckCheckIntervalRef.current); stuckCheckIntervalRef.current = null; }
  }, [instanceId]);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (inputHistory.length === 0) return;
    let newIndex = historyIndex;
    if (direction === 'up') newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
    else { newIndex = historyIndex === -1 ? -1 : Math.min(inputHistory.length - 1, historyIndex + 1); if (newIndex === inputHistory.length) newIndex = -1; }
    setHistoryIndex(newIndex);
    setInput(newIndex >= 0 ? inputHistory[newIndex] : '');
  }, [inputHistory, historyIndex]);

  // Listen for pof-cli-prompt events to inject and auto-submit prompts
  const pendingPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { tabId, prompt } = (e as CustomEvent).detail;
      if (tabId !== instanceId) return;
      pendingPromptRef.current = prompt;
      setInput(prompt);
    };
    window.addEventListener('pof-cli-prompt', handler);
    return () => window.removeEventListener('pof-cli-prompt', handler);
  }, [instanceId]);

  // Auto-submit when input is set from a pof-cli-prompt event
  useEffect(() => {
    if (pendingPromptRef.current && input === pendingPromptRef.current && !isStreaming) {
      pendingPromptRef.current = null;
      // Small delay to ensure state is settled
      const timer = setTimeout(() => handleSubmit(sessionId !== null), 50);
      return () => clearTimeout(timer);
    }
  }, [input, isStreaming, handleSubmit, sessionId]);

  const editCount = fileChanges.filter(c => c.changeType === 'edit').length;
  const writeCount = fileChanges.filter(c => c.changeType === 'write').length;
  const queuePendingCount = taskQueue.filter(t => t.status === 'pending').length;

  return (
    <div className={`flex flex-col bg-[#0a0a1a] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0d22] border-b border-[#1e1e3a]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span className="text-xs font-medium text-[#e0e4f0]">{title}</span>
          {sessionId && <span className="text-[10px] text-[#6b7294] font-mono">{sessionId.slice(0, 6)}</span>}
        </div>
        <div className="flex items-center gap-1">
          {queuePendingCount > 0 && (
            <span className="text-[10px] text-cyan-400 px-1.5 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20">Q:{queuePendingCount}</span>
          )}
          {(editCount > 0 || writeCount > 0) && (
            <div className="flex items-center gap-1 mr-2 text-[10px]">
              {editCount > 0 && <span className="text-yellow-400">{editCount}E</span>}
              {writeCount > 0 && <span className="text-green-400">{writeCount}W</span>}
            </div>
          )}
          {sessionId && !isStreaming && (
            <button onClick={() => { setInput('Continue'); setTimeout(() => handleSubmit(true), 0); }} className="p-1 hover:bg-[#1a1a3a] rounded text-[#3b82f6] transition-colors" title="Resume session">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button onClick={handleClear} disabled={isStreaming} className="p-1 hover:bg-[#1a1a3a] rounded text-[#6b7294] hover:text-red-400 disabled:opacity-50 transition-colors" title="Clear">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 text-[10px] text-[#6b7294] bg-[#0a0a1a] border-b border-[#1e1e3a]/50">
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="flex items-center gap-1 text-yellow-400"><Loader2 className="w-2.5 h-2.5 animate-spin" />Running</span>
          ) : lastResult?.isError ? (
            <span className="text-red-400">Error</span>
          ) : lastResult ? (
            <span className="text-green-400">Done</span>
          ) : (
            <span>Ready</span>
          )}
          {executionInfo?.model && <span className="text-[#6b7294]">{String(executionInfo.model).split('-').slice(-2).join('-')}</span>}
        </div>
        <div className="flex items-center gap-2">
          {logFilePath && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(logFilePath).then(() => {
                  setLogCopied(true);
                  setTimeout(() => setLogCopied(false), 2000);
                }).catch(() => {});
              }}
              className="flex items-center gap-1 text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
              title={logFilePath}
            >
              {logCopied ? <CheckCircle className="w-2.5 h-2.5 text-green-400" /> : <FileText className="w-2.5 h-2.5" />}
              <span>{logCopied ? 'Copied' : 'Log'}</span>
            </button>
          )}
          {lastResult?.usage && (
            <span className="text-[#6b7294]">{(lastResult.usage.inputTokens / 1000).toFixed(1)}k/{(lastResult.usage.outputTokens / 1000).toFixed(1)}k</span>
          )}
        </div>
      </div>

      {/* Log area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7294] text-xs">
            {queuePendingCount > 0 ? 'Waiting to start...' : 'Enter a prompt to start'}
          </div>
        ) : useVirtualization ? (
          <div className="py-1">
            {virtualizedLogs.length > 0 && (
              <List<LogRowData>
                listRef={listRef}
                defaultHeight={Math.min(virtualizedLogs.length * LOG_ITEM_HEIGHT, 200)}
                rowCount={virtualizedLogs.length}
                rowHeight={LOG_ITEM_HEIGHT}
                overscanCount={5}
                rowComponent={LogRow}
                rowProps={{ logs: virtualizedLogs }}
              />
            )}
            <AnimatePresence initial={false}>
              {animatedLogs.map((log) => (
                <motion.div key={log.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 px-3 py-0.5 hover:bg-[#1a1a3a]/40 transition-colors duration-150">
                  <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
                  <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-1">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div key={log.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 px-3 py-0.5 hover:bg-[#1a1a3a]/40 transition-colors duration-150">
                  <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
                  <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 px-3 py-1 text-[#3b82f6] text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Working...</span>
          </div>
        )}
      </div>

      {/* Scroll to bottom */}
      {!isAutoScroll && logs.length > 10 && (
        <button
          onClick={() => {
            setIsAutoScroll(true);
            if (useVirtualization && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogs.length - 1, align: 'end' });
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }}
          className="absolute bottom-14 right-3 p-1 bg-[#111128] border border-[#2e2e5a] rounded-full text-[#6b7294] hover:text-white hover:bg-[#1a1a3a] transition-all shadow-lg"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#1e1e3a] bg-[#0d0d22]">
        <span className="text-[#3b82f6] text-xs font-mono">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e.ctrlKey || e.metaKey); }
            if (e.key === 'ArrowUp') navigateHistory('up');
            if (e.key === 'ArrowDown') navigateHistory('down');
            if (e.key === 'Escape' && isStreaming) handleAbort();
          }}
          placeholder="Prompt... (Ctrl+Enter to resume)"
          className="flex-1 bg-transparent text-xs text-[#e0e4f0] placeholder-[#6b7294] outline-none font-mono"
        />
        {isStreaming ? (
          <button onClick={handleAbort} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
            <Square className="w-3 h-3" />
          </button>
        ) : (
          <button onClick={() => handleSubmit(false)} disabled={!input.trim()} className="p-1 text-[#3b82f6] hover:bg-[#3b82f6]/20 rounded disabled:opacity-50 transition-colors">
            <Send className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
