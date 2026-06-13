'use client';

import { memo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TradingCard } from './TradingCard';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { ItemData } from '../_shared/data';
import type { ItemEntry, LifecycleState } from '@/lib/catalog/types';

interface Props {
  gridRef: React.RefObject<HTMLDivElement | null>;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  pageItems: ItemData[];
  filteredCount: number;
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  setSelectedItem: React.Dispatch<React.SetStateAction<ItemData | null>>;
  entryByItemId: Map<string, ItemEntry>;
  primaryEntry: ItemEntry;
  isGenRunning: boolean;
  onRegenerate: () => void;
  onGridKeyDown: (e: React.KeyboardEvent) => void;
}

/* ── Per-cell wrapper ────────────────────────────────────────────────────
 * Extracted + memoized so the heavy `TradingCard` only re-renders when this
 * cell's own inputs change. All function/ref props it builds are stabilized
 * with `useCallback` against the parent's stable setters/refs (`cardRefs`,
 * `setFocusedIndex`, `setSelectedItem` are stable React state setters / ref
 * objects), so a parent re-render driven by an unrelated keystroke does NOT
 * change this cell's `onClick`/`onFocus`/`ref` identities. The card thus skips
 * its layout/spring re-evaluation unless `isFocused` (its roving `tabIndex`),
 * `item`, or its lifecycle/primary inputs actually change.
 */
interface CellProps {
  item: ItemData;
  index: number;
  isFocused: boolean;
  isPrimary: boolean;
  lifecycle: LifecycleState;
  ueAssetCount: number;
  isGenRunning: boolean;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  setFocusedIndex: (i: number) => void;
  setSelectedItem: React.Dispatch<React.SetStateAction<ItemData | null>>;
  onRegenerate: () => void;
}

const CatalogGridCell = memo(function CatalogGridCell({
  item, index, isFocused, isPrimary, lifecycle, ueAssetCount,
  isGenRunning, cardRefs, setFocusedIndex, setSelectedItem, onRegenerate,
}: CellProps) {
  const setCardRef = useCallback(
    (el: HTMLDivElement | null) => { cardRefs.current[index] = el; },
    [cardRefs, index],
  );
  const handleFocus = useCallback(
    () => setFocusedIndex(index),
    [setFocusedIndex, index],
  );
  const handleClick = useCallback(
    () => setSelectedItem(prev => (prev?.id === item.id ? null : item)),
    [setSelectedItem, item],
  );
  const stopClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div onClick={handleClick} className="cursor-pointer">
      <TradingCard ref={setCardRef} item={item} tabIndex={isFocused ? 0 : -1} onFocus={handleFocus} />
      {/* folder-09 R3: lifecycle cell + (Re)generate for the primary item. */}
      <div className="mt-1 px-1" onClick={stopClick}>
        <CatalogLifecycleCell
          lifecycle={lifecycle}
          ueAssetCount={ueAssetCount}
          busy={isPrimary && isGenRunning}
          onRegenerate={isPrimary ? onRegenerate : undefined}
        />
      </div>
    </div>
  );
});

export function CatalogItemGrid({
  gridRef, cardRefs, pageItems, filteredCount,
  focusedIndex, setFocusedIndex, setSelectedItem,
  entryByItemId, primaryEntry, isGenRunning, onRegenerate,
  onGridKeyDown,
}: Props) {
  return (
    <div className="relative min-h-[300px]">
      <motion.div ref={gridRef} layout role="grid" aria-label="Item catalog" onKeyDown={onGridKeyDown}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {pageItems.map((item, index) => {
            const entry = entryByItemId.get(item.id);
            const isPrimary = !!entry && entry.id === primaryEntry?.id;
            return (
              <CatalogGridCell
                key={item.id}
                item={item}
                index={index}
                isFocused={index === focusedIndex}
                isPrimary={isPrimary}
                lifecycle={entry?.lifecycle ?? 'planned'}
                ueAssetCount={entry?.ueAssets?.length ?? 0}
                isGenRunning={isGenRunning}
                cardRefs={cardRefs}
                setFocusedIndex={setFocusedIndex}
                setSelectedItem={setSelectedItem}
                onRegenerate={onRegenerate}
              />
            );
          })}
        </AnimatePresence>
      </motion.div>
      {filteredCount === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-50">
          <Search className="w-12 h-12 mb-2.5" /><p className="text-sm">No items found matching the current filters.</p>
        </div>
      )}
    </div>
  );
}
