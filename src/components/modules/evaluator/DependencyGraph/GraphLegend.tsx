import { Plug } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_BLOCKER, OPACITY_12 } from '@/lib/chart-colors';

interface GraphLegendProps {
  bridgeConnected: boolean;
  manifestCrossRefs: Map<string, Set<string>>;
}

export function GraphLegend({ bridgeConnected, manifestCrossRefs }: GraphLegendProps) {
  return (
    <div className="flex items-center gap-4 text-2xs text-text-muted">
      <span className="flex items-center gap-1.5">
        <span className="w-6 h-px" style={{ backgroundColor: 'var(--text-muted)' }} />
        Dependency
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-6 border-t border-dashed" style={{ borderColor: STATUS_BLOCKER }} />
        Has blockers
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-2xs font-bold"
          style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_12}`, color: STATUS_BLOCKER }}
        >!</span>
        Module has blocked features
      </span>
      {bridgeConnected && manifestCrossRefs.size > 0 && (
        <span className="flex items-center gap-1.5">
          <Plug className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
          <span style={{ color: STATUS_SUCCESS }}>{manifestCrossRefs.size} bridge assets with cross-refs</span>
        </span>
      )}
    </div>
  );
}
