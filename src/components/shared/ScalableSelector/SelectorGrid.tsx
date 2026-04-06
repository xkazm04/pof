'use client';

import {
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SelectorItem, SelectorGroup as GroupT } from './types';

/** Height of one row in pixels — used for virtual scroll calculations. */
const ROW_HEIGHT = 56;
/** Extra rows to render above and below the viewport. */
const OVERSCAN = 6;
/** Height of a group header row. */
const GROUP_HEADER_HEIGHT = 36;

interface SelectorGridProps<T extends SelectorItem> {
  groups: GroupT<T>[];
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  selectedIds: ReadonlySet<string>;
  onToggleItem: (item: T) => void;
  renderItem: (item: T, selected: boolean) => ReactNode;
  renderGroupHeader: (group: GroupT<T>) => ReactNode;
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  /** Selection mode — drives aria-multiselectable on the listbox. */
  multiselectable?: boolean;
  /** True when items were provided but all filtered out (vs zero items total). */
  hasItems?: boolean;
}

/**
 * A flat row in the virtual list — either a group header or an item.
 * We flatten the grouped structure into a single array so a single
 * virtual scroller can handle everything.
 */
type FlatRow<T extends SelectorItem> =
  | { type: 'header'; group: GroupT<T>; height: number }
  | { type: 'item'; item: T; height: number };

function flattenGroups<T extends SelectorItem>(
  groups: GroupT<T>[],
  collapsedGroups: ReadonlySet<string>,
): FlatRow<T>[] {
  const rows: FlatRow<T>[] = [];
  // Hide the redundant "All" header when no groupBy was specified.
  const showHeaders = !(groups.length === 1 && groups[0].key === '__all');
  for (const group of groups) {
    if (showHeaders) {
      rows.push({ type: 'header', group, height: GROUP_HEADER_HEIGHT });
    }
    if (!collapsedGroups.has(group.key)) {
      for (const item of group.items) {
        rows.push({ type: 'item', item, height: ROW_HEIGHT });
      }
    }
  }
  return rows;
}

export function SelectorGrid<T extends SelectorItem>({
  groups,
  collapsedGroups,
  onToggleGroup,
  selectedIds,
  onToggleItem,
  renderItem,
  renderGroupHeader,
  focusedId,
  onFocusChange,
  multiselectable = false,
  hasItems = true,
}: SelectorGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const rafRef = useRef<number>(0);

  const rows = useMemo(
    () => flattenGroups(groups, collapsedGroups),
    [groups, collapsedGroups],
  );

  // Compute cumulative offsets, total height, and item-id → row-index map together.
  const { offsets, totalHeight, itemRowIndex } = useMemo(() => {
    const result: number[] = [];
    const idxMap = new Map<string, number>();
    let cumulative = 0;
    for (let i = 0; i < rows.length; i++) {
      result.push(cumulative);
      const row = rows[i];
      cumulative += row.height;
      if (row.type === 'item') idxMap.set(row.item.id, i);
    }
    return { offsets: result, totalHeight: cumulative, itemRowIndex: idxMap };
  }, [rows]);

  // Derive visible window via binary search — pure computation, memoized.
  const { visibleRows, offsetTop } = useMemo(() => {
    if (offsets.length === 0) return { visibleRows: [] as FlatRow<T>[], offsetTop: 0 };

    // Find first visible row.
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid] + rows[mid].height <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    const startIdx = Math.max(0, lo - OVERSCAN);

    // Find last visible row.
    lo = startIdx;
    hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid] <= scrollTop + viewportHeight) lo = mid + 1;
      else hi = mid;
    }
    const endIdx = Math.min(rows.length - 1, lo + OVERSCAN);

    return {
      visibleRows: rows.slice(startIdx, endIdx + 1),
      offsetTop: offsets[startIdx] ?? 0,
    };
  }, [rows, offsets, scrollTop, viewportHeight]);

  const onScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    });
  }, []);

  // Clean up rAF on unmount.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll focused item into view — O(1) via itemRowIndex map.
  useEffect(() => {
    if (!focusedId || !containerRef.current) return;
    const idx = itemRowIndex.get(focusedId);
    if (idx == null) return;
    const top = offsets[idx];
    const bottom = top + rows[idx].height;
    const el = containerRef.current;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }, [focusedId, rows, offsets, itemRowIndex]);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-sm text-text-muted">
        {hasItems ? 'No items match your search' : 'No items available'}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto"
      role="listbox"
      aria-label="Items"
      aria-multiselectable={multiselectable || undefined}
      aria-activedescendant={focusedId ? `selector-item-${focusedId}` : undefined}
      tabIndex={0}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetTop,
            left: 0,
            right: 0,
          }}
        >
          {visibleRows.map((row) => {
            if (row.type === 'header') {
              return (
                <div
                  key={`group-${row.group.key}`}
                  style={{ height: row.height }}
                  className="flex items-center"
                  role="button"
                  tabIndex={0}
                  aria-expanded={!collapsedGroups.has(row.group.key)}
                  aria-label={`${row.group.label} — ${row.group.items.length} items`}
                  onClick={() => onToggleGroup(row.group.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleGroup(row.group.key);
                    }
                  }}
                >
                  {renderGroupHeader(row.group)}
                </div>
              );
            }
            const selected = selectedIds.has(row.item.id);
            const focused = focusedId === row.item.id;
            return (
              <div
                key={row.item.id}
                id={`selector-item-${row.item.id}`}
                style={{ height: row.height }}
                className={`flex items-center cursor-pointer transition-colors ${focused ? 'bg-surface-hover' : ''}`}
                onClick={() => onToggleItem(row.item)}
                onMouseEnter={() => onFocusChange(row.item.id)}
                role="option"
                aria-selected={selected}
                data-item-id={row.item.id}
              >
                {renderItem(row.item, selected)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
