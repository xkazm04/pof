'use client';

import { Sparkles } from 'lucide-react';
import type { ConstellationNode } from '@/lib/constellation/layout';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_INFO, statusBg, statusBorder } from '@/lib/chart-colors';

// ── Recommended-next callout ───────────────────────────────────────────────

export function NextCallout({ node }: { node: ConstellationNode }) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: statusBg(STATUS_INFO, 0.12), border: `1px solid ${statusBorder(STATUS_INFO)}` }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: STATUS_INFO }}>Do this next</span>
            {node.dependentCount > 0 && (
              <span className="text-2xs text-text-muted">unblocks {node.dependentCount} downstream feature{node.dependentCount > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="text-sm font-medium text-text mt-0.5">{node.featureName}</div>
          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{node.description}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}
