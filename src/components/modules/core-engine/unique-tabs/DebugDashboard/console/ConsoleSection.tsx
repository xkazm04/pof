'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Play, Loader2, CornerDownLeft,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  ACCENT_EMERALD, OPACITY_10, OPACITY_30,
  withOpacity, OPACITY_37, OPACITY_80, OPACITY_87, OPACITY_5,
} from '@/lib/chart-colors';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { CommandCatalog } from './CommandCatalog';
import { ACCENT, type ConsoleHistoryEntry } from '../data';

/* -- Interactive Console --------------------------------------------------- */

export function ConsoleSection() {
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<ConsoleHistoryEntry[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cmdHistory.length]);

  const executeCommand = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || isExecuting) return;
    const entryId = `cmd-${Date.now()}`;
    const entry: ConsoleHistoryEntry = { id: entryId, command: trimmed, timestamp: Date.now(), status: 'pending' };
    setCmdHistory(prev => [...prev, entry]);
    setCmdInput('');
    setCmdHistoryIdx(-1);
    setIsExecuting(true);
    const client = ue5Connection.getClient();
    if (!client) {
      setCmdHistory(prev => prev.map(e =>
        e.id === entryId ? { ...e, status: 'error' as const, output: 'UE5 not connected — command queued locally' } : e
      ));
      setIsExecuting(false);
      return;
    }
    const result = await client.executeConsoleCommand(trimmed);
    setCmdHistory(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      return result.ok
        ? { ...e, status: 'success' as const, output: `Executed: ${trimmed}` }
        : { ...e, status: 'error' as const, output: result.error };
    }));
    setIsExecuting(false);
  }, [isExecuting]);

  const handleCmdKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(cmdInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const executed = cmdHistory.filter(h => h.status !== 'pending');
      if (executed.length === 0) return;
      const nextIdx = cmdHistoryIdx < 0 ? executed.length - 1 : Math.max(0, cmdHistoryIdx - 1);
      setCmdHistoryIdx(nextIdx);
      setCmdInput(executed[nextIdx].command);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const executed = cmdHistory.filter(h => h.status !== 'pending');
      if (cmdHistoryIdx < 0) return;
      const nextIdx = cmdHistoryIdx + 1;
      if (nextIdx >= executed.length) { setCmdHistoryIdx(-1); setCmdInput(''); }
      else { setCmdHistoryIdx(nextIdx); setCmdInput(executed[nextIdx].command); }
    }
  }, [cmdInput, cmdHistory, cmdHistoryIdx, executeCommand]);

  const populateCommand = useCallback((syntax: string) => {
    setCmdInput(syntax);
    cmdInputRef.current?.focus();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="INTERACTIVE_CONSOLE" color={ACCENT} icon={Terminal} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted shrink-0 ml-2">
          {cmdHistory.length > 0 ? `${cmdHistory.length} CMD${cmdHistory.length !== 1 ? 'S' : ''} IN HISTORY` : 'NO HISTORY'}
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
        {/* Console output */}
        <div className="max-h-48 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {cmdHistory.length === 0 && (
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted py-2">
              TYPE A COMMAND BELOW OR CLICK FROM THE CATALOG
            </div>
          )}
          <AnimatePresence initial={false}>
            {cmdHistory.map((entry) => (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: `${withOpacity(ACCENT, OPACITY_37)}` }}>&gt;</span>
                  <span className="font-bold" style={{ color: withOpacity(ACCENT, OPACITY_87) }}>{entry.command}</span>
                  <span className="text-text-muted ml-auto text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                {entry.status === 'pending' ? (
                  <div className="flex items-center gap-1.5 pl-4" style={{ color: `${withOpacity(ACCENT, OPACITY_37)}` }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs font-mono uppercase tracking-[0.15em]">EXECUTING...</span>
                  </div>
                ) : (
                  <div className="pl-4 flex items-start gap-1.5">
                    {entry.status === 'success'
                      ? <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
                      : <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />}
                    <span style={{ color: entry.status === 'success' ? `${withOpacity(STATUS_SUCCESS, OPACITY_80)}` : `${withOpacity(STATUS_WARNING, OPACITY_80)}` }}>
                      {entry.output}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={historyEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-2 flex items-center gap-2" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
          <span className="font-mono text-sm font-bold pl-1" style={{ color: ACCENT }}>&gt;</span>
          <input ref={cmdInputRef} type="text" placeholder="Type a console command..."
            value={cmdInput} onChange={(e) => setCmdInput(e.target.value)} onKeyDown={handleCmdKeyDown} disabled={isExecuting}
            className="flex-1 text-xs font-mono bg-transparent border-none text-text-primary placeholder:text-text-muted focus:outline-none uppercase tracking-[0.15em] disabled:opacity-50"
          />
          <button onClick={() => executeCommand(cmdInput)} disabled={!cmdInput.trim() || isExecuting}
            className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-all disabled:opacity-30"
            style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD, borderColor: `${ACCENT_EMERALD}${OPACITY_30}` }}>
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} EXEC
          </button>
          <span className="text-xs font-mono text-text-muted hidden sm:inline">
            <CornerDownLeft className="w-3 h-3 inline" /> ENTER
          </span>
        </div>
      </BlueprintPanel>

      <CommandCatalog onExecute={executeCommand} onPopulate={populateCommand} isExecuting={isExecuting} />
    </motion.div>
  );
}
