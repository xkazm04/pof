'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Check, Play, Loader2, Sparkles, Info, Copy,
  ChevronDown, ChevronRight, StickyNote, Flag,
  CheckSquare, Square, X, ClipboardCopy, CheckCheck, Undo2,
  Zap, AlertTriangle, TrendingUp, ChevronUp, ShieldAlert, ScanSearch,
  RotateCcw, FileCode, ArrowUpToLine,
} from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useNBA } from '@/hooks/useNBA';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { ChecklistItem } from '@/types/modules';
import type { PatternSuggestion } from '@/types/pattern-library';
import type { NBARecommendation } from '@/lib/nba-engine';
import type { VerificationInfo } from '@/stores/moduleStore';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_PROGRESS: Record<string, boolean> = {};
const EMPTY_SUGGESTIONS: PatternSuggestion[] = [];
const EMPTY_VERIFICATION: Record<string, VerificationInfo> = {};

type Priority = 'none' | 'critical' | 'important' | 'nice-to-have';

interface ItemMetadata {
  priority: Priority;
  notes: string;
  updatedAt: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  none:          { label: 'No priority', color: 'transparent', bg: 'transparent', border: 'transparent' },
  critical:     { label: 'Critical',     color: '#ef4444', bg: '#ef444418', border: '#ef444430' },
  important:    { label: 'Important',    color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b30' },
  'nice-to-have': { label: 'Nice to Have', color: '#60a5fa', bg: '#60a5fa18', border: '#60a5fa30' },
};

const PRIORITY_OPTIONS: Priority[] = ['none', 'critical', 'important', 'nice-to-have'];

// ── Main component ──────────────────────────────────────────────────────────

export interface RoadmapChecklistProps {
  items: ChecklistItem[];
  subModuleId: string;
  onRunPrompt: (itemId: string, prompt: string) => void;
  accentColor: string;
  isRunning: boolean;
  activeItemId?: string | null;
  lastCompletedItemId?: string | null;
}

export function RoadmapChecklist({
  items, subModuleId, onRunPrompt, accentColor, isRunning,
  activeItemId, lastCompletedItemId,
}: RoadmapChecklistProps) {
  const progress = useModuleStore((s) => s.checklistProgress[subModuleId] ?? EMPTY_PROGRESS);
  const verification = useModuleStore((s) => s.checklistVerification[subModuleId] ?? EMPTY_VERIFICATION);
  const toggleItem = useModuleStore((s) => s.toggleChecklistItem);
  const setItem = useModuleStore((s) => s.setChecklistItem);
  const suggestions = usePatternLibraryStore((s) => s.suggestions) ?? EMPTY_SUGGESTIONS;
  const fetchSuggestions = usePatternLibraryStore((s) => s.fetchSuggestions);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Metadata state
  const [metadata, setMetadata] = useState<Record<string, ItemMetadata>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [priorityDropdown, setPriorityDropdown] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, itemId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleMarkAllAbove = useCallback((itemId: string) => {
    const idx = items.findIndex((i) => i.id === itemId);
    for (let i = 0; i < idx; i++) {
      if (!progress[items[i].id]) {
        setItem(subModuleId, items[i].id, true);
      }
    }
    closeContextMenu();
  }, [items, progress, subModuleId, setItem, closeContextMenu]);

  const handleResetItem = useCallback((itemId: string) => {
    if (progress[itemId]) {
      setItem(subModuleId, itemId, false);
    }
    closeContextMenu();
  }, [progress, subModuleId, setItem, closeContextMenu]);

  // Select mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = useCallback((itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map((i) => i.id)));
  }, [items]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  // Fetch suggestions + metadata on mount
  useEffect(() => {
    fetchSuggestions(subModuleId);
  }, [fetchSuggestions, subModuleId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/checklist-metadata?moduleId=${encodeURIComponent(subModuleId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setMetadata(data.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subModuleId]);

  // Save metadata to API
  const saveMetadata = useCallback(async (itemId: string, patch: Partial<ItemMetadata>) => {
    const current = metadata[itemId] ?? { priority: 'none' as Priority, notes: '', updatedAt: '' };
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    setMetadata((prev) => ({ ...prev, [itemId]: updated }));

    await fetch('/api/checklist-metadata', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: subModuleId,
        itemId,
        priority: updated.priority,
        notes: updated.notes,
      }),
    }).catch(() => {});
  }, [metadata, subModuleId]);

