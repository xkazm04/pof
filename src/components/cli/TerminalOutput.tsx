'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { List, type RowComponentProps } from 'react-window';
import {
  User, Bot, Wrench, CheckCircle, AlertCircle,
  Loader2, ChevronDown, ChevronRight,
  FileEdit, FilePlus, Eye, ListOrdered,
} from 'lucide-react';
import type { LogEntry } from './types';
import { aggregateWarnings, type BuildParseResult } from './UE5BuildParser';
import { ErrorCard } from './ErrorCard';
import { WarningAggregator } from './WarningAggregator';
import { BuildSummaryCard } from './BuildSummaryCard';
import type { ListImperativeAPI } from 'react-window';

// --- Constants ---

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
const TOOL_BATCH_THRESHOLD = 5;
const OVERSCAN_COUNT = 20;

// --- Helpers ---

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
    case 'tool_result': return 'text-text-muted font-mono';
    case 'system': return 'text-cyan-400';
    default: return 'text-text';
  }
};

// --- Grouped log types ---

type GroupedLogEntry =
  | { kind: 'single'; log: LogEntry }
  | { kind: 'tool_pair'; toolUse: LogEntry; toolResult: LogEntry; id: string }
  | { kind: 'tool_batch'; pairs: { toolUse: LogEntry; toolResult: LogEntry }[]; id: string };

function groupLogs(logs: LogEntry[]): GroupedLogEntry[] {
  const result: GroupedLogEntry[] = [];
  let i = 0;

  while (i < logs.length) {
    if (logs[i].type === 'tool_use' && i + 1 < logs.length && logs[i + 1].type === 'tool_result') {
      const pairs: { toolUse: LogEntry; toolResult: LogEntry }[] = [];
      while (i < logs.length && logs[i].type === 'tool_use' && i + 1 < logs.length && logs[i + 1].type === 'tool_result') {
        pairs.push({ toolUse: logs[i], toolResult: logs[i + 1] });
        i += 2;
      }
      if (pairs.length >= TOOL_BATCH_THRESHOLD) {
        result.push({ kind: 'tool_batch', pairs, id: `batch-${pairs[0].toolUse.id}` });
      } else {
        for (const pair of pairs) {
          result.push({ kind: 'tool_pair', toolUse: pair.toolUse, toolResult: pair.toolResult, id: `pair-${pair.toolUse.id}` });
        }
      }
    } else {
      result.push({ kind: 'single', log: logs[i] });
      i++;
    }
  }

  return result;
}

// --- Sub-row components ---

function ToolPairRow({ toolUse, toolResult, isExpanded, onToggle, buildParsed, onBuildFix }: {
  toolUse: LogEntry; toolResult: LogEntry; isExpanded: boolean; onToggle: () => void;
  buildParsed?: BuildParseResult | null; onBuildFix?: (prompt: string) => void;
}) {
  const hasBuild = buildParsed?.isBuildOutput;
  const errors = hasBuild ? buildParsed!.diagnostics.filter((d) => d.severity === 'error') : [];
  const warningGroups = hasBuild ? aggregateWarnings(buildParsed!.diagnostics) : [];
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150 text-left">
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <span className="flex-shrink-0 mt-0.5">{getLogIcon(toolUse.type, toolUse.toolName)}</span>
        <span className="text-xs leading-relaxed break-all truncate text-text">{formatLogContent(toolUse)}</span>
        {hasBuild && !isExpanded && (
          <span className={`ml-auto text-2xs px-1.5 py-px rounded flex-shrink-0 ${
            buildParsed!.summary?.success ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          }`}>
            {buildParsed!.summary?.success ? 'Build OK' : `${errors.length} error(s)`}
          </span>
        )}
      </button>
      {isExpanded && (
        hasBuild && buildParsed ? (
          <div className="pl-4">
            <div className="pl-2 flex items-start gap-2 px-3 py-0.5 bg-surface-deep/60">
              <span className="flex-shrink-0 mt-0.5">{getLogIcon('tool_result')}</span>
              <span className="text-xs leading-relaxed break-all text-text-muted font-mono">{toolResult.content}</span>
            </div>
            {errors.map((d) => (
              <ErrorCard key={d.id} diagnostic={d} onFix={onBuildFix} />
            ))}
            {warningGroups.length > 0 && (
              <WarningAggregator groups={warningGroups} onFix={onBuildFix} />
            )}
            {buildParsed.summary && <BuildSummaryCard summary={buildParsed.summary} />}
          </div>
        ) : (
          <div className="pl-6 flex items-start gap-2 px-3 py-0.5 bg-surface-deep/60">
            <span className="flex-shrink-0 mt-0.5">{getLogIcon('tool_result')}</span>
            <span className="text-xs leading-relaxed break-all text-text-muted font-mono">{toolResult.content}</span>
          </div>
        )
      )}
    </div>
  );
}

