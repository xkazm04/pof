'use client';

import { useCallback, useState } from 'react';
import {
  Terminal, CheckCircle, Loader2, Trash2, RotateCcw, FileText, Copy,
  ListTodo, FileEdit, FilePlus, ArrowDown, ArrowUp,
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
        <div className="flex items-center gap-1.5">
          {(queuePendingCount > 0 || editCount > 0 || writeCount > 0) && (
            <div className="flex items-center gap-1.5 text-2xs" data-testid="pof-cli-metric-cluster">
              {queuePendingCount > 0 && (
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${CLI_COLORS.info} ${CLI_COLORS.infoBadgeBg}`}
                  title={`${queuePendingCount} prompt${queuePendingCount === 1 ? '' : 's'} queued`}
                  aria-label={`${queuePendingCount} prompt${queuePendingCount === 1 ? '' : 's'} queued`}
                >
                  <ListTodo className="w-3 h-3" aria-hidden="true" />
                  {queuePendingCount}
                </span>
              )}
              {editCount > 0 && (
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${CLI_COLORS.warning}`}
                  title={`${editCount} file${editCount === 1 ? '' : 's'} edited`}
                  aria-label={`${editCount} file${editCount === 1 ? '' : 's'} edited`}
                >
                  <FileEdit className="w-3 h-3" aria-hidden="true" />
                  {editCount}
                </span>
              )}
              {writeCount > 0 && (
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${CLI_COLORS.success}`}
                  title={`${writeCount} file${writeCount === 1 ? '' : 's'} created`}
                  aria-label={`${writeCount} file${writeCount === 1 ? '' : 's'} created`}
                >
                  <FilePlus className="w-3 h-3" aria-hidden="true" />
                  {writeCount}
                </span>
              )}
            </div>
          )}
          {sessionId && !isStreaming && (
            <button onClick={onResume} className="p-1 hover:bg-surface-hover rounded transition-colors" style={{ color: MODULE_COLORS.core }} title="Resume session">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button onClick={onClear} disabled={isStreaming} className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-red-400 disabled:opacity-50 transition-colors" title="Clear">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 text-xs text-text-muted bg-background border-b border-border/50">
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span data-testid="pof-cli-panel-running-indicator" className={`flex items-center gap-1 ${CLI_COLORS.warning}`}><Loader2 className="w-2.5 h-2.5 animate-spin" />Running</span>
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
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-text-muted"
              title={`${lastResult.usage.inputTokens.toLocaleString()} input tokens · ${lastResult.usage.outputTokens.toLocaleString()} output tokens`}
              aria-label={`${(lastResult.usage.inputTokens / 1000).toFixed(1)}k tokens in, ${(lastResult.usage.outputTokens / 1000).toFixed(1)}k tokens out`}
            >
              <ArrowDown className="w-2.5 h-2.5" aria-hidden="true" />
              {(lastResult.usage.inputTokens / 1000).toFixed(1)}k in
              <span className="text-text-muted/50" aria-hidden="true">·</span>
              <ArrowUp className="w-2.5 h-2.5" aria-hidden="true" />
              {(lastResult.usage.outputTokens / 1000).toFixed(1)}k out
            </span>
          )}
        </div>
      </div>
    </>
  );
}
