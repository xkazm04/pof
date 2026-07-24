'use client';

import { Package, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TradingCard } from './TradingCard';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { ItemData } from '../_shared/data';
import type { ItemEntry } from '@/lib/catalog/types';

interface Props {
  gridRef: React.RefObject<HTMLDivElement | null>;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  /** zen-perf R3: the grid renders directly from store entries (each carries `data: ItemData`). */
  pageEntries: ItemEntry[];
  filteredCount: number;
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  setSelectedItem: React.Dispatch<React.SetStateAction<ItemData | null>>;
  /** Undefined when the catalog store is empty (no backing entry to generate). */
  primaryEntry: ItemEntry | undefined;
  isGenRunning: boolean;
  /** Undefined disables the (Re)generate affordance (no primary entry). */
  onRegenerate: (() => void) | undefined;
  onGridKeyDown: (e: React.KeyboardEvent) => void;
  /** True when any search/type/slot/rarity filter is narrowing the catalog. */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function CatalogItemGrid({
  gridRef, cardRefs, pageEntries, filteredCount,
  focusedIndex, setFocusedIndex, setSelectedItem,
  primaryEntry, isGenRunning, onRegenerate,
  onGridKeyDown, hasActiveFilters, onClearFilters,
}: Props) {
  return (
    <div className="relative min-h-[300px]">
      <motion.div ref={gridRef} layout role="grid" aria-label="Item catalog" onKeyDown={onGridKeyDown}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {pageEntries.map((entry, index) => {
            const item = entry.data;
            const isPrimary = entry.id === primaryEntry?.id;
            return (
              // `role="row"` keeps the grid/gridcell nesting valid — a `gridcell` may not sit
              // directly under `role="grid"`. `onActivate` gives the detail drawer a keyboard
              // route: the card swallows Enter/Space for its tooltip, so it was mouse-only.
              <div key={item.id} role="row" onClick={() => setSelectedItem(prev => prev?.id === item.id ? null : item)} className="cursor-pointer">
                <TradingCard ref={(el: HTMLDivElement | null) => { cardRefs.current[index] = el; }}
                  item={item} tabIndex={index === focusedIndex ? 0 : -1} onFocus={() => setFocusedIndex(index)}
                  onActivate={() => setSelectedItem(prev => prev?.id === item.id ? null : item)} />
                {/* folder-09 R3: lifecycle cell + (Re)generate for the primary item. */}
                <div role="gridcell" className="mt-1 px-1" onClick={(e) => e.stopPropagation()}>
                  <CatalogLifecycleCell
                    lifecycle={entry.lifecycle}
                    ueAssetCount={entry.ueAssets?.length ?? 0}
                    busy={isPrimary && isGenRunning}
                    onRegenerate={isPrimary ? onRegenerate : undefined}
                  />
                </div>
              </div>
            );
          })}
        </AnimatePresence>
      </motion.div>
      {filteredCount === 0 && (
        // Announced (role="status") and honest: an empty catalog is not the same as a
        // filtered-out one, and the filtered case offers the way out instead of a dead end.
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-text-muted">
          {hasActiveFilters
            ? <Search className="w-12 h-12 opacity-40" aria-hidden="true" />
            : <Package className="w-12 h-12 opacity-40" aria-hidden="true" />}
          <p className="text-sm">
            {hasActiveFilters ? 'No items match the current filters.' : 'No items in this catalog yet.'}
          </p>
          {hasActiveFilters ? (
            <button type="button" onClick={onClearFilters}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border/40 text-text hover:bg-surface-hover transition-colors cursor-pointer">
              Clear filters
            </button>
          ) : (
            <p className="text-xs">Use &ldquo;Add Item&rdquo; above to create the first one.</p>
          )}
        </div>
      )}
    </div>
  );
}
