'use client';

import { useState } from 'react';
import {
  Play, Loader2, ChevronDown, ChevronRight, Check, ShieldAlert,
} from 'lucide-react';
import { AccentButton } from '@/components/ui/AccentButton';
import type { ChecklistItem } from '@/types/modules';
import type { VerificationInfo } from '@/stores/moduleStore';
import { PriorityBadge } from './Priority';
import type { ItemMetadata } from './types';

export function CompactChecklist({
  items, subModuleId, progress, verification, metadata, accentColor,
  isRunning, activeItemId, lastCompletedItemId, batchQueue,
  onRunPrompt, onBatchRun, onToggleItem, onContextMenu,
}: {
  items: ChecklistItem[];
  subModuleId: string;
  progress: Record<string, boolean>;
  verification: Record<string, VerificationInfo>;
  metadata: Record<string, ItemMetadata>;
  accentColor: string;
  isRunning: boolean;
  activeItemId: string | null;
  lastCompletedItemId: string | null;
  batchQueue: string[];
  onRunPrompt: (itemId: string, prompt: string) => void;
  onBatchRun?: (itemIds: string[]) => void;
  onToggleItem: (itemId: string) => void;
  onContextMenu: (e: React.MouseEvent, itemId: string) => void;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const uncheckedIds = items.filter((i) => !progress[i.id]).map((i) => i.id);
  const inQueue = new Set(batchQueue);

  return (
    <div className="space-y-3">
      {/* Consolidated card */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {items.map((item, index) => {
          const checked = !!progress[item.id];
          const isActive = activeItemId === item.id;
          const justCompleted = lastCompletedItemId === item.id;
          const isQueued = inQueue.has(item.id);
          const isPartial = checked && verification[item.id]?.status === 'partial';
          const meta = metadata[item.id];
          const priority = meta?.priority ?? 'none';
          const isExpanded = expandedRow === item.id;
          const isHovered = hoveredRow === item.id;

          return (
            <div
              key={item.id}
              data-testid={`pof-module-${subModuleId}-checklist-item-${item.id}`}
              className={`border-b border-border/40 last:border-b-0 transition-colors ${
                justCompleted ? 'bg-green-900/15' : isActive ? 'bg-state-active-bg' : isHovered ? 'bg-surface-hover/30' : ''
              }`}
              onMouseEnter={() => setHoveredRow(item.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onContextMenu={(e) => onContextMenu(e, item.id)}
            >
              <div className="flex items-center gap-2.5 px-3 py-2">
                {/* Checkbox */}
                <button
                  onClick={() => onToggleItem(item.id)}
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isPartial
                      ? 'border-yellow-500 bg-yellow-500/20'
                      : checked
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-checkbox-border hover:border-checkbox-border-hover'
                  }`}
                >
                  {isPartial
                    ? <ShieldAlert className="w-2.5 h-2.5 text-yellow-400" />
                    : checked
                      ? <Check className="w-2.5 h-2.5 text-green-400" />
                      : null}
                </button>

                {/* Number */}
                <span className="text-2xs text-text-muted font-mono w-4 text-right flex-shrink-0">{index + 1}</span>

                {/* Label - clickable to expand */}
                <button
                  onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                  className={`flex-1 min-w-0 text-left text-xs truncate ${checked ? 'text-text-muted line-through' : 'text-text'}`}
                >
                  {item.label}
                </button>

                {/* Status indicators */}
                {priority !== 'none' && <PriorityBadge priority={priority} />}
                {isQueued && (
                  <span className="text-2xs px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">queued</span>
                )}
                {isActive && (
                  <span className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-accent-medium text-accent-setup">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  </span>
                )}
                {justCompleted && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 animate-pulse">done</span>
                )}

                {/* Hover actions */}
                {isHovered && !checked && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRunPrompt(item.id, item.prompt); }}
                    disabled={isRunning}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all disabled:opacity-50"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <Play className="w-2.5 h-2.5" />
                  </button>
                )}

                {/* Expand chevron */}
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 opacity-30" />}
              </div>

              {/* Expanded description */}
              {isExpanded && (
                <div className="px-12 pb-2.5 text-xs text-text-muted leading-relaxed">
                  {item.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Run All Unchecked button */}
      {uncheckedIds.length > 0 && onBatchRun && (
        <div className="flex items-center gap-2">
          <AccentButton
            onClick={() => onBatchRun(uncheckedIds)}
            disabled={isRunning}
            loading={isRunning}
            accentColor={accentColor}
            size="sm"
            leftIcon={<Play className="w-3 h-3" />}
            loadingLabel={<>Running ({batchQueue.length} queued)</>}
          >
            Run All Unchecked ({uncheckedIds.length})
          </AccentButton>
          {batchQueue.length > 0 && (
            <span className="text-2xs text-text-muted">
              {batchQueue.length} remaining in queue
            </span>
          )}
        </div>
      )}
    </div>
  );
}