function ToolBatchRow({ pairs, isExpanded, onToggle, expandedPairs, onTogglePair, buildCache, onBuildFix }: {
  pairs: { toolUse: LogEntry; toolResult: LogEntry }[];
  isExpanded: boolean;
  onToggle: () => void;
  expandedPairs: Set<string>;
  onTogglePair: (id: string) => void;
  buildCache?: Map<string, BuildParseResult>;
  onBuildFix?: (prompt: string) => void;
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150 text-left">
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <Wrench className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs leading-relaxed text-[#9ca0be]">{pairs.length} file operations</span>
      </button>
      {isExpanded && (
        <div className="pl-4">
          {pairs.map((pair) => (
            <ToolPairRow
              key={pair.toolUse.id}
              toolUse={pair.toolUse}
              toolResult={pair.toolResult}
              isExpanded={expandedPairs.has(pair.toolUse.id)}
              onToggle={() => onTogglePair(pair.toolUse.id)}
              buildParsed={buildCache?.get(pair.toolResult.id)}
              onBuildFix={onBuildFix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Virtualized row for react-window ---

interface LogRowData { logs: LogEntry[]; }

function LogRow({ index, style, logs }: RowComponentProps<LogRowData>) {
  const log = logs[index];
  return (
    <div style={style} className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150">
      <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
      <span className={`text-xs leading-relaxed break-all truncate ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
    </div>
  );
}

// --- Main TerminalOutput component ---

interface TerminalOutputProps {
  logs: LogEntry[];
  isStreaming: boolean;
  queuePendingCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<ListImperativeAPI | null>;
  onScroll: () => void;
  buildParseCache: React.RefObject<Map<string, BuildParseResult>>;
  onBuildFix: (prompt: string) => void;
  // Scroll button
  scrollBtnVisible: boolean;
  isAutoScroll: boolean;
  unseenCount: number;
  onScrollToBottom: () => void;
}

/**
 * The number of recent logs to render as grouped/rich entries outside the
 * virtualizer.  These get the CSS slide-in animation and support expandable
 * tool-pair / batch rows.  All older logs are flat-rendered inside react-window.
 */
const TAIL_COUNT = 8;

export function TerminalOutput({
  logs, isStreaming, queuePendingCount,
  scrollRef, listRef, onScroll,
  buildParseCache, onBuildFix,
  scrollBtnVisible, isAutoScroll, unseenCount, onScrollToBottom,
}: TerminalOutputProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const togglePair = useCallback((id: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Split logs: older logs go to the virtualizer, recent tail gets grouped rendering
  const { virtualizedLogs, tailLogs } = useMemo(() => {
    const splitIndex = Math.max(0, logs.length - TAIL_COUNT);
    return {
      virtualizedLogs: logs.slice(0, splitIndex),
      tailLogs: logs.slice(splitIndex),
    };
  }, [logs]);

  const groupedTailLogs = useMemo(() => groupLogs(tailLogs), [tailLogs]);

  // Track which log IDs have been seen so we only animate new arrivals
  const seenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Mark all current log ids as seen after render
    const timer = requestAnimationFrame(() => {
      for (const log of logs) {
        seenIdsRef.current.add(log.id);
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [logs]);

  const isNewEntry = useCallback((id: string) => !seenIdsRef.current.has(id), []);

  const renderSingleLog = useCallback((log: LogEntry) => {
    const parsed = buildParseCache.current.get(log.id);
    if (parsed && parsed.isBuildOutput) {
      const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
      const warningGroups = aggregateWarnings(parsed.diagnostics);
      return (
        <div>
          <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150">
            <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
            <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
          </div>
          {errors.map((d) => (
            <ErrorCard key={d.id} diagnostic={d} onFix={onBuildFix} />
          ))}
          {warningGroups.length > 0 && (
            <WarningAggregator groups={warningGroups} onFix={onBuildFix} />
          )}
          {parsed.summary && <BuildSummaryCard summary={parsed.summary} />}
        </div>
      );
    }

    return (
      <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150">
        <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
        <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
      </div>
    );
  }, [buildParseCache, onBuildFix]);

  const renderGroupedEntries = (entries: GroupedLogEntry[]) => (
    <>
      {entries.map((entry) => {
        const key = entry.kind === 'single' ? entry.log.id : entry.id;
        const animClass = isNewEntry(key) ? 'log-enter' : '';
        return (
          <div key={key} className={animClass}>
            {entry.kind === 'single' ? (
              renderSingleLog(entry.log)
            ) : entry.kind === 'tool_pair' ? (
              <ToolPairRow toolUse={entry.toolUse} toolResult={entry.toolResult} isExpanded={expandedPairs.has(entry.toolUse.id)} onToggle={() => togglePair(entry.toolUse.id)} buildParsed={buildParseCache.current.get(entry.toolResult.id)} onBuildFix={onBuildFix} />
            ) : (
              <ToolBatchRow pairs={entry.pairs} isExpanded={expandedGroups.has(entry.id)} onToggle={() => toggleGroup(entry.id)} expandedPairs={expandedPairs} onTogglePair={togglePair} buildCache={buildParseCache.current} onBuildFix={onBuildFix} />
            )}
          </div>
        );
      })}
    </>
  );

  // Track scroll button visibility with CSS class
  const [scrollBtnMounted, setScrollBtnMounted] = useState(false);
  useEffect(() => {
    if (scrollBtnVisible && !isAutoScroll && logs.length > 10) {
      setScrollBtnMounted(true);
    } else {
      // Small delay for exit transition
      const timer = setTimeout(() => setScrollBtnMounted(false), 150);
      return () => clearTimeout(timer);
    }
  }, [scrollBtnVisible, isAutoScroll, logs.length]);

  const showScrollBtn = scrollBtnVisible && !isAutoScroll && logs.length > 10;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-muted text-xs">
          {queuePendingCount > 0 ? 'Waiting to start...' : 'Enter a prompt to start'}
        </div>
      ) : (
        <div className="py-1">
          {/* Virtualized older logs — always active from line 1 */}
          {virtualizedLogs.length > 0 && (
            <List<LogRowData>
              listRef={listRef}
              defaultHeight={Math.min(virtualizedLogs.length * LOG_ITEM_HEIGHT, 400)}
              rowCount={virtualizedLogs.length}
              rowHeight={LOG_ITEM_HEIGHT}
              overscanCount={OVERSCAN_COUNT}
              rowComponent={LogRow}
              rowProps={{ logs: virtualizedLogs }}
            />
          )}
          {/* Recent tail — grouped with CSS slide-in transitions */}
          {renderGroupedEntries(groupedTailLogs)}
        </div>
      )}

      {isStreaming && (
        <div className="flex items-center gap-2 px-3 py-1 text-[#3b82f6] text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Working...</span>
        </div>
      )}

      {/* Scroll to bottom pill — CSS transitions instead of AnimatePresence */}
      {scrollBtnMounted && (
        <div
          className={`sticky bottom-2 flex justify-end pr-2 pointer-events-none -mt-7 z-10 ${showScrollBtn ? 'scroll-btn-enter' : 'scroll-btn-exit'}`}
        >
          <button
            onClick={onScrollToBottom}
            className="pointer-events-auto flex items-center gap-1 h-6 px-2 bg-surface/90 backdrop-blur-sm border border-border-bright rounded-full text-text-muted-hover hover:text-text hover:bg-surface-hover/90 transition-all shadow-lg"
          >
            <ChevronDown className="w-3 h-3" />
            {unseenCount > 0 && (
              <span className="text-xs font-medium text-[#3b82f6]">{unseenCount} new</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
