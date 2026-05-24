'use client';

import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TradingCard } from './TradingCard';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { ItemData } from '../_shared/data';
import type { ItemEntry } from '@/lib/catalog/types';

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
              <div key={item.id} onClick={() => setSelectedItem(prev => prev?.id === item.id ? null : item)} className="cursor-pointer">
                <TradingCard ref={(el: HTMLDivElement | null) => { cardRefs.current[index] = el; }}
                  item={item} tabIndex={index === focusedIndex ? 0 : -1} onFocus={() => setFocusedIndex(index)} />
                {/* folder-09 R3: lifecycle cell + (Re)generate for the primary item. */}
                <div className="mt-1 px-1" onClick={(e) => e.stopPropagation()}>
                  <CatalogLifecycleCell
                    lifecycle={entry?.lifecycle ?? 'planned'}
                    ueAssetCount={entry?.ueAssets?.length ?? 0}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-50">
          <Search className="w-12 h-12 mb-2.5" /><p className="text-sm">No items found matching the current filters.</p>
        </div>
      )}
    </div>
  );
}
