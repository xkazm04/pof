'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { List, type RowComponentProps } from 'react-window';
import {
  User, Bot, Wrench, CheckCircle, AlertCircle,
  Loader2, ChevronDown, ChevronRight,
  FileEdit, FilePlus, Eye, ListOrdered,
  Copy, Search, Zap, Terminal, Command, CornerDownLeft,
  Box, AlertTriangle, FileCode, Lightbulb, Footprints,
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

function ToolPairRow({ toolUse, toolResult, isExpanded, onToggle, buildParsed, onBuildFix, isStreaming }: {
  toolUse: LogEntry; toolResult: LogEntry; isExpanded: boolean; onToggle: () => void;
  buildParsed?: BuildParseResult | null; onBuildFix?: (prompt: string) => void; isStreaming?: boolean;
}) {
  const hasBuild = buildParsed?.isBuildOutput;
  const errors = hasBuild ? buildParsed!.diagnostics.filter((d) => d.severity === 'error') : [];
  const warningGroups = hasBuild ? aggregateWarnings(buildParsed!.diagnostics) : [];
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast text-left">
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <span className="flex-shrink-0 mt-0.5">{getLogIcon(toolUse.type, toolUse.toolName)}</span>
        <span className="text-xs leading-relaxed break-all truncate text-text">{formatLogContent(toolUse)}</span>
        {hasBuild && !isExpanded && (
          <span className={`ml-auto text-2xs px-1.5 py-px rounded flex-shrink-0 ${
            buildParsed!.summary?.success ? 'bg-green-500/15 text-green-400' : 'bg-status-red-medium text-red-400'
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
              <ErrorCard key={d.id} diagnostic={d} onFix={onBuildFix} isRunning={isStreaming} />
            ))}
            {warningGroups.length > 0 && (
              <WarningAggregator groups={warningGroups} onFix={onBuildFix} isRunning={isStreaming} />
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

function ToolBatchRow({ pairs, isExpanded, onToggle, expandedPairs, onTogglePair, buildCache, onBuildFix, isStreaming }: {
  pairs: { toolUse: LogEntry; toolResult: LogEntry }[];
  isExpanded: boolean;
  onToggle: () => void;
  expandedPairs: Set<string>;
  onTogglePair: (id: string) => void;
  buildCache?: Map<string, BuildParseResult>;
  onBuildFix?: (prompt: string) => void;
  isStreaming?: boolean;
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast text-left">
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <Wrench className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs leading-relaxed text-text-muted">{pairs.length} file operations</span>
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
              isStreaming={isStreaming}
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
    <div style={style} className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast">
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
  // Empty state
  accentColor?: string;
  onPromptFill?: (prompt: string) => void;
}

// --- Selection toolbar ---

interface SelectionToolbarState {
  text: string;
  x: number;
  y: number;
}

function SelectionToolbar({ state, onCopy, onSearch, onFix, containerRef }: {
  state: SelectionToolbarState;
  onCopy: () => void;
  onSearch: () => void;
  onFix: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-surface border border-border-bright shadow-xl"
      style={{
        left: Math.max(8, state.x),
        top: Math.max(0, state.y - 4),
        transform: 'translateY(-100%)',
      }}
    >
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCopy(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        title="Copy selected text"
      >
        <Copy className="w-3 h-3" />
        Copy
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSearch(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        title="Search in project"
      >
        <Search className="w-3 h-3" />
        Search
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onFix(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium text-[#00ff88] hover:bg-accent-subtle transition-colors"
        title="Fix with Claude"
      >
        <Zap className="w-3 h-3" />
        Fix
      </button>
    </div>
  );
}

// --- Client-side entity extraction (lightweight regex, no server call) ---

interface InlineEntity {
  type: 'class' | 'file' | 'concept' | 'warning' | 'step';
  value: string;
  parent?: string;
  moduleId?: string;
}

const UE_CLASS_RE = /\b([AUF][A-Z][A-Za-z0-9]+(?:Component|Controller|Character|Base|Instance|System|Subsystem|Widget|Effect|Ability|Set|Asset|Manager|Volume)?)\b/g;
const UE_CLASS_EXCLUDE = new Set(['ANSI', 'ASCII', 'ATTR', 'AUTO', 'UPROPERTY', 'UFUNCTION', 'UCLASS', 'USTRUCT', 'UENUM', 'UMETA', 'FORCEINLINE']);
const FILE_RE = /(?:Source\/|Private\/|Public\/|Content\/)[\w/.-]+\.\w{1,5}/g;
const WARNING_RE = /(?:⚠️|Warning|WARN|Caution|Important|Be careful|Caveat)[:\s]+(.{10,120}?)(?:\n|$)/gi;
const UE_CONCEPTS_SET = new Set([
  'gameplay ability system', 'gas', 'behavior tree', 'eqs', 'navmesh',
  'enhanced input', 'replication', 'rpc', 'gameplay effect', 'gameplay cue',
  'data table', 'data asset', 'subsystem', 'animation blueprint', 'montage',
  'blend space', 'state machine', 'niagara', 'material instance', 'post process',
  'world partition', 'gameplay tag', 'umg',
]);
const UE_CONCEPT_LABELS: Record<string, string> = {
  'gameplay ability system': 'GAS', gas: 'GAS', 'behavior tree': 'Behavior Tree',
  eqs: 'EQS', navmesh: 'NavMesh', 'enhanced input': 'Enhanced Input',
  replication: 'Replication', rpc: 'RPC', 'gameplay effect': 'GameplayEffect',
  'gameplay cue': 'GameplayCue', 'data table': 'Data Table', 'data asset': 'Data Asset',
  subsystem: 'Subsystem', 'animation blueprint': 'AnimBP', montage: 'Montage',
  'blend space': 'Blend Space', 'state machine': 'State Machine', niagara: 'Niagara',
  'material instance': 'Material Instance', 'post process': 'Post Process',
  'world partition': 'World Partition', 'gameplay tag': 'Gameplay Tag', umg: 'UMG',
};

function extractInlineEntities(text: string): InlineEntity[] {
  if (text.length < 20) return [];
  const entities: InlineEntity[] = [];
  const seen = new Set<string>();

  // Classes
  UE_CLASS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UE_CLASS_RE.exec(text)) !== null) {
    const name = m[1];
    if (name.length >= 4 && !UE_CLASS_EXCLUDE.has(name) && !seen.has(name)) {
      seen.add(name);
      entities.push({ type: 'class', value: name });
    }
  }

  // Files
  FILE_RE.lastIndex = 0;
  while ((m = FILE_RE.exec(text)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      entities.push({ type: 'file', value: m[0] });
    }
  }

  // Concepts
  const lower = text.toLowerCase();
  for (const concept of UE_CONCEPTS_SET) {
    if (lower.includes(concept) && !seen.has(concept)) {
      seen.add(concept);
      entities.push({ type: 'concept', value: UE_CONCEPT_LABELS[concept] ?? concept });
    }
  }

  // Warnings (max 3)
  WARNING_RE.lastIndex = 0;
  let warnCount = 0;
  while ((m = WARNING_RE.exec(text)) !== null && warnCount < 3) {
    const w = m[1].trim();
    if (!seen.has(w)) {
      seen.add(w);
      entities.push({ type: 'warning', value: w });
      warnCount++;
    }
  }

  return entities.slice(0, 12);
}

const ENTITY_STYLES: Record<InlineEntity['type'], { color: string; icon: typeof Box }> = {
  class:   { color: '#60a5fa', icon: Box },
  file:    { color: '#94a3b8', icon: FileCode },
  concept: { color: '#a78bfa', icon: Lightbulb },
  warning: { color: '#f59e0b', icon: AlertTriangle },
  step:    { color: '#00ff88', icon: Footprints },
};

function EntityTags({ entities, onNavigate }: {
  entities: InlineEntity[];
  onNavigate?: (moduleId: string) => void;
}) {
  if (entities.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1 ml-5">
      {entities.map((e, i) => {
        const style = ENTITY_STYLES[e.type];
        const Icon = style.icon;
        return (
          <span
            key={`${e.type}-${e.value}-${i}`}
            className="inline-flex items-center gap-1 px-1.5 py-px rounded text-2xs cursor-default hover:brightness-125 transition-all"
            style={{ backgroundColor: `${style.color}12`, color: style.color, border: `1px solid ${style.color}20` }}
            title={e.type === 'warning' ? e.value : `${e.type}: ${e.value}`}
            onClick={() => e.moduleId && onNavigate?.(e.moduleId)}
          >
            <Icon className="w-2.5 h-2.5" />
            <span className="max-w-[160px] truncate">{e.value}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * The number of recent logs to render as grouped/rich entries outside the
 * virtualizer.  These get the CSS slide-in animation and support expandable
 * tool-pair / batch rows.  All older logs are flat-rendered inside react-window.
 */
const TAIL_COUNT = 8;

const STARTER_PROMPTS = [
  { label: 'Implement next checklist item', prompt: 'Look at the checklist and implement the next uncompleted item.' },
  { label: 'Build the project', prompt: 'Build the project and fix any errors.' },
  { label: 'Explain current module', prompt: 'Explain the architecture and purpose of this module.' },
];

export function TerminalOutput({
  logs, isStreaming, queuePendingCount,
  scrollRef, listRef, onScroll,
  buildParseCache, onBuildFix,
  scrollBtnVisible, isAutoScroll, unseenCount, onScrollToBottom,
  accentColor = '#3b82f6', onPromptFill,
}: TerminalOutputProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState | null>(null);

  // Handle text selection for floating toolbar
  const handleMouseUp = useCallback(() => {
    // Small delay to let the selection finalize
    requestAnimationFrame(() => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionToolbar(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 2) {
        setSelectionToolbar(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const container = scrollRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Position relative to container
      const x = rect.left - containerRect.left + rect.width / 2 - 80; // Center roughly
      const y = rect.top - containerRect.top + container.scrollTop;

      setSelectionToolbar({ text, x, y });
    });
  }, [scrollRef]);

  // Dismiss toolbar on click away or scroll
  useEffect(() => {
    if (!selectionToolbar) return;

    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionToolbar(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [selectionToolbar]);

  const handleSelectionCopy = useCallback(() => {
    if (!selectionToolbar) return;
    navigator.clipboard.writeText(selectionToolbar.text);
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar]);

  const handleSelectionSearch = useCallback(() => {
    if (!selectionToolbar) return;
    // Dispatch a search event that the parent module can handle
    window.dispatchEvent(
      new CustomEvent('pof-terminal-search', {
        detail: { query: selectionToolbar.text },
      })
    );
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar]);

  const handleSelectionFix = useCallback(() => {
    if (!selectionToolbar) return;
    onBuildFix(`Fix this error:\n\n${selectionToolbar.text}`);
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar, onBuildFix]);

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
          <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast">
            <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
            <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
          </div>
          {errors.map((d) => (
            <ErrorCard key={d.id} diagnostic={d} onFix={onBuildFix} isRunning={isStreaming} />
          ))}
          {warningGroups.length > 0 && (
            <WarningAggregator groups={warningGroups} onFix={onBuildFix} isRunning={isStreaming} />
          )}
          {parsed.summary && <BuildSummaryCard summary={parsed.summary} />}
        </div>
      );
    }

    // Extract entities for assistant messages
    if (log.type === 'assistant' && log.content.length >= 40) {
      const entities = extractInlineEntities(log.content);
      if (entities.length > 0) {
        return (
          <div>
            <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast">
              <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
              <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
            </div>
            <EntityTags entities={entities} />
          </div>
        );
      }
    }

    return (
      <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-fast">
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
              <ToolPairRow toolUse={entry.toolUse} toolResult={entry.toolResult} isExpanded={expandedPairs.has(entry.toolUse.id)} onToggle={() => togglePair(entry.toolUse.id)} buildParsed={buildParseCache.current.get(entry.toolResult.id)} onBuildFix={onBuildFix} isStreaming={isStreaming} />
            ) : (
              <ToolBatchRow pairs={entry.pairs} isExpanded={expandedGroups.has(entry.id)} onToggle={() => toggleGroup(entry.id)} expandedPairs={expandedPairs} onTogglePair={togglePair} buildCache={buildParseCache.current} onBuildFix={onBuildFix} isStreaming={isStreaming} />
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
    <div ref={scrollRef} onScroll={onScroll} onMouseUp={handleMouseUp} className="flex-1 overflow-y-auto relative">
      {/* Selection floating toolbar */}
      {selectionToolbar && (
        <SelectionToolbar
          state={selectionToolbar}
          onCopy={handleSelectionCopy}
          onSearch={handleSelectionSearch}
          onFix={handleSelectionFix}
          containerRef={scrollRef}
        />
      )}

      {logs.length === 0 ? (
        queuePendingCount > 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            Waiting to start...
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-6 gap-4 select-none">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center"
              style={{
                borderColor: `${accentColor}30`,
                backgroundColor: `${accentColor}08`,
              }}
            >
              <Terminal className="w-5 h-5" style={{ color: accentColor }} />
            </div>

            {/* Description */}
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-text">AI-Powered Terminal</p>
              <p className="text-2xs text-text-muted leading-relaxed max-w-[240px]">
                Describe what you want to build or fix, and Claude will write, edit, and compile the code for you.
              </p>
            </div>

            {/* Starter prompt chips */}
            {onPromptFill && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xs">
                {STARTER_PROMPTS.map((sp) => (
                  <button
                    key={sp.label}
                    onClick={() => onPromptFill(sp.prompt)}
                    className="px-2.5 py-1 rounded-full text-2xs font-medium transition-all hover:brightness-125 cursor-pointer"
                    style={{
                      color: accentColor,
                      backgroundColor: `${accentColor}0a`,
                      border: `1px solid ${accentColor}25`,
                    }}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Keyboard shortcuts */}
            <div className="flex items-center gap-3 text-text-muted">
              <span className="inline-flex items-center gap-1 text-2xs">
                <kbd className="px-1 py-px rounded bg-surface-hover border border-border text-2xs font-mono">Enter</kbd>
                <span>send</span>
              </span>
              <span className="inline-flex items-center gap-1 text-2xs">
                <kbd className="px-1 py-px rounded bg-surface-hover border border-border text-2xs font-mono">Shift+Enter</kbd>
                <span>newline</span>
              </span>
              <span className="inline-flex items-center gap-1 text-2xs">
                <kbd className="px-1 py-px rounded bg-surface-hover border border-border text-2xs font-mono">Ctrl+Enter</kbd>
                <span>resume</span>
              </span>
            </div>
          </div>
        )
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
