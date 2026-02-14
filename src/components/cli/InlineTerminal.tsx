'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Minimize2, Loader2, X } from 'lucide-react';
import { CompactTerminal } from './CompactTerminal';
import { useCLIPanelStore } from './store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';

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
  const setSessionRunning = useCLIPanelStore((s) => s.setSessionRunning);
  const height = useCLIPanelStore((s) => s.inlineTerminalHeight);
  const setInlineTerminalHeight = useCLIPanelStore((s) => s.setInlineTerminalHeight);
  const projectPath = useProjectStore((s) => s.projectPath);

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

  if (!session) return null;

  return (
    <motion.div
      className="border-t border-border bg-surface-deep flex flex-col overflow-hidden"
      style={{ height }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
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
            <span className="text-2xs px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]">
              running
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={minimizeTab}
            className="p-1 text-text-muted hover:text-text transition-colors"
            title="Minimize to bottom bar"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => removeSession(sessionId)}
            className="p-1 text-text-muted hover:text-red-400 transition-colors"
            title="Close terminal"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div className="flex-1 overflow-hidden">
        <CompactTerminal
          instanceId={sessionId}
          projectPath={session.projectPath || projectPath || ''}
          title={session.label}
          className="h-full"
          enabledSkills={session.enabledSkills}
          onStreamingChange={(streaming) => setSessionRunning(sessionId, streaming)}
          onTaskComplete={(_taskId, success) => setSessionRunning(sessionId, false, success)}
          visible={visible}
        />
      </div>
    </motion.div>
  );
}
