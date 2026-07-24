'use client';

import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { ActorTickProfile } from '@/types/performance-profiling';

// ── Actor Tick Table ────────────────────────────────────────────────────────

/** Rows shown before the list is collapsed behind a "Show all" toggle. */
const TOP_N = 10;

export function ActorTickTable({ actors, budgetMs }: { actors: ActorTickProfile[]; budgetMs: number }) {
  const [showAll, setShowAll] = useState(false);

  if (actors.length === 0) return null;

  // Both producers (csv-parser, sample-generator) sort desc by totalTickMs,
  // so the leading slice really is the "top N".
  const isTruncated = actors.length > TOP_N && !showAll;
  const visible = isTruncated ? actors.slice(0, TOP_N) : actors;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-medium text-text">Actor Tick Costs</h2>
        <Badge>
          {isTruncated ? `Top ${TOP_N} of ${actors.length} classes` : `${actors.length} classes`}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {visible.map((actor) => {
          const barWidth = Math.min((actor.totalTickMs / (budgetMs * 0.5)) * 100, 100);
          const isHot = actor.totalTickMs > budgetMs * 0.1;
          return (
            <div key={actor.className} className="flex items-center gap-3">
              <span className="text-2xs text-cyan-400 font-mono w-40 truncate flex-shrink-0">{actor.className}</span>
              <span className="text-2xs text-text-muted w-12 flex-shrink-0 text-right">×{actor.instanceCount}</span>
              <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isHot ? 'bg-red-400/50' : 'bg-blue-400/40'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`text-2xs font-mono w-16 text-right flex-shrink-0 ${isHot ? 'text-red-400' : 'text-text-muted'}`}>
                {actor.totalTickMs.toFixed(2)}ms
              </span>
              <span className="text-2xs text-text-muted/60 w-10 flex-shrink-0 text-right">
                {actor.gameThreadPercent.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      {actors.length > TOP_N && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="focus-ring mt-2 text-2xs text-text-muted hover:text-text transition-colors"
        >
          {showAll ? `Show top ${TOP_N} only` : `Show all ${actors.length} classes`}
        </button>
      )}
    </SurfaceCard>
  );
}
