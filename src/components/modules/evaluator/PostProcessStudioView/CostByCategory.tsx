'use client';

import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { GPUBudgetReport, PPEffectCategory } from '@/types/post-process-studio';
import { CATEGORY_COLORS } from './constants';

// ── Cost By Category ────────────────────────────────────────────────────────

export function CostByCategory({ budget }: { budget: GPUBudgetReport }) {
  const categories = useMemo(() => {
    const map = new Map<PPEffectCategory, number>();
    for (const e of budget.effects) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.costMs);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cost]) => ({ category: cat, cost }));
  }, [budget.effects]);

  if (categories.length === 0) return null;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">By Category</h2>
      </div>
      <div className="space-y-2">
        {categories.map(({ category, cost }) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            <span className="text-2xs text-text-muted capitalize flex-1">{category}</span>
            <span className="text-2xs font-mono text-text-muted">{cost.toFixed(2)}ms</span>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
