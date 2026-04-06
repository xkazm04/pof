'use client';

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react';
import { X } from 'lucide-react';
import { Z_INDEX } from '@/lib/constants';
import {
  ACCENT_CYAN_LIGHT,
  OPACITY_10,
  OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import type {
  SelectorItem,
  SelectorGroup as GroupT,
  ScalableSelectorProps,
} from './types';
import { SelectorSearch, type SelectorSearchHandle } from './SelectorSearch';
import { SelectorGroupHeader } from './SelectorGroup';
import { SelectorGrid } from './SelectorGrid';

/** Debounce delay for search input. */
const DEBOUNCE_MS = 300;
const MAX_VISIBLE_PILLS = 8;
/** Number of items to jump with Page Up/Down — ~10 visible items or list size. */
const PAGE_JUMP = 10;

/* ── helpers ───────────────────────────────────────────────────────────── */

function groupItems<T extends SelectorItem>(
  items: T[],
  groupBy?: keyof T,
): GroupT<T>[] {
  if (!groupBy) {
    return [{ key: '__all', label: 'All', items }];
  }
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = String(item[groupBy] ?? 'Other');
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    items: groupItems,
  }));
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function collectItemIds<T extends SelectorItem>(
  groups: GroupT<T>[],
  collapsedGroups: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    if (!collapsedGroups.has(g.key)) {
      for (const item of g.items) ids.push(item.id);
    }
  }
  return ids;
}

/* ── component ─────────────────────────────────────────────────────────── */