  const handleSetPriority = useCallback((itemId: string, priority: Priority) => {
    saveMetadata(itemId, { priority });
    setPriorityDropdown(null);
  }, [saveMetadata]);

  const toggleNotes = useCallback((itemId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setEditingNotes(null);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // NBA recommendations
  const { top: nbaTop, recommendations: nbaRecs, isLoading: nbaLoading } = useNBA(subModuleId);
  const [nbaExpanded, setNbaExpanded] = useState(false);

  const completedCount = items.filter((item) => progress[item.id]).length;
  const progressPercent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  // Priority summary
  const criticalCount = Object.values(metadata).filter((m) => m.priority === 'critical').length;
  const importantCount = Object.values(metadata).filter((m) => m.priority === 'important').length;

  return (
    <div className="space-y-4">
      {/* Next Best Action banner */}
      {!nbaLoading && nbaTop && !progress[nbaTop.item.id] && activeItemId !== nbaTop.item.id && (
        <NBABanner
          top={nbaTop}
          runners={nbaRecs.slice(1, 4)}
          expanded={nbaExpanded}
          onToggleExpand={() => setNbaExpanded((p) => !p)}
          onRun={(rec) => onRunPrompt(rec.item.id, rec.item.prompt)}
          accentColor={accentColor}
          isRunning={isRunning}
        />
      )}

      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Progress</span>
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs transition-colors ${
                selectMode
                  ? 'bg-accent-medium text-[#00ff88]'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              }`}
              title={selectMode ? 'Exit select mode' : 'Select multiple items'}
            >
              <CheckSquare className="w-3 h-3" />
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            {selectMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAll}
                  className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  All
                </button>
                <button
                  onClick={selectNone}
                  className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  None
                </button>
                {selected.size > 0 && (
                  <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-accent-subtle" style={{ color: accentColor }}>
                    {selected.size}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-2xs" style={{ color: PRIORITY_CONFIG.critical.color }}>
                <Flag className="w-2.5 h-2.5" /> {criticalCount} critical
              </span>
            )}
            {importantCount > 0 && (
              <span className="flex items-center gap-1 text-2xs" style={{ color: PRIORITY_CONFIG.important.color }}>
                <Flag className="w-2.5 h-2.5" /> {importantCount} important
              </span>
            )}
            <span className="text-text font-medium">{completedCount} / {items.length}</span>
          </div>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-slow ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* First-visit hint */}
      {completedCount === 0 && !isRunning && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-surface text-2xs text-text-muted leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
          <span>
            Each item has a <strong className="text-text">Claude</strong> button that sends a context-aware prompt to the CLI.
            Check items off manually or let Claude auto-complete them after a successful run.
            Right-click the flag icon to set priority.
          </span>
        </div>
      )}

      {/* Floating action bar for select mode */}
      {selectMode && selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          items={items}
          subModuleId={subModuleId}
          progress={progress}
          accentColor={accentColor}
          onRunPrompt={onRunPrompt}
          isRunning={isRunning}
          onDone={exitSelectMode}
        />
      )}

      {/* Checklist items */}
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
              tabIndex={0}
              onContextMenu={(e) => handleContextMenu(e, item.id)}
              className={`group p-3 rounded-lg border transition-all duration-base ${
                selectMode && selected.has(item.id)
                  ? 'bg-accent-subtle border-accent-strong'
                  : justCompleted
                    ? 'bg-green-900/20 border-green-500/40'
                    : isPartial
                      ? 'bg-[#1a1700] border-[#3a3000]'
                    : checked
                      ? 'bg-[#0d1a0d] border-[#1a3a1a]'
                      : isActive
                        ? 'bg-[#111130] border-[#2e2e6a]'
                        : 'bg-surface border-border hover:border-border-bright'
              }`}
              onMouseEnter={() => setHoveredItemId(item.id)}
              onMouseLeave={() => { setHoveredItemId(null); setPriorityDropdown(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  toggleItem(subModuleId, item.id);
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
                  onClick={() => toggleItem(subModuleId, item.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isPartial
                      ? 'border-yellow-500 bg-yellow-500/20'
                      : checked
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-[#3e3e6a] hover:border-[#5e5e8a]'
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
                      <span className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-accent-medium text-[#00ff88]">
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
                        ? 'text-[#f59e0b] hover:bg-[#f59e0b18]'
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
                    <button
                      onClick={() => onRunPrompt(item.id, item.prompt)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: `${accentColor}24`,
                        color: accentColor,
                        border: `1px solid ${accentColor}38`,
                      }}
                    >
                      <Play className="w-3 h-3" />
                      Claude
                    </button>
                  )}
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Context menu */}
      {contextMenu && (
        <ChecklistContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={items.find((i) => i.id === contextMenu.itemId)!}
          itemIndex={items.findIndex((i) => i.id === contextMenu.itemId)}
          isChecked={!!progress[contextMenu.itemId]}
          verification={verification[contextMenu.itemId]}
          accentColor={accentColor}
          isRunning={isRunning}
          onClose={closeContextMenu}
          onCopyPrompt={(text) => {
            navigator.clipboard.writeText(text);
            closeContextMenu();
          }}
          onRunWithClaude={(itemId, prompt) => {
            onRunPrompt(itemId, prompt);
            closeContextMenu();
          }}
          onMarkAllAbove={handleMarkAllAbove}
          onResetItem={handleResetItem}
          onAddNote={(itemId) => {
            setExpandedNotes((prev) => new Set([...prev, itemId]));
            setEditingNotes(itemId);
            closeContextMenu();
          }}
        />
      )}
    </div>
  );
}

// ── Priority badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  if (priority === 'none') return null;
  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.label}
    </span>
  );
}

// ── Priority dropdown ────────────────────────────────────────────────────────

function PriorityDropdown({ itemId, priority, isOpen, onToggle, onSelect }: {
  itemId: string;
  priority: Priority;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (p: Priority) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const config = PRIORITY_CONFIG[priority];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`p-1.5 rounded-md transition-colors ${
          priority !== 'none'
            ? ''
            : 'text-text-muted hover:text-text hover:bg-surface-hover'
        }`}
        style={priority !== 'none' ? { color: config.color } : undefined}
        title="Set priority"
      >
        <Flag className="w-3 h-3" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {PRIORITY_OPTIONS.map((p) => {
            const pc = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => onSelect(p)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-surface-hover ${
                  priority === p ? 'bg-surface-hover' : ''
                }`}
              >
                {p !== 'none' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pc.color }} />
                )}
                {p === 'none' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-border" />}
                <span className="text-text">{pc.label}</span>
                {priority === p && <Check className="w-3 h-3 text-text-muted ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notes section ────────────────────────────────────────────────────────────

function NotesSection({ itemId, notes, isExpanded, isEditing, onToggle, onStartEdit, onSave, onCancelEdit }: {
  itemId: string;
  notes: string;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onSave: (text: string) => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState(notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(notes);
  }, [notes]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  if (!isExpanded && notes) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1 mt-1.5 text-2xs text-[#f59e0b] hover:text-[#fbbf24] transition-colors"
      >
        <ChevronRight className="w-2.5 h-2.5" />
        <StickyNote className="w-2.5 h-2.5" />
        <TruncateWithTooltip className="truncate max-w-[200px] block" side="bottom">{notes}</TruncateWithTooltip>
      </button>
    );
  }

  if (!isExpanded) return null;

  return (
    <div className="mt-2 pl-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-2xs text-text-muted hover:text-text transition-colors mb-1.5"
      >
        <ChevronDown className="w-2.5 h-2.5" />
        Notes
      </button>
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onSave(draft);
              }
              if (e.key === 'Escape') {
                setDraft(notes);
                onCancelEdit();
              }
            }}
            placeholder="Add notes about this item..."
            className="w-full px-2.5 py-1.5 bg-background border border-border-bright rounded-md text-xs text-text outline-none focus:border-[#f59e0b]/50 resize-none"
            rows={3}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSave(draft)}
              className="px-2 py-1 rounded text-2xs font-medium bg-[#f59e0b18] text-[#f59e0b] border border-[#f59e0b30] hover:bg-[#f59e0b28] transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setDraft(notes); onCancelEdit(); }}
              className="px-2 py-1 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <span className="text-2xs text-text-muted ml-auto">Ctrl+Enter to save</span>
          </div>
        </div>
      ) : (
        <div
          onClick={onStartEdit}
          className="px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-muted cursor-text hover:border-border-bright transition-colors min-h-[32px]"
        >
          {notes || <span className="italic">Click to add notes...</span>}
        </div>
      )}
    </div>
  );
}

