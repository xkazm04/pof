'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SupplyDemandPoint, ItemCategory } from '@/types/economy-simulator';
import { CATEGORY_COLORS } from './constants';
import { formatGold } from './helpers';

// ── Supply/Demand Section ───────────────────────────────────────────────────

export function SupplyDemandSection({ data, maxLevel }: { data: SupplyDemandPoint[]; maxLevel: number }) {
  const [selectedCat, setSelectedCat] = useState<ItemCategory>('weapon');

  const categories: ItemCategory[] = ['weapon', 'armor', 'consumable', 'material', 'gem'];
  const filtered = useMemo(() =>
    data.filter((d) => d.category === selectedCat),
    [data, selectedCat],
  );

  if (data.length === 0) return null;

  const maxRate = Math.max(...filtered.map((d) => Math.max(d.supplyRate, d.demandRate)), 1);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Supply / Demand per Item Category</h2>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
              selectedCat === cat
                ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                : 'border-border text-text-muted bg-surface hover:text-text'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
            {cat}
          </button>
        ))}
      </div>

      {/* Chart */}
      <p className="sr-only">
        Supply versus demand for {selectedCat} across {filtered.length} levels. Each bar pair is
        focusable for that level&apos;s supply rate, demand rate, average price and affordability.
      </p>
      <div className="flex items-end gap-1 h-28" role="group" aria-label={`Supply and demand per level for ${selectedCat}`}>
        {filtered.map((d, i) => {
          const supH = (d.supplyRate / maxRate) * 100;
          const demH = (d.demandRate / maxRate) * 100;
          return (
            <div
              key={i}
              tabIndex={0}
              role="img"
              aria-label={`Level ${d.level}: supply ${d.supplyRate} per hour, demand ${d.demandRate} per hour, average price ${formatGold(d.avgPrice)}, affordability ${d.affordabilityIndex.toFixed(2)}`}
              className="flex-1 flex gap-px items-end group relative focus-ring rounded-sm"
            >
              <div className="absolute bottom-full mb-1 hidden group-hover:block group-focus-within:block z-10 left-1/2 -translate-x-1/2">
                <div className="bg-surface-deep border border-border rounded px-2 py-1 text-2xs whitespace-nowrap shadow-lg">
                  <div className="text-text-muted">Level {d.level}</div>
                  <div className="text-emerald-400">Supply: {d.supplyRate}/hr</div>
                  <div className="text-orange-400">Demand: {d.demandRate}/hr</div>
                  <div className="text-text-muted">Avg Price: {formatGold(d.avgPrice)}</div>
                  <div className="text-text-muted">Afford: {d.affordabilityIndex.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex-1 bg-emerald-400/40 rounded-t-sm" style={{ height: `${supH}%` }} />
              <div className="flex-1 bg-orange-400/40 rounded-t-sm" style={{ height: `${demH}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
        <span>Lvl 1</span>
        <span>Lvl {maxLevel}</span>
      </div>
      <div className="flex items-center gap-3 text-2xs text-text-muted mt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Supply</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Demand</span>
      </div>
    </SurfaceCard>
  );
}
