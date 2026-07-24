'use client';

import { useState } from 'react';
import { MemoryStick } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { MemoryAllocation } from '@/types/performance-profiling';

// ── Memory Chart ────────────────────────────────────────────────────────────

/** Rows shown before the list is collapsed behind a "Show all" toggle. */
const TOP_N = 10;

export function MemoryChart({ allocations }: { allocations: MemoryAllocation[] }) {
  const [showAll, setShowAll] = useState(false);

  if (allocations.length === 0) return null;

  const sorted = [...allocations].sort((a, b) => b.currentMB - a.currentMB);
  const maxMB = Math.max(...sorted.map((a) => a.peakMB), 1);
  const totalMB = sorted.reduce((s, a) => s + a.currentMB, 0);
  const isTruncated = sorted.length > TOP_N && !showAll;
  const visible = isTruncated ? sorted.slice(0, TOP_N) : sorted;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <MemoryStick className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-medium text-text">Memory Breakdown</h2>
        {/* Total spans every category — say so, since the list may show only the top N. */}
        <Badge>{totalMB.toFixed(0)}MB across {sorted.length} categories</Badge>
        {isTruncated && (
          <span className="text-2xs text-text-muted">showing top {TOP_N}</span>
        )}
      </div>

      <div className="space-y-1.5">
        {visible.map((alloc) => {
          const currentW = (alloc.currentMB / maxMB) * 100;
          const peakW = (alloc.peakMB / maxMB) * 100;
          return (
            <div key={alloc.category} className="flex items-center gap-3">
              <span className="text-2xs text-text-muted w-36 truncate flex-shrink-0">{alloc.category}</span>
              <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden relative">
                <div
                  className="absolute h-full bg-emerald-400/15 rounded"
                  style={{ width: `${peakW}%` }}
                />
                <div
                  className="h-full bg-emerald-400/40 rounded relative z-10"
                  style={{ width: `${currentW}%` }}
                />
              </div>
              <span className="text-2xs font-mono text-text-muted w-20 text-right flex-shrink-0">
                {alloc.currentMB.toFixed(0)}MB
              </span>
            </div>
          );
        })}
      </div>

      {sorted.length > TOP_N && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="focus-ring mt-2 text-2xs text-text-muted hover:text-text transition-colors"
        >
          {showAll ? `Show top ${TOP_N} only` : `Show all ${sorted.length} categories`}
        </button>
      )}
    </SurfaceCard>
  );
}
