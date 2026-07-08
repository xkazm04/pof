'use client';

import {
  Check, Play, Loader2, Sparkles, CheckSquare, Square, ShieldAlert, ScanSearch,
  StickyNote,
} from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { AccentButton } from '@/components/ui/AccentButton';
import type { ChecklistItem, SubModuleId } from '@/types/modules';
import type { PatternSuggestion } from '@/types/pattern-library';
import type { VerificationInfo } from '@/stores/moduleStore';
import { PriorityBadge, PriorityDropdown } from './Priority';
import { NotesSection } from './NotesSection';
import { CopyItemButton } from './CopyItemButton';
import type { ItemMetadata, Priority } from './types';

export function CardsChecklist({
  items, subModuleId, progress, verification, metadata, suggestions,
  accentColor, isRunning, activeItemId, lastCompletedItemId,
  selectMode, selected, hoveredItemId, priorityDropdown, expandedNotes, editingNotes,
  onRunPrompt, toggleItem, toggleSelected, setHoveredItemId, setPriorityDropdown,
  handleContextMenu, toggleNotes, setEditingNotes, saveMetadata, handleSetPriority,
}: {
  items: ChecklistItem[];
  subModuleId: string;
  progress: Record<string, boolean>;
  verification: Record<string, VerificationInfo>;
  metadata: Record<string, ItemMetadata>;
  suggestions: PatternSuggestion[];
  accentColor: string;
  isRunning: boolean;
  activeItemId: string | null;
  lastCompletedItemId: string | null;
  selectMode: boolean;
  selected: Set<string>;
  hoveredItemId: string | null;
  priorityDropdown: string | null;
  expandedNotes: Set<string>;
  editingNotes: string | null;
  onRunPrompt: (itemId: string, prompt: string) => void;
  toggleItem: (subModuleId: SubModuleId, itemId: string) => void;
  toggleSelected: (itemId: string) => void;
  setHoveredItemId: (id: string | null) => void;
  setPriorityDropdown: (id: string | null) => void;
  handleContextMenu: (e: React.MouseEvent, itemId: string) => void;
  toggleNotes: (itemId: string) => void;
  setEditingNotes: (id: string | null) => void;
  saveMetadata: (itemId: string, patch: Partial<ItemMetadata>) => void;
  handleSetPriority: (itemId: string, priority: Priority) => void;
}) {
  return (
    <StaggerContainer className="space-y-2">
      {items.map((item, index) => {
        const checked = !!progress[item.id];
        const itemVerification = verification[item.id];
        const isPartial = checked && itemVerification?.status === 'partial';
        const isActive = activeItemId === item.id;
        const justCompleted = lastCompletedItemId === item.id;
        const meta = metadata[item.id];
        const priority = meta?.priority ?? 'none';
        const notes = meta?.notes ?? '';
        const isNotesExpanded = expandedNotes.has(item.id);
        const isEditingThis = editingNotes === item.id;
        const matchingSuggestion = !checked && !isActive
          ? suggestions.find((s) =>
              item.label.toLowerCase().includes(s.pattern.title.toLowerCase().split(' ')[0]) ||
              s.pattern.tags.some((t) => item.label.toLowerCase().includes(t)),
            )
          : undefined;
        return (
          <StaggerItem
            key={item.id}
            data-testid={`pof-module-${subModuleId}-checklist-item-${item.id}`}
            tabIndex={0}
            onContextMenu={(e) => handleContextMenu(e, item.id)}
            className={`group p-3 rounded-lg border transition-all duration-base ${
              selectMode && selected.has(item.id)
                ? 'bg-accent-subtle border-accent-strong'
                : justCompleted
                  ? 'bg-green-900/20 border-green-500/40'
                  : isPartial
                    ? 'bg-state-partial-bg border-state-partial-border'
                  : checked
                    ? 'bg-state-done-bg border-state-done-border'
                    : isActive
                      ? 'bg-state-active-bg border-state-active-border'
                      : 'bg-surface border-border hover:border-border-bright'
            }`}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => { setHoveredItemId(null); setPriorityDropdown(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                toggleItem(subModuleId as SubModuleId, item.id);
              } else if (e.key === ' ' && !checked && !isActive) {
                e.preventDefault();
                onRunPrompt(item.id, item.prompt);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null;
                next?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null;
                prev?.focus();
              }
            }}
          >
            <div className="flex items-start gap-3">
              {/* Select mode checkbox */}
              {selectMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelected(item.id); }}
                  className="mt-0.5 flex-shrink-0 text-text-muted hover:text-text transition-colors"
                  aria-label={selected.has(item.id) ? 'Deselect' : 'Select'}
                >
                  {selected.has(item.id) ? (
                    <CheckSquare className="w-4 h-4" style={{ color: accentColor }} />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              )}
              {/* Checkbox */}
              <button
                onClick={() => toggleItem(subModuleId as SubModuleId, item.id)}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isPartial
                    ? 'border-yellow-500 bg-yellow-500/20'
                    : checked
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-checkbox-border hover:border-checkbox-border-hover'
                }`}
              >
                {isPartial
                  ? <ShieldAlert className="w-3 h-3 text-yellow-400" />
                  : checked
                    ? <Check className="w-3 h-3 text-green-400" />
                    : null}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono">{index + 1}.</span>
                  <span className={`text-xs font-medium ${checked ? 'text-text-muted line-through' : 'text-text'}`}>
                    {item.label}
                  </span>
                  {/* Priority badge */}
                  {priority !== 'none' && (
                    <PriorityBadge priority={priority} />
                  )}
                  {/* Partial verification badge */}
                  {isPartial && (
                    <span
                      className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-yellow-500/12 text-yellow-400 border border-yellow-500/20"
                      title={itemVerification.missingMembers?.length
                        ? `Missing: ${itemVerification.missingMembers.join(', ')}`
                        : `${Math.round(itemVerification.completeness * 100)}% complete`}
                    >
                      <ShieldAlert className="w-2.5 h-2.5" />
                      {Math.round(itemVerification.completeness * 100)}%
                    </span>
                  )}
                  {isActive && (
                    <span className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-accent-medium text-accent-setup">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      running
                    </span>
                  )}
                  {justCompleted && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 animate-pulse">
                      done
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 leading-relaxed ${checked ? 'text-text-muted' : 'text-text-muted'}`}>
                  {item.description}
                </p>

                {/* Notes indicator + expandable section */}
                {(notes || isNotesExpanded) && (
                  <NotesSection
                    itemId={item.id}
                    notes={notes}
                    isExpanded={isNotesExpanded}
                    isEditing={isEditingThis}
                    onToggle={() => toggleNotes(item.id)}
                    onStartEdit={() => setEditingNotes(item.id)}
                    onSave={(text) => { saveMetadata(item.id, { notes: text }); setEditingNotes(null); }}
                    onCancelEdit={() => setEditingNotes(null)}
                  />
                )}

                {/* Partial verification details */}
                {isPartial && itemVerification.missingMembers?.length > 0 && hoveredItemId === item.id && (
                  <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1 bg-yellow-400/5 border border-yellow-400/15 rounded text-2xs text-yellow-400">
                    <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Missing:</strong>{' '}
                      {itemVerification.missingMembers.join(', ')}
                    </span>
                  </div>
                )}

                {/* Pattern suggestion hint */}
                {matchingSuggestion && hoveredItemId === item.id && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-violet-400/5 border border-violet-400/15 rounded text-2xs text-violet-400">
                    <Sparkles className="w-3 h-3 flex-shrink-0" />
                    <span>
                      <strong>{Math.round(matchingSuggestion.pattern.successRate * 100)}% success</strong>
                      {' — '}
                      {matchingSuggestion.pattern.approach} approach
                      {matchingSuggestion.pattern.sessionCount > 1 && ` (${matchingSuggestion.pattern.sessionCount} sessions)`}
                    </span>
                  </div>
                )}
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all">
                {/* Notes toggle */}
                <button
                  onClick={() => toggleNotes(item.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    notes
                      ? 'text-accent-content hover:bg-status-amber-medium'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                  title={notes ? 'View notes' : 'Add notes'}
                >
                  <StickyNote className="w-3 h-3" />
                </button>
                {/* Priority dropdown */}
                <PriorityDropdown
                  itemId={item.id}
                  priority={priority}
                  isOpen={priorityDropdown === item.id}
                  onToggle={() => setPriorityDropdown(priorityDropdown === item.id ? null : item.id)}
                  onSelect={(p) => handleSetPriority(item.id, p)}
                />
                {/* Copy prompt */}
                <CopyItemButton text={item.prompt} tooltip="Copy CLI prompt" />
                {/* Verify implementation — for partial items, sends to Claude for deep review */}
                {isPartial && !isActive && (
                  <button
                    onClick={() => onRunPrompt(item.id, `Verify my implementation of "${item.label}". Check the header file for: ${itemVerification.missingMembers?.join(', ') || 'completeness'}. Confirm what is implemented, what is missing, and suggest fixes.`)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 bg-yellow-500/12 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/20"
                  >
                    <ScanSearch className="w-3 h-3" />
                    Verify
                  </button>
                )}
                {/* Claude */}
                {!checked && !isActive && (
                  <AccentButton
                    onClick={() => onRunPrompt(item.id, item.prompt)}
                    disabled={isRunning}
                    accentColor={accentColor}
                    size="sm"
                    leftIcon={<Play className="w-3 h-3" />}
                  >
                    Claude
                  </AccentButton>
                )}
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerContainer>
  );
}
