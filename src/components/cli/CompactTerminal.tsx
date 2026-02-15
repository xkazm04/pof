'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useListRef } from 'react-window';
import type { CompactTerminalProps } from './types';
import { useTaskQueue } from './useTaskQueue';
import { useScrollSync } from './useScrollSync';
import { useInputHistory } from './useInputHistory';
import { TerminalHeader } from './TerminalHeader';
import { TerminalOutput } from './TerminalOutput';
import { TerminalInput } from './TerminalInput';
import { AntiPatternWarning } from './AntiPatternWarning';
import { useCLIPanelStore } from './store/cliPanelStore';

export function CompactTerminal({
  instanceId, projectPath, title = 'Terminal', className = '',
  taskQueue = [], onTaskStart, onTaskComplete, onQueueEmpty,
  autoStart = false, enabledSkills = [], onStreamingChange, visible = true,
}: CompactTerminalProps) {
  const sessionModuleId = useCLIPanelStore((s) => s.sessions[instanceId]?.moduleId);
  const accentColor = useCLIPanelStore((s) => s.sessions[instanceId]?.accentColor ?? '#3b82f6');
  const [input, setInput] = useState('');
  const listRef = useListRef(null);
  const history = useInputHistory();

  // Create useTaskQueue first (it owns logs state)
  // Pass addUnseenCount via a stable ref to break the circular init dependency
  const addUnseenCountRef = useRef<(count: number) => void>(() => {});
  const onBatchFlushed = useCallback((count: number) => {
    addUnseenCountRef.current(count);
  }, []);

  const tq = useTaskQueue({
    instanceId, projectPath, taskQueue, autoStart, enabledSkills, visible,
    onTaskStart, onTaskComplete, onQueueEmpty, onStreamingChange,
    onBatchFlushed,
  });

  // Always virtualize — older logs go to react-window, recent tail (8) stays outside
  const virtualizedLogCount = useMemo(() => Math.max(0, tq.logs.length - 8), [tq.logs.length]);

  const scroll = useScrollSync({
    logCount: tq.logs.length,
    visible,
    virtualizedLogCount,
    listRef,
  });

  // Keep the indirection ref pointing to the real callback
  useEffect(() => {
    addUnseenCountRef.current = scroll.addUnseenCount;
  }, [scroll.addUnseenCount]);

  // --- Submit / Resume / BuildFix ---

  const pendingPromptRef = useRef<string | null>(null);

  const handleSubmit = useCallback(async (resume = false) => {
    if (!input.trim() || tq.isStreaming) return;
    const prompt = input.trim();
    setInput('');
    history.resetHeight();
    history.pushHistory(prompt);

    if (prompt === '/fix') {
      await tq.executeImprovement();
    } else {
      await tq.submitPrompt(prompt, resume && tq.sessionId !== null);
    }
  }, [input, tq, history]);

  const handleInputSubmit = useCallback((resume: boolean) => {
    handleSubmit(resume);
  }, [handleSubmit]);

  const handleResume = useCallback(() => {
    setInput('Continue');
    setTimeout(() => handleSubmit(true), 0);
  }, [handleSubmit]);

  // Listen for pof-cli-prompt events
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
    if (pendingPromptRef.current && input === pendingPromptRef.current && !tq.isStreaming) {
      pendingPromptRef.current = null;
      const timer = setTimeout(() => handleSubmit(tq.sessionId !== null), 50);
      return () => clearTimeout(timer);
    }
  }, [input, tq.isStreaming, tq.sessionId, handleSubmit]);

  // Build fix prompt injection
  const handleBuildFix = useCallback((prompt: string) => {
    if (tq.isStreaming) return;
    setInput(prompt);
    pendingPromptRef.current = prompt;
  }, [tq.isStreaming]);

  // Empty state prompt chip fill — just fills input without submitting
  const handlePromptFill = useCallback((prompt: string) => {
    setInput(prompt);
    history.inputRef.current?.focus();
  }, [history.inputRef]);

  // --- Derived counts ---

  const editCount = tq.fileChanges.filter(c => c.changeType === 'edit').length;
  const writeCount = tq.fileChanges.filter(c => c.changeType === 'write').length;
  const queuePendingCount = taskQueue.filter(t => t.status === 'pending').length;

  const handleCopyOutput = useCallback((): string | null => {
    // Find the last assistant message in logs
    for (let i = tq.logs.length - 1; i >= 0; i--) {
      if (tq.logs[i].type === 'assistant' && tq.logs[i].content.trim()) {
        return tq.logs[i].content;
      }
    }
    return null;
  }, [tq.logs]);

  return (
    <div className={`flex flex-col bg-background overflow-hidden ${className}`}>
      <TerminalHeader
        title={title}
        sessionId={tq.sessionId}
        isStreaming={tq.isStreaming}
        executionInfo={tq.executionInfo}
        lastResult={tq.lastResult}
        logFilePath={tq.logFilePath}
        editCount={editCount}
        writeCount={writeCount}
        queuePendingCount={queuePendingCount}
        onClear={tq.handleClear}
        onResume={handleResume}
        onCopyOutput={handleCopyOutput}
      />

      <TerminalOutput
        logs={tq.logs}
        isStreaming={tq.isStreaming}
        queuePendingCount={queuePendingCount}
        scrollRef={scroll.scrollRef}
        listRef={listRef}
        onScroll={scroll.handleScroll}
        buildParseCache={tq.buildParseCache}
        onBuildFix={handleBuildFix}
        scrollBtnVisible={scroll.scrollBtnVisible}
        isAutoScroll={scroll.isAutoScroll}
        unseenCount={scroll.unseenCount}
        onScrollToBottom={scroll.scrollToBottom}
        accentColor={accentColor}
        onPromptFill={handlePromptFill}
      />

      <AntiPatternWarning
        prompt={input}
        moduleId={sessionModuleId}
      />

      <TerminalInput
        input={input}
        setInput={setInput}
        inputRef={history.inputRef}
        isStreaming={tq.isStreaming}
        onSubmit={handleInputSubmit}
        onAbort={tq.handleAbort}
        onNavigateHistory={history.navigateHistory}
      />
    </div>
  );
}
