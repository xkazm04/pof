'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Minimize2, Loader2, X } from 'lucide-react';
import { CompactTerminal } from './CompactTerminal';
import { useCLIPanelStore } from './store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';

interface InlineTerminalProps {
  sessionId: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  visible?: boolean;
}

export function InlineTerminal({
  sessionId,
  defaultHeight = 300,
  minHeight = 150,
  maxHeight = 500,
  visible = true,
}: InlineTerminalProps) {
  const session = useCLIPanelStore((s) => s.sessions[sessionId]);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);
  const removeSession = useCLIPanelStore((s) => s.removeSession);
  const setSessionRunning = useCLIPanelStore((s) => s.setSessionRunning);
  const projectPath = useProjectStore((s) => s.projectPath);
  const [height, setHeight] = useState(defaultHeight);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        setHeight(Math.max(minHeight, Math.min(maxHeight, startHeight + delta)));
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
    [height, minHeight, maxHeight]
  );

  if (!session) return null;

  return (
    <motion.div
      className="border-t border-[#1e1e3a] bg-[#0d0d22] flex flex-col overflow-hidden"
      style={{ height }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
    >
      {/* Resize handle (top edge — drag up to grow) */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="h-1 w-full cursor-ns-resize bg-[#1e1e3a] hover:bg-[#2e2e5a] transition-colors flex items-center justify-center group shrink-0"
      >
        <div className="w-8 h-0.5 rounded-full bg-[#2e2e5a] group-hover:bg-[#6b7294] transition-colors" />
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#0a0a1a] border-b border-[#1e1e3a] shrink-0">
        <div className="flex items-center gap-2">
          {session.isRunning ? (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: session.accentColor }} />
          ) : (
            <Terminal className="w-3 h-3" style={{ color: session.accentColor }} />
          )}
          <span className="text-[11px] font-medium text-[#e0e4f0]">{session.label}</span>
          {session.isRunning && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]">
              running
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={minimizeTab}
            className="p-1 text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
            title="Minimize to bottom bar"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => removeSession(sessionId)}
            className="p-1 text-[#6b7294] hover:text-red-400 transition-colors"
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