export function ScalableSelector<T extends SelectorItem>({
  items,
  groupBy,
  renderItem,
  onSelect,
  selected,
  searchKey,
  placeholder = 'Search...',
  mode = 'single',
  open,
  onClose,
  title,
  accent = ACCENT_CYAN_LIGHT,
}: ScalableSelectorProps<T>) {
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebounced(rawQuery, DEBOUNCE_MS);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const searchRef = useRef<SelectorSearchHandle>(null);

  const selectedIds = useMemo(() => new Set(selected), [selected]);

  // Filter items by debounced search query.
  const filtered = useMemo(() => {
    if (!debouncedQuery) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter((item) => {
      const val = item[searchKey];
      return typeof val === 'string' && val.toLowerCase().includes(q);
    });
  }, [items, debouncedQuery, searchKey]);

  // Group filtered items.
  const groups = useMemo(
    () => groupItems(filtered, groupBy),
    [filtered, groupBy],
  );

  // Flat list of navigable item ids (respecting collapsed groups).
  const navigableIds = useMemo(
    () => collectItemIds(groups, collapsedGroups),
    [groups, collapsedGroups],
  );

  // O(1) index lookup for keyboard navigation — avoids indexOf scans on every keypress.
  const navigableIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < navigableIds.length; i++) map.set(navigableIds[i], i);
    return map;
  }, [navigableIds]);

  // Reset focused item when it's no longer in the navigable list (state-during-render pattern).
  if (focusedId && !navigableIndexMap.has(focusedId)) {
    setFocusedId(null);
  }

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // O(1) item lookup by id — avoids repeated linear scans in toggle callbacks.
  const itemsById = useMemo(() => {
    const map = new Map<string, T>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const selectedItems = useMemo(
    () => selected.map((id) => itemsById.get(id)).filter((item): item is T => item != null),
    [selected, itemsById],
  );

  const handleToggleItem = useCallback(
    (item: T) => {
      if (mode === 'single') {
        onSelect([item]);
        onClose();
        return;
      }
      // Multi mode: toggle membership.
      if (selectedIds.has(item.id)) {
        onSelect(selectedItems.filter((i) => i.id !== item.id));
      } else {
        onSelect([...selectedItems, item]);
      }
    },
    [mode, selectedIds, selectedItems, onSelect, onClose],
  );

  const handleRemovePill = useCallback(
    (id: string) => {
      onSelect(selectedItems.filter((i) => i.id !== id));
    },
    [selectedItems, onSelect],
  );

  // Keyboard navigation.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const inInput = (e.target as HTMLElement).tagName === 'INPUT';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (navigableIds.length === 0) return;
        const currentIdx = focusedId != null
          ? (navigableIndexMap.get(focusedId) ?? -1)
          : -1;
        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx =
            currentIdx < navigableIds.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx =
            currentIdx > 0
              ? currentIdx - 1
              : navigableIds.length - 1;
        }
        setFocusedId(navigableIds[nextIdx]);
        return;
      }

      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        if (navigableIds.length === 0) return;
        const currentIdx = focusedId != null
          ? (navigableIndexMap.get(focusedId) ?? -1)
          : -1;
        let nextIdx: number;
        if (e.key === 'PageDown') {
          nextIdx = Math.min(currentIdx + PAGE_JUMP, navigableIds.length - 1);
        } else {
          nextIdx = Math.max(currentIdx - PAGE_JUMP, 0);
        }
        setFocusedId(navigableIds[nextIdx]);
        return;
      }

      // Home/End: let the input handle cursor movement; otherwise jump to edges.
      if (e.key === 'Home' && !inInput) {
        e.preventDefault();
        if (navigableIds.length > 0) setFocusedId(navigableIds[0]);
        return;
      }

      if (e.key === 'End' && !inInput) {
        e.preventDefault();
        if (navigableIds.length > 0) setFocusedId(navigableIds[navigableIds.length - 1]);
        return;
      }

      // Ctrl+A: in input, let the browser select all text; outside input, select all items.
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && mode === 'multi' && !inInput) {
        e.preventDefault();
        onSelect(filtered);
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && focusedId) {
        // Space in the search input should type normally.
        if (e.key === ' ' && inInput) return;
        e.preventDefault();
        if (!navigableIndexMap.has(focusedId)) return;
        const item = itemsById.get(focusedId);
        if (item) handleToggleItem(item);
      }
    },
    [onClose, navigableIds, navigableIndexMap, focusedId, itemsById, handleToggleItem, mode, filtered, onSelect],
  );

  // Reset state when modal opens — state-during-render avoids stale flash.
  const [prevOpen, setPrevOpen] = useState(false);
  const lastOpenRef = useRef(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setRawQuery('');
    setCollapsedGroups(new Set());
    setFocusedId(selected.length > 0 ? selected[0] : null);
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Capture trigger element in layout effect — fires before child useEffect
  // autofocus steals focus, preserving the correct element for restore-on-close.
  useLayoutEffect(() => {
    if (open && !lastOpenRef.current) {
      triggerRef.current = document.activeElement;
    }
    lastOpenRef.current = open;
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Restore focus to the trigger element when the modal closes.
  useEffect(() => {
    if (!open && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Focus trap — keep Tab cycling inside the modal.
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const container = containerRef.current;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: Z_INDEX.modal }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Select'}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">
            {title ?? 'Select'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-hover transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <SelectorSearch
            ref={searchRef}
            value={rawQuery}
            onChange={setRawQuery}
            placeholder={placeholder}
            accent={accent}
            resultCount={filtered.length}
            totalCount={items.length}
          />
        </div>

        {/* Selected pills (multi mode) */}
        {mode === 'multi' && selectedItems.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5">
            {selectedItems.slice(0, MAX_VISIBLE_PILLS).map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border"
                style={{
                  backgroundColor: withOpacity(accent, OPACITY_10),
                  borderColor: withOpacity(accent, OPACITY_20),
                  color: accent,
                }}
              >
                {String(item[searchKey])}
                <button
                  onClick={() => handleRemovePill(item.id)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${String(item[searchKey])}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {selectedItems.length > MAX_VISIBLE_PILLS && (
              <span className="text-2xs text-text-muted font-mono">
                +{selectedItems.length - MAX_VISIBLE_PILLS} more
              </span>
            )}
            {selectedItems.length > 2 && (
              <button
                onClick={() => onSelect([])}
                className="text-2xs text-text-muted hover:text-text transition-colors ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Virtual scrolling grid */}
        <SelectorGrid
          groups={groups}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          selectedIds={selectedIds}
          onToggleItem={handleToggleItem}
          renderItem={renderItem}
          renderGroupHeader={(group) => (
            <SelectorGroupHeader
              label={group.label}
              count={group.items.length}
              accent={accent}
              expanded={!collapsedGroups.has(group.key)}
            />
          )}
          focusedId={focusedId}
          onFocusChange={setFocusedId}
          multiselectable={mode === 'multi'}
          hasItems={items.length > 0}
        />

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-2xs text-text-muted">
          <div className="flex gap-3 flex-wrap">
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                ↑↓
              </kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                PgUp/Dn
              </kbd>{' '}
              jump
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                Home/End
              </kbd>{' '}
              edges
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                Enter
              </kbd>{' '}
              select
            </span>
            {mode === 'multi' && (
              <span>
                <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                  Ctrl+A
                </kbd>{' '}
                all
              </span>
            )}
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-surface-deep text-text-muted font-mono">
                Esc
              </kbd>{' '}
              close
            </span>
          </div>
          {mode === 'multi' && (
            <span style={{ color: accent }}>
              {selectedItems.length} selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ScalableSelectorProps, SelectorItem, SelectorGroup, SelectionMode } from './types';
