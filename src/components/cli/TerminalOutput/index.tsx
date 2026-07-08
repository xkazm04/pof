'use client';

import { Loader2, ChevronDown, Terminal } from 'lucide-react';
import { List } from 'react-window';
import { aggregateWarnings } from '../UE5BuildParser';
import { ErrorCard } from '../ErrorCard';
import { WarningAggregator } from '../WarningAggregator';
import { BuildSummaryCard } from '../BuildSummaryCard';
import { AssistantMessageContent, parseCodeBlocks } from '../CodeBlockHighlighter';
import {
  MODULE_COLORS, withOpacity, OPACITY_5, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import type { LogEntry } from '../types';
import { getLogIcon, formatLogContent, getLogTextClass, extractInlineEntities } from './helpers';
import { ToolPairRow, ToolBatchRow, LogRow } from './ToolRows';
import { SelectionToolbar } from './SelectionToolbar';
import { EntityTags } from './EntityTags';
import { useTerminalOutput } from './useTerminalOutput';
import { LOG_ITEM_HEIGHT, OVERSCAN_COUNT, STARTER_PROMPTS } from './constants';
import type { TerminalOutputProps, GroupedLogEntry, LogRowData } from './types';

export type { TerminalOutputProps } from './types';

// --- Main TerminalOutput component ---

export function TerminalOutput({
  logs, isStreaming, queuePendingCount,
  scrollRef, listRef, onScroll,
  buildParseCache, onBuildFix,
  scrollBtnVisible, isAutoScroll, unseenCount, onScrollToBottom,
  accentColor = MODULE_COLORS.core, onPromptFill,
}: TerminalOutputProps) {
  const {
    expandedGroups,
    expandedPairs,
    selectionToolbar,
    handleMouseUp,
    handleSelectionCopy,
    handleSelectionSearch,
    handleSelectionFix,
    toggleGroup,
    togglePair,
    virtualizedLogs,
    groupedTailLogs,
    isNewEntry,
    showScrollBtn,
    scrollBtnMounted,
  } = useTerminalOutput({ logs, scrollRef, onBuildFix, scrollBtnVisible, isAutoScroll });

  const renderSingleLog = (log: LogEntry) => {
    const parsed = buildParseCache.get(log.id);
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
      const hasCodeBlocks = parseCodeBlocks(log.content);
      const entities = extractInlineEntities(log.content);

      if (hasCodeBlocks) {
        return (
          <div>
            <div className="flex items-start gap-2 px-3 py-1 hover:bg-surface-hover/40 transition-colors duration-150">
              <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
              <AssistantMessageContent content={log.content} />
            </div>
            {entities.length > 0 && <EntityTags entities={entities} />}
          </div>
        );
      }

      if (entities.length > 0) {
        return (
          <div>
            <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150">
              <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
              <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
            </div>
            <EntityTags entities={entities} />
          </div>
        );
      }
    }

    return (
      <div className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150">
        <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type, log.toolName)}</span>
        <span className={`text-xs leading-relaxed break-all ${getLogTextClass(log.type)}`}>{formatLogContent(log)}</span>
      </div>
    );
  };

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
              <ToolPairRow toolUse={entry.toolUse} toolResult={entry.toolResult} isExpanded={expandedPairs.has(entry.toolUse.id)} onToggle={() => togglePair(entry.toolUse.id)} buildParsed={buildParseCache.get(entry.toolResult.id)} onBuildFix={onBuildFix} isStreaming={isStreaming} />
            ) : (
              <ToolBatchRow pairs={entry.pairs} isExpanded={expandedGroups.has(entry.id)} onToggle={() => toggleGroup(entry.id)} expandedPairs={expandedPairs} onTogglePair={togglePair} buildCache={buildParseCache} onBuildFix={onBuildFix} isStreaming={isStreaming} />
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <div ref={scrollRef} data-testid="pof-cli-panel-output" onScroll={onScroll} onMouseUp={handleMouseUp} className="flex-1 overflow-y-auto relative">
      {/* Selection floating toolbar */}
      {selectionToolbar && (
        <SelectionToolbar
          key={`${selectionToolbar.anchorX.toFixed(1)}-${selectionToolbar.anchorTop.toFixed(1)}`}
          state={selectionToolbar}
          containerRef={scrollRef}
          onCopy={handleSelectionCopy}
          onSearch={handleSelectionSearch}
          onFix={handleSelectionFix}
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
                borderColor: withOpacity(accentColor, OPACITY_20),
                backgroundColor: withOpacity(accentColor, OPACITY_5),
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
                      backgroundColor: withOpacity(accentColor, OPACITY_5),
                      border: `1px solid ${withOpacity(accentColor, OPACITY_15)}`,
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
        <div className="flex items-center gap-2 px-3 py-1 text-xs" style={{ color: MODULE_COLORS.core }}>
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
              <span className="text-xs font-medium" style={{ color: MODULE_COLORS.core }}>{unseenCount} new</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
