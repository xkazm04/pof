'use client';

import { Cpu } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { ActorTickProfile } from '@/types/performance-profiling';

// ── Actor Tick Table ────────────────────────────────────────────────────────

export function ActorTickTable({ actors, budgetMs }: { actors: ActorTickProfile[]; budgetMs: number }) {
  if (actors.length === 0) return null;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-medium text-text">Actor Tick Costs</h2>
        <Badge>{actors.length} classes</Badge>
      </div>

      <div className="space-y-1.5">
        {actors.slice(0, 10).map((actor) => {
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
    </SurfaceCard>
  );
}
