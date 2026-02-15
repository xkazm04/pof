'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronRight, FileCode } from 'lucide-react';
import type { WarningGroup } from './UE5BuildParser';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';

interface WarningAggregatorProps {
  groups: WarningGroup[];
  onFix?: (prompt: string) => void;
  isRunning?: boolean;
}

export function WarningAggregator({ groups, onFix, isRunning = false }: WarningAggregatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const totalCount = groups.reduce((sum, g) => sum + g.count, 0);

  if (totalCount === 0) return null;

  return (
    <div className="mx-2 my-1 rounded border border-yellow-500/20 bg-yellow-500/[0.03] overflow-hidden">
      {/* Summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        <span className="text-xs text-yellow-300 font-medium">
          {totalCount} warning{totalCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-text-muted">
          ({groups.length} type{groups.length !== 1 ? 's' : ''})
        </span>
      </button>

      {/* Expanded: show grouped warnings */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="border-t border-yellow-500/10"
          >
            {groups.map((group) => {
              const groupKey = group.code ?? group.messagePattern;
              const isGroupExpanded = expandedGroup === groupKey;

              return (
                <div key={groupKey} className="border-b border-border/30 last:border-b-0">
                  <button
                    onClick={() => setExpandedGroup(isGroupExpanded ? null : groupKey)}
                    className="w-full flex items-start gap-2 px-3 py-1 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    {isGroupExpanded
                      ? <ChevronDown className="w-2.5 h-2.5 text-text-muted flex-shrink-0 mt-0.5" />
                      : <ChevronRight className="w-2.5 h-2.5 text-text-muted flex-shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {group.code && (
                          <span className="text-2xs font-mono text-yellow-400/80 bg-yellow-500/10 px-1 py-px rounded">
                            {group.code}
                          </span>
                        )}
                        <span className="text-2xs text-yellow-300/70 bg-yellow-500/10 px-1 py-px rounded font-medium">
                          x{group.count}
                        </span>
                      </div>
                      <TruncateWithTooltip as="p" className="text-xs text-text-muted mt-0.5 truncate" side="bottom">
                        {group.messagePattern}
                      </TruncateWithTooltip>
                    </div>
                  </button>

                  {/* Individual warnings in this group */}
                  <AnimatePresence>
                    {isGroupExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="pl-6 bg-background/40"
                      >
                        {group.warnings.map((w) => (
                          <div key={w.id} className="flex items-start gap-1.5 px-2 py-0.5 text-2xs">
                            {w.file && (
                              <span className="flex items-center gap-0.5 text-text-muted font-mono flex-shrink-0">
                                <FileCode className="w-2.5 h-2.5" />
                                {w.file.split(/[/\\]/).pop()}
                                {w.line != null && `:${w.line}`}
                              </span>
                            )}
                            <span className="text-text-muted-hover truncate">{w.message}</span>
                          </div>
                        ))}
                        {onFix && group.count > 0 && (
                          <div className="px-2 py-1">
                            <button
                              onClick={() => {
                                if (isRunning) return;
                                const filesSet = new Set(
                                  group.warnings.filter((w) => w.file).map((w) => w.file!)
                                );
                                const files = Array.from(filesSet).slice(0, 5);
                                const prompt = `Fix these ${group.count} "${group.code ?? group.messagePattern}" warnings in: ${files.join(', ')}${filesSet.size > 5 ? ` (and ${filesSet.size - 5} more files)` : ''}\n\nAfter fixing, verify the build compiles successfully.`;
                                onFix(prompt);
                              }}
                              disabled={isRunning}
                              className="text-2xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-blue-400"
                            >
                              Fix all {group.count}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
