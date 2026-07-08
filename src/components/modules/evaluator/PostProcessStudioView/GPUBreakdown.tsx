'use client';

import { Cpu, AlertTriangle } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { GPUBudgetReport } from '@/types/post-process-studio';
import { CATEGORY_COLORS, ACCENT } from './constants';

// ── GPU Breakdown ───────────────────────────────────────────────────────────

export function GPUBreakdown({ budget }: { budget: GPUBudgetReport }) {
  const sortedEffects = [...budget.effects].sort((a, b) => b.costMs - a.costMs);
  const maxCost = Math.max(...sortedEffects.map((e) => e.costMs), 0.01);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-medium text-text">GPU Cost</h2>
        <span className="text-2xs text-text-muted">@ {budget.resolution}</span>
      </div>

      {sortedEffects.length === 0 ? (
        <p className="text-2xs text-text-muted">No effects enabled</p>
      ) : (
        <div className="space-y-1.5">
          {sortedEffects.map((e) => {
            const w = (e.costMs / maxCost) * 100;
            const catColor = CATEGORY_COLORS[e.category] ?? ACCENT;
            const isExpensive = e.costMs > budget.budgetMs * 0.3;
            return (
              <div key={e.effectId} className="flex items-center gap-2">
                <span className={`text-2xs w-24 truncate flex-shrink-0 ${isExpensive ? 'text-amber-400' : 'text-text-muted'}`}>
                  {e.effectName}
                </span>
                <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-base"
                    style={{ width: `${w}%`, backgroundColor: `${catColor}60` }}
                  />
                </div>
                <span className={`text-2xs font-mono w-12 text-right flex-shrink-0 ${isExpensive ? 'text-amber-400' : 'text-text-muted'}`}>
                  {e.costMs.toFixed(2)}ms
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1.5 border-t border-border">
            <span className="text-2xs font-medium text-text w-24 flex-shrink-0">Total</span>
            <div className="flex-1" />
            <span className={`text-xs font-mono font-semibold ${budget.overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
              {budget.totalCostMs.toFixed(2)}ms
            </span>
          </div>
        </div>
      )}

      {budget.overBudget && (
        <div className="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-2xs text-red-300">
            PP stack exceeds {budget.budgetMs}ms budget for {budget.resolution}. Consider disabling expensive effects or reducing quality.
          </span>
        </div>
      )}
    </SurfaceCard>
  );
}
