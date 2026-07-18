import { Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import type { LogEntry } from '../types';
import { aggregateWarnings, type BuildParseResult } from '../UE5BuildParser';
import { ErrorCard } from '../ErrorCard';
import { WarningAggregator } from '../WarningAggregator';
import { BuildSummaryCard } from '../BuildSummaryCard';
import { CLI_COLORS } from '@/lib/chart-colors';
import { getLogIcon, formatLogContent, getLogTextClass } from './helpers';

// --- Sub-row components ---

export function ToolPairRow({ toolUse, toolResult, isExpanded, onToggle, buildParsed, onBuildFix, isStreaming }: {
  toolUse: LogEntry; toolResult: LogEntry; isExpanded: boolean; onToggle: () => void;
  buildParsed?: BuildParseResult | null; onBuildFix?: (prompt: string) => void; isStreaming?: boolean;
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
            buildParsed!.summary?.success ? `${CLI_COLORS.buildOkBg} ${CLI_COLORS.success}` : `bg-status-red-medium ${CLI_COLORS.error}`
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

export function ToolBatchRow({ pairs, isExpanded, onToggle, expandedPairs, onTogglePair, buildCache, onBuildFix, isStreaming }: {
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
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-3 py-0.5 hover:bg-surface-hover/40 transition-colors duration-150 text-left">
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <Wrench className={`w-3 h-3 ${CLI_COLORS.warning} flex-shrink-0 mt-0.5`} />
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
