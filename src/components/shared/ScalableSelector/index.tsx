'use client';

import { X } from 'lucide-react';
import { Z_INDEX } from '@/lib/constants';
import {
  ACCENT_CYAN_LIGHT,
  OPACITY_10,
  OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import type { ScalableSelectorProps, SelectorItem } from './types';
import { SelectorSearch } from './SelectorSearch';
import { SelectorGroupHeader } from './SelectorGroup';
import { SelectorGrid } from './SelectorGrid';
import { MAX_VISIBLE_PILLS } from './constants';
import { useScalableSelector } from './useScalableSelector';

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
  const {
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
  } = useScalableSelector({
    items,
    groupBy,
    onSelect,
    selected,
    searchKey,
    mode,
    open,
    onClose,
  });

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