// ── Bulk action bar ─────────────────────────────────────────────────────────

function BulkActionBar({
  selected, items, subModuleId, progress, accentColor,
  onRunPrompt, isRunning, onDone,
}: {
  selected: Set<string>;
  items: ChecklistItem[];
  subModuleId: string;
  progress: Record<string, boolean>;
  accentColor: string;
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  onDone: () => void;
}) {
  const toggleItem = useModuleStore((s) => s.toggleChecklistItem);
  const setItem = useModuleStore((s) => s.setChecklistItem);
  const [copied, setCopied] = useState(false);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const allDone = selectedItems.every((i) => progress[i.id]);
  const allUndone = selectedItems.every((i) => !progress[i.id]);

  const handleMarkDone = useCallback(() => {
    for (const item of selectedItems) {
      if (!progress[item.id]) setItem(subModuleId, item.id, true);
    }
  }, [selectedItems, progress, subModuleId, setItem]);

  const handleMarkUndone = useCallback(() => {
    for (const item of selectedItems) {
      if (progress[item.id]) setItem(subModuleId, item.id, false);
    }
  }, [selectedItems, progress, subModuleId, setItem]);

  const handleCopyPrompts = useCallback(async () => {
    const text = selectedItems.map((i) => i.prompt).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selectedItems]);

  const handleBatchRun = useCallback(() => {
    // Run the first unchecked selected item — the CLI onComplete flow can queue the next
    const firstUnchecked = selectedItems.find((i) => !progress[i.id]);
    if (firstUnchecked) {
      onRunPrompt(firstUnchecked.id, firstUnchecked.prompt);
    }
  }, [selectedItems, progress, onRunPrompt]);

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border border-border-bright bg-surface shadow-lg">
      <span className="text-2xs font-medium text-text-muted mr-1">
        {selected.size} selected
      </span>
      <div className="h-4 w-px bg-border" />

      {!allDone && (
        <button
          onClick={handleMarkDone}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 transition-colors"
        >
          <CheckCheck className="w-3 h-3" />
          Mark Done
        </button>
      )}
      {!allUndone && (
        <button
          onClick={handleMarkUndone}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted bg-surface-hover hover:bg-border border border-border transition-colors"
        >
          <Undo2 className="w-3 h-3" />
          Mark Undone
        </button>
      )}

      <button
        onClick={handleBatchRun}
        disabled={isRunning || allDone}
        className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors"
        style={{
          backgroundColor: `${accentColor}24`,
          color: accentColor,
          border: `1px solid ${accentColor}38`,
        }}
      >
        <Play className="w-3 h-3" />
        Run with Claude
      </button>

      <button
        onClick={handleCopyPrompts}
        className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted bg-surface-hover hover:bg-border border border-border transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <ClipboardCopy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy Prompts'}
      </button>

      <div className="ml-auto">
        <button
          onClick={onDone}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          title="Exit select mode"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Next Best Action banner ─────────────────────────────────────────────────

function NBABanner({
  top, runners, expanded, onToggleExpand, onRun, accentColor, isRunning,
}: {
  top: NBARecommendation;
  runners: NBARecommendation[];
  expanded: boolean;
  onToggleExpand: () => void;
  onRun: (rec: NBARecommendation) => void;
  accentColor: string;
  isRunning: boolean;
}) {
  const successPct = Math.round(top.successProbability * 100);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}>
      {/* Top recommendation */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Zap className="w-3 h-3" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                Next Best Action
              </span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full font-mono font-medium" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
                {top.score}
              </span>
            </div>
            <p className="text-xs font-medium text-text mt-1">{top.item.label}</p>
            <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">{top.reason}</p>

            {/* Metrics row */}
            <div className="flex items-center gap-3 mt-2">
              {top.pattern && (
                <span className="flex items-center gap-1 text-2xs text-text-muted">
                  <TrendingUp className="w-3 h-3" style={{ color: successPct >= 70 ? '#4ade80' : successPct >= 40 ? '#fbbf24' : '#f87171' }} />
                  <strong style={{ color: successPct >= 70 ? '#4ade80' : successPct >= 40 ? '#fbbf24' : '#f87171' }}>{successPct}%</strong> success
                </span>
              )}
              {top.pattern?.approach && (
                <span className="text-2xs text-text-muted">
                  {top.pattern.approach} approach
                </span>
              )}
              {top.pattern && top.pattern.sessionCount > 0 && (
                <span className="text-2xs text-text-muted">
                  {top.pattern.sessionCount} session{top.pattern.sessionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Pitfalls */}
            {top.pitfalls.length > 0 && (
              <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 bg-[#ef444408] border border-[#ef444418] rounded text-2xs text-[#f87171]">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{top.pitfalls[0]}{top.pitfalls.length > 1 ? ` (+${top.pitfalls.length - 1} more)` : ''}</span>
              </div>
            )}
          </div>

          {/* Run button */}
          <button
            onClick={() => onRun(top)}
            disabled={isRunning}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${accentColor}24`,
              color: accentColor,
              border: `1px solid ${accentColor}38`,
            }}
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>
      </div>

      {/* Runners-up toggle */}
      {runners.length > 0 && (
        <>
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-2xs text-text-muted hover:text-text transition-colors border-t"
            style={{ borderColor: `${accentColor}15` }}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : `${runners.length} more suggestion${runners.length > 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="border-t" style={{ borderColor: `${accentColor}15` }}>
              {runners.map((rec) => (
                <NBARunnerRow key={rec.item.id} rec={rec} accentColor={accentColor} onRun={onRun} isRunning={isRunning} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NBARunnerRow({
  rec, accentColor, onRun, isRunning,
}: {
  rec: NBARecommendation;
  accentColor: string;
  onRun: (rec: NBARecommendation) => void;
  isRunning: boolean;
}) {
  const successPct = Math.round(rec.successProbability * 100);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover/50 transition-colors group">
      <span
        className="flex-shrink-0 text-2xs font-mono font-medium w-6 text-center rounded py-0.5"
        style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
      >
        {rec.score}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text truncate">{rec.item.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-text-muted truncate">{rec.reason}</span>
          {rec.pattern && (
            <span className="flex-shrink-0 text-2xs" style={{ color: successPct >= 70 ? '#4ade80' : successPct >= 40 ? '#fbbf24' : '#f87171' }}>
              {successPct}%
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRun(rec)}
        disabled={isRunning}
        className="flex-shrink-0 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${accentColor}18`,
          color: accentColor,
          border: `1px solid ${accentColor}28`,
        }}
      >
        <Play className="w-2.5 h-2.5" />
        Run
      </button>
    </div>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────

function ChecklistContextMenu({
  x, y, item, itemIndex, isChecked, verification, accentColor,
  isRunning, onClose, onCopyPrompt, onRunWithClaude, onMarkAllAbove,
  onResetItem, onAddNote,
}: {
  x: number;
  y: number;
  item: ChecklistItem;
  itemIndex: number;
  isChecked: boolean;
  verification?: VerificationInfo;
  accentColor: string;
  isRunning: boolean;
  onClose: () => void;
  onCopyPrompt: (text: string) => void;
  onRunWithClaude: (itemId: string, prompt: string) => void;
  onMarkAllAbove: (itemId: string) => void;
  onResetItem: (itemId: string) => void;
  onAddNote: (itemId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Reposition if overflowing viewport
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
  }, [x, y]);

  // Close on click-outside, scroll, or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const hasVerifiedFile = verification && (verification.status === 'full' || verification.status === 'partial');

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] py-1 bg-surface border border-border-bright rounded-lg shadow-2xl backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Copy Prompt */}
      <ContextMenuItem
        icon={<ClipboardCopy className="w-3.5 h-3.5" />}
        label="Copy Prompt"
        shortcut="Ctrl+C"
        onClick={() => onCopyPrompt(item.prompt)}
      />

      {/* Run with Claude */}
      <ContextMenuItem
        icon={<Play className="w-3.5 h-3.5" />}
        label="Run with Claude"
        iconColor={accentColor}
        disabled={isRunning || isChecked}
        onClick={() => onRunWithClaude(item.id, item.prompt)}
      />

      <ContextMenuDivider />

      {/* Mark All Above Complete */}
      <ContextMenuItem
        icon={<ArrowUpToLine className="w-3.5 h-3.5" />}
        label="Mark All Above Done"
        disabled={itemIndex === 0}
        onClick={() => onMarkAllAbove(item.id)}
      />

      {/* Reset Item */}
      <ContextMenuItem
        icon={<RotateCcw className="w-3.5 h-3.5" />}
        label="Reset Item"
        disabled={!isChecked}
        onClick={() => onResetItem(item.id)}
      />

      <ContextMenuDivider />

      {/* View Generated Code */}
      {hasVerifiedFile && (
        <ContextMenuItem
          icon={<FileCode className="w-3.5 h-3.5" />}
          label="View Generated Code"
          iconColor="#60a5fa"
          onClick={() => {
            onRunWithClaude(
              item.id,
              `Show me the implementation code for "${item.label}". Display the relevant header and source file contents.`,
            );
          }}
        />
      )}

      {/* Add Note */}
      <ContextMenuItem
        icon={<StickyNote className="w-3.5 h-3.5" />}
        label="Add Note"
        iconColor="#f59e0b"
        onClick={() => onAddNote(item.id)}
      />
    </div>
  );
}

function ContextMenuItem({
  icon, label, shortcut, disabled, iconColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  iconColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
        disabled
          ? 'text-text-muted/40 cursor-default'
          : 'text-text hover:bg-surface-hover'
      }`}
    >
      <span className="flex-shrink-0" style={iconColor && !disabled ? { color: iconColor } : undefined}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-2xs text-text-muted font-mono">{shortcut}</span>
      )}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}

// ── Copy button ──────────────────────────────────────────────────────────────

function CopyItemButton({ text, tooltip = 'Copy' }: { text: string; tooltip?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
      title={copied ? 'Copied!' : tooltip}
    >
      {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}
