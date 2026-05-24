'use client';

import { type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ACCENT_EMERALD, STATUS_WARNING } from '@/lib/chart-colors';
import { RARITY_TIERS } from '../_shared/data';
import type { LootEditorEntryExpanded } from '../_shared/data';

interface EconomyImpactTableProps {
  pagedItems: LootEditorEntryExpanded[];
  totalWeight: number;
  economyProfile: 'casual' | 'hardcore';
  safePage: number;
  totalPages: number;
  setPage: Dispatch<SetStateAction<number>>;
}

export function EconomyImpactTable({
  pagedItems, totalWeight, economyProfile,
  safePage, totalPages, setPage,
}: EconomyImpactTableProps) {
  return (
    <>
      {/* Paginated impact table */}
      <div className="overflow-x-auto mb-2">
        <table className="w-full text-2xs font-mono">
          <thead>
            <tr className="text-text-muted border-b border-border/30">
              <th className="text-left py-1.5 pr-2">Item</th>
              <th className="text-left py-1.5 px-2">Rarity</th>
              <th className="text-left py-1.5 px-2">Source</th>
              <th className="text-right py-1.5 px-2">Weight</th>
              <th className="text-right py-1.5 px-2">Drop%</th>
              <th className="text-right py-1.5 pl-2">Gold Impact</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map(item => {
              const pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
              const tierColor = RARITY_TIERS.find(t => t.name === item.rarity)?.color ?? ACCENT_EMERALD;
              const goldBase = { Common: 5, Uncommon: 15, Rare: 50, Epic: 200, Legendary: 1000 }[item.rarity] ?? 5;
              const goldImpact = goldBase * (item.maxQuantity ?? 1) * (economyProfile === 'hardcore' ? 3 : 1);
              return (
                <tr key={item.id} className="border-t border-border/20 hover:bg-surface/30">
                  <td className="py-1 pr-2 text-text">{item.name}</td>
                  <td className="py-1 px-2" style={{ color: tierColor }}>{item.rarity}</td>
                  <td className="py-1 px-2 text-text-muted capitalize">{item.source}</td>
                  <td className="text-right py-1 px-2 text-text">{item.weight}</td>
                  <td className="text-right py-1 px-2 text-text-muted">{pct.toFixed(1)}%</td>
                  <td className="text-right py-1 pl-2" style={{ color: STATUS_WARNING }}>{goldImpact}g</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <span className="text-2xs font-mono text-text-muted">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      )}
    </>
  );
}
