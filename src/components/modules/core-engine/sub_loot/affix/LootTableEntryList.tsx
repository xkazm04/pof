'use client';

import { Trash2 } from 'lucide-react';
import type { LootEditorEntryExpanded, LootSource } from '../_shared/data';
import { RarityDot } from '../_shared/rarityBadge';
import { LOOT_SOURCE_LABELS } from './loot-table-editor-constants';

interface LootTableEntryListProps {
  groupedEntries: { source: LootSource; entries: LootEditorEntryExpanded[] }[];
  sourceFilter: LootSource | 'all';
  editorTotalWeight: number;
  filteredEntries: LootEditorEntryExpanded[];
  onUpdateWeight: (id: string, weight: number) => void;
  onRemoveEntry: (id: string) => void;
}

export function LootTableEntryList({
  groupedEntries, sourceFilter, editorTotalWeight, filteredEntries,
  onUpdateWeight, onRemoveEntry,
}: LootTableEntryListProps) {
  return (
    <div className="space-y-3 mb-3">
      {groupedEntries.map(({ source, entries }) => (
        <div key={source}>
          {sourceFilter === 'all' && (
            <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5 sticky top-0 bg-surface/80 py-0.5 backdrop-blur-sm">
              {LOOT_SOURCE_LABELS[source]} ({entries.length})
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="mb-1.5">
              <div className="flex items-center gap-2">
                <RarityDot rarity={entry.rarity} />
                <span className="text-2xs text-text w-28 truncate" title={entry.name}>{entry.name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={entry.weight}
                  onChange={(e) => onUpdateWeight(entry.id, Number(e.target.value))}
                  aria-label={`Weight for ${entry.name}`}
                  className="flex-1 h-2 rounded-full appearance-none bg-surface-deep cursor-pointer focus-ring
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-[var(--thumb)] [&::-moz-range-thumb]:cursor-pointer"
                  style={{ ['--thumb' as string]: entry.color }}
                />
                {/* Raw authoring weight (arbitrary 0-100 magnitude, NOT a percentage). */}
                <span className="text-2xs font-mono w-14 text-right tabular-nums" style={{ color: entry.color }} title="Raw weight (relative magnitude)">
                  <span className="text-text-muted">wt</span> {entry.weight}
                </span>
                {/* Normalized drop probability across the visible table. */}
                <span className="text-2xs font-mono w-20 text-right tabular-nums text-text-muted" title="Share of total drop weight">
                  {editorTotalWeight > 0 ? ((entry.weight / editorTotalWeight) * 100).toFixed(1) : '0.0'}% <span className="opacity-60">share</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveEntry(entry.id)}
                  aria-label={`Remove ${entry.name}`}
                  title={`Remove ${entry.name}`}
                  className="flex-shrink-0 grid place-items-center w-6 h-6 rounded text-text-muted hover:text-red-400 hover:bg-surface-hover transition-colors cursor-pointer focus-ring"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {(entry.minQuantity !== undefined || entry.maxRarity !== undefined) && (
                <div className="flex items-center gap-3 ml-4 mt-0.5">
                  <span className="text-2xs text-text-muted font-mono">Qty {entry.minQuantity ?? 1}&ndash;{entry.maxQuantity ?? 1}</span>
                  <span className="text-2xs text-text-muted font-mono">Rarity {entry.minRarity ?? 'Common'}&ndash;{entry.maxRarity ?? 'Legendary'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {filteredEntries.length === 0 && (
        <p className="text-2xs text-text-muted italic text-center py-4">No items match your search.</p>
      )}
    </div>
  );
}
