import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react';
import type { SelectorItem, ScalableSelectorProps } from './types';
import type { SelectorSearchHandle } from './SelectorSearch';
import { DEBOUNCE_MS, PAGE_JUMP } from './constants';
import { groupItems, collectItemIds } from './helpers';

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type UseScalableSelectorArgs<T extends SelectorItem> = Pick<
  ScalableSelectorProps<T>,
  'items' | 'groupBy' | 'onSelect' | 'selected' | 'searchKey' | 'mode' | 'open' | 'onClose'
>;

export function useScalableSelector<T extends SelectorItem>({
  items,
  groupBy,
  onSelect,
  selected,
  searchKey,
  mode = 'single',
  open,
  onClose,
}: UseScalableSelectorArgs<T>) {
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

  return {
    rawQuery,
    setRawQuery,
    collapsedGroups,
    focusedId,
    setFocusedId,
    filtered,
    groups,
    toggleGroup,
    selectedIds,
    selectedItems,
    handleToggleItem,
    handleRemovePill,
    handleKeyDown,
    containerRef,
    searchRef,
  };
}
