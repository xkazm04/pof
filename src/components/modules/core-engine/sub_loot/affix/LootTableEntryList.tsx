'use client';

import { STATUS_ERROR } from '@/lib/chart-colors';
import type { LootEditorEntryExpanded, LootSource } from '../_shared/data';
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
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-2xs text-text w-28 truncate" title={entry.name}>{entry.name}</span>
                <input type="range" min={0} max={100} value={entry.weight} onChange={(e) => onUpdateWeight(entry.id, Number(e.target.value))} className="flex-1 h-1 accent-orange-500" />
                <span className="text-2xs font-mono w-8 text-right" style={{ color: entry.color }}>{entry.weight}%</span>
                <span className="text-2xs font-mono w-14 text-right text-text-muted">({editorTotalWeight > 0 ? ((entry.weight / editorTotalWeight) * 100).toFixed(1) : '0.0'}%)</span>
                <button onClick={() => onRemoveEntry(entry.id)} className="text-2xs text-text-muted transition-colors px-1 cursor-pointer" onMouseEnter={e => (e.currentTarget.style.color = STATUS_ERROR)} onMouseLeave={e => (e.currentTarget.style.color = '')}>x</button>
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
