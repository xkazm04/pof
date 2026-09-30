'use client';

import { useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Terminal, Minimize2, Loader2, X } from 'lucide-react';
import { CompactTerminal } from './CompactTerminal';
import { SuggestedActions, type SuggestionAction } from './SuggestedActions';
import { useCLIPanelStore, type DispatchRecord, type PendingCallback } from './store/cliPanelStore';
import { bindSessionRun } from './store/sessionRun';
import { resubmitPendingCallbacks } from '@/components/cli/suggestionIntents';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

interface InlineTerminalProps {
  sessionId: string;
  minHeight?: number;
  maxHeight?: number;
  visible?: boolean;
}

export function InlineTerminal({
  sessionId,
  minHeight = 150,
  maxHeight = 500,
  visible = true,
}: InlineTerminalProps) {
  const session = useCLIPanelStore((s) => s.sessions[sessionId]);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);
  const removeSession = useCLIPanelStore((s) => s.removeSession);
  // The session's run door: run start, stream end ('settling') and the run's single
  // completion all report through one sequenced binding (see store/sessionRun.ts).
  const run = useMemo(() => bindSessionRun(sessionId), [sessionId]);
  // Run facts the post-run bar acts on — kept in memory only (stripped from persistence).
  const runFacts = useMemo(() => ({
    onDispatch: (dispatch: DispatchRecord) => useCLIPanelStore.getState().recordDispatch(sessionId, dispatch),
    onCallbacksUnresolved: (markers: PendingCallback[]) => useCLIPanelStore.getState().setPendingCallbacks(sessionId, markers),
    // The server run this session owns — persisted, so a reload re-attaches to it
    // (CompactTerminal); endRun clears it. Only a run still open may claim it.
    onExecutionStarted: (executionId: string) => {
      const store = useCLIPanelStore.getState();
      if (store.sessions[sessionId]?.isRunning) store.setCurrentExecution(sessionId, executionId, null);
    },
  }), [sessionId]);
  const height = useCLIPanelStore((s) => s.inlineTerminalHeight);
  const setInlineTerminalHeight = useCLIPanelStore((s) => s.setInlineTerminalHeight);
  const projectPath = useProjectStore((s) => s.projectPath);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        setInlineTerminalHeight(Math.max(minHeight, Math.min(maxHeight, startHeight + delta)));
      };

      const onMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [height, minHeight, maxHeight, setInlineTerminalHeight]
  );

  const handleSuggestionAction = useCallback((action: SuggestionAction) => {
    switch (action.type) {
      case 'redispatch':
      case 'resume':
        // This terminal is mounted right below the bar, so its pof-cli-prompt
        // listener is live — the prompt goes straight to its submitPrompt.
        window.dispatchEvent(
          new CustomEvent('pof-cli-prompt', {
            detail: {
              tabId: sessionId,
              prompt: action.prompt,
              taskType: action.taskType,
              resume: action.type === 'resume' ? true : action.resume,
            },
          })
        );
        break;
      case 'resubmit-callback':
        void resubmitPendingCallbacks(sessionId);
        break;
      case 'navigate': {
        const nav = useNavigationStore.getState();
        if (action.moduleId && nav.activeSubModule !== action.moduleId) nav.navigateToModule(action.moduleId);
        window.dispatchEvent(
          new CustomEvent('pof-navigate-tab', {
            detail: { tab: action.tab, moduleId: action.moduleId },
          })
        );
        break;
      }
    }
  }, [sessionId]);

  if (!session) return null;

  return (
    <motion.div
      className="border-t border-border bg-surface-deep flex flex-col overflow-hidden"
      style={{ height }}
      initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { height, opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
    >
      {/* Resize handle (top edge — drag up to grow) */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="h-2 w-full cursor-ns-resize bg-border hover:bg-border-bright transition-colors flex items-center justify-center group shrink-0"
        style={{ boxShadow: '0 -2px 4px rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center gap-1">
          <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
          <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
          <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
        </div>
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {session.isRunning ? (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: session.accentColor }} />
          ) : (
            <Terminal className="w-3 h-3" style={{ color: session.accentColor }} />
          )}
          <span className="text-xs font-medium text-text">{session.label}</span>
          {session.isRunning && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-medium" style={{ color: MODULE_COLORS.setup }}>
              running
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={minimizeTab}
            className="p-1.5 text-text-muted hover:text-text transition-colors"
            title="Minimize to bottom bar"
            aria-label="Minimize to bottom bar"
          >
            <Minimize2 className="w-3 h-3" aria-hidden="true" />
          </button>
          <button
            onClick={() => removeSession(sessionId)}
            className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
            title="Close terminal"
            aria-label="Close terminal"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Suggested next actions (shown after task completion) */}
      <SuggestedActions
        session={session}
        onAction={handleSuggestionAction}
        accentColor={session.accentColor}
      />

      {/* Terminal body */}
      <div className="flex-1 overflow-hidden">
        <CompactTerminal
          instanceId={sessionId}
          projectPath={session.projectPath || projectPath || ''}
          title={session.label}
          className="h-full"
          enabledSkills={session.enabledSkills}
          onTaskStart={run.onTaskStart}
          onStreamingChange={run.onStreamingChange}
          onTaskComplete={run.onTaskComplete}
          onDispatch={runFacts.onDispatch}
          onCallbacksUnresolved={runFacts.onCallbacksUnresolved}
          onExecutionStarted={runFacts.onExecutionStarted}
          visible={visible}
        />
      </div>
    </motion.div>
  );
}
