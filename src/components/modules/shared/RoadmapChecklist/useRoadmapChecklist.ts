'use client';

import { useEffect, useState, useCallback, useReducer } from 'react';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useNBA } from '@/hooks/useNBA';
import { useModulePatterns } from './useModulePatterns';
import type { ChecklistItem, SubModuleId } from '@/types/modules';
import { EMPTY_PROGRESS, EMPTY_SUGGESTIONS, EMPTY_VERIFICATION } from './constants';
import { getMetadataData, metadataReducer, selectReducer } from './reducers';
import type {
  ItemMetadata, Priority, LayoutMode, MetadataPhase, SelectPhase,
} from './types';

export function useRoadmapChecklist(items: ChecklistItem[], subModuleId: string) {
  const progress = useModuleStore((s) => s.checklistProgress[subModuleId] ?? EMPTY_PROGRESS);
  const verification = useModuleStore((s) => s.checklistVerification[subModuleId] ?? EMPTY_VERIFICATION);
  const toggleItem = useModuleStore((s) => s.toggleChecklistItem);
  const setItem = useModuleStore((s) => s.setChecklistItem);
  const suggestions = usePatternLibraryStore((s) => s.suggestions) ?? EMPTY_SUGGESTIONS;
  const fetchSuggestions = usePatternLibraryStore((s) => s.fetchSuggestions);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutMode>('compact');

  // Metadata state machine
  const [metaState, metaDispatch] = useReducer(metadataReducer, { phase: 'idle' } as MetadataPhase);
  const metadata = getMetadataData(metaState);
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
        setItem(subModuleId as SubModuleId, items[i].id, true);
      }
    }
    closeContextMenu();
  }, [items, progress, subModuleId, setItem, closeContextMenu]);

  const handleResetItem = useCallback((itemId: string) => {
    if (progress[itemId]) {
      setItem(subModuleId as SubModuleId, itemId, false);
    }
    closeContextMenu();
  }, [progress, subModuleId, setItem, closeContextMenu]);

  // Select mode state machine
  const [selectState, selectDispatch] = useReducer(selectReducer, { phase: 'inactive' } as SelectPhase);
  const selectMode = selectState.phase === 'active';
  const selected = selectState.phase === 'active' ? selectState.selected : new Set<string>();

  const toggleSelected = useCallback((itemId: string) => {
    selectDispatch({ type: 'TOGGLE', itemId });
  }, []);

  const selectAll = useCallback(() => {
    selectDispatch({ type: 'SELECT_ALL', itemIds: items.map((i) => i.id) });
  }, [items]);

  const selectNone = useCallback(() => {
    selectDispatch({ type: 'SELECT_NONE' });
  }, []);

  const exitSelectMode = useCallback(() => {
    selectDispatch({ type: 'EXIT' });
  }, []);

  // Fetch suggestions + metadata on mount
  useEffect(() => {
    fetchSuggestions(subModuleId as SubModuleId);
  }, [fetchSuggestions, subModuleId]);

  useEffect(() => {
    let cancelled = false;
    metaDispatch({ type: 'FETCH_START' });
    fetch(`/api/checklist-metadata?moduleId=${encodeURIComponent(subModuleId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          metaDispatch({ type: 'FETCH_SUCCESS', data: data.data });
        } else if (!cancelled) {
          metaDispatch({ type: 'FETCH_ERROR', error: 'Failed to load metadata' });
        }
      })
      .catch(() => {
        if (!cancelled) metaDispatch({ type: 'FETCH_ERROR', error: 'Network error' });
      });
    return () => { cancelled = true; };
  }, [subModuleId]);

  // Save metadata to API
  const saveMetadata = useCallback(async (itemId: string, patch: Partial<ItemMetadata>) => {
    metaDispatch({ type: 'SAVE_START', itemId, patch });

    const current = metadata[itemId] ?? { priority: 'none' as Priority, notes: '', updatedAt: '' };
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };

    try {
      await fetch('/api/checklist-metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: subModuleId,
          itemId,
          priority: updated.priority,
          notes: updated.notes,
        }),
      });
      metaDispatch({ type: 'SAVE_DONE' });
    } catch {
      metaDispatch({ type: 'SAVE_ERROR', error: 'Failed to save' });
    }
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

  // NBA recommendations. The pattern library is fetched HERE, per module: the
  // NBA card's pitfalls warning and success metrics read it, and the shared
  // store slice is only ever filled by the Pattern Library evaluator tab — so
  // without this read both were unreachable from a module view.
  const patternLibrary = useModulePatterns(subModuleId as SubModuleId);
  const {
    top: nbaTop, recommendations: nbaRecs, isLoading: nbaLoading,
    scope: nbaScope, scopedRows: nbaScopedRows,
  } = useNBA(subModuleId as SubModuleId, patternLibrary.patterns);
  const [nbaExpanded, setNbaExpanded] = useState(false);

  const completedCount = items.filter((item) => progress[item.id]).length;
  const progressPercent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  // Priority summary
  const criticalCount = Object.values(metadata).filter((m) => m.priority === 'critical').length;
  const importantCount = Object.values(metadata).filter((m) => m.priority === 'important').length;

  return {
    progress, verification, toggleItem, setItem, suggestions,
    hoveredItemId, setHoveredItemId,
    layout, setLayout,
    metadata,
    expandedNotes, setExpandedNotes,
    editingNotes, setEditingNotes,
    priorityDropdown, setPriorityDropdown,
    contextMenu,
    handleContextMenu, closeContextMenu, handleMarkAllAbove, handleResetItem,
    selectMode, selected, selectDispatch,
    toggleSelected, selectAll, selectNone, exitSelectMode,
    saveMetadata, handleSetPriority, toggleNotes,
    nbaTop, nbaRecs, nbaLoading, nbaExpanded, setNbaExpanded,
    nbaScope, nbaScopedRows, patternLibrary,
    completedCount, progressPercent, criticalCount, importantCount,
  };
}
