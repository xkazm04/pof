'use client';

import { useCallback, useState } from 'react';
import {
  Terminal, CheckCircle, Loader2, Trash2, RotateCcw, FileText, Copy,
} from 'lucide-react';
import type { ExecutionInfo, ExecutionResult } from './types';
import { UI_TIMEOUTS } from '@/lib/constants';
import { MODULE_COLORS, CLI_COLORS } from '@/lib/chart-colors';

interface TerminalHeaderProps {
  title: string;
  sessionId: string | null;
  isStreaming: boolean;
  executionInfo: ExecutionInfo | null;
  lastResult: ExecutionResult | null;
  logFilePath: string | null;
  editCount: number;
  writeCount: number;
  queuePendingCount: number;
  onClear: () => void;
  onResume: () => void;
  onCopyOutput?: () => string | null;
}

export function TerminalHeader({
  title, sessionId, isStreaming, executionInfo, lastResult,
  logFilePath, editCount, writeCount, queuePendingCount,
  onClear, onResume, onCopyOutput,
}: TerminalHeaderProps) {
  const [logCopied, setLogCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);

  const copyLogPath = useCallback(() => {
    if (!logFilePath) return;
    navigator.clipboard.writeText(logFilePath).then(() => {
      setLogCopied(true);
      setTimeout(() => setLogCopied(false), UI_TIMEOUTS.copyFeedback);
    }).catch(() => {});
  }, [logFilePath]);

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-deep border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" style={{ color: MODULE_COLORS.core }} />
          <span className="text-xs font-medium text-text">{title}</span>
          {sessionId && <span className="text-xs text-text-muted font-mono">{sessionId.slice(0, 6)}</span>}
        </div>
        <div className="flex items-center gap-1">
          {queuePendingCount > 0 && (
            <span className={`text-xs ${CLI_COLORS.info} px-1.5 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20`}>Q:{queuePendingCount}</span>
          )}
          {(editCount > 0 || writeCount > 0) && (
            <div className="flex items-center gap-1 mr-2 text-xs">
              {editCount > 0 && <span className={CLI_COLORS.warning}>{editCount}E</span>}
              {writeCount > 0 && <span className={CLI_COLORS.success}>{writeCount}W</span>}
            </div>
          )}
          {sessionId && !isStreaming && (
            <button onClick={onResume} className="p-1 hover:bg-surface-hover rounded transition-colors" style={{ color: MODULE_COLORS.core }} title="Resume session">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button onClick={onClear} disabled={isStreaming} className={`p-1 hover:bg-surface-hover rounded text-text-muted hover:${CLI_COLORS.error} disabled:opacity-50 transition-colors`} title="Clear">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 text-xs text-text-muted bg-background border-b border-border/50">
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className={`flex items-center gap-1 ${CLI_COLORS.warning}`}><Loader2 className="w-2.5 h-2.5 animate-spin" />Running</span>
          ) : lastResult?.isError ? (
            <span className={CLI_COLORS.error}>Error</span>
          ) : lastResult ? (
            <span className={CLI_COLORS.success}>Done</span>
          ) : (
            <span>Ready</span>
          )}
          {executionInfo?.model && <span className="text-text-muted">{String(executionInfo.model).split('-').slice(-2).join('-')}</span>}
        </div>
        <div className="flex items-center gap-2">
          {onCopyOutput && !isStreaming && lastResult && (
            <button
              onClick={() => {
                const text = onCopyOutput();
                if (text) {
                  navigator.clipboard.writeText(text).then(() => {
                    setOutputCopied(true);
                    setTimeout(() => setOutputCopied(false), UI_TIMEOUTS.copyFeedback);
                  }).catch(() => {});
                }
              }}
              className="flex items-center gap-1 text-text-muted hover:text-text transition-colors"
              title="Copy last Claude response"
            >
              {outputCopied ? <CheckCircle className={`w-2.5 h-2.5 ${CLI_COLORS.success}`} /> : <Copy className="w-2.5 h-2.5" />}
              <span>{outputCopied ? 'Copied' : 'Output'}</span>
            </button>
          )}
          {logFilePath && (
            <button
              onClick={copyLogPath}
              className="flex items-center gap-1 text-text-muted hover:text-text transition-colors"
              title={logFilePath}
            >
              {logCopied ? <CheckCircle className={`w-2.5 h-2.5 ${CLI_COLORS.success}`} /> : <FileText className="w-2.5 h-2.5" />}
              <span>{logCopied ? 'Copied' : 'Log'}</span>
            </button>
          )}
          {lastResult?.usage && (
            <span className="text-text-muted">{(lastResult.usage.inputTokens / 1000).toFixed(1)}k/{(lastResult.usage.outputTokens / 1000).toFixed(1)}k</span>
          )}
        </div>
      </div>
    </>
  );
}
