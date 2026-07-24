import { Link2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';

interface GraphControlsProps {
  edgeCount: number;
  nodeCount: number;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

export function GraphControls({ edgeCount, nodeCount, zoom, setZoom }: GraphControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5" style={{ color: CHART_MODULE_COLORS.evaluator }} />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Cross-Module Dependencies
        </span>
        <span className="text-2xs text-text-muted">
          {edgeCount} connections across {nodeCount} modules
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          disabled={zoom <= 0.5}
          aria-label="Zoom out"
          className="focus-ring p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-2xs text-text-muted w-8 text-center" role="status" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          disabled={zoom >= 1.5}
          aria-label="Zoom in"
          className="focus-ring p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          aria-label="Reset zoom to 100%"
          className="focus-ring p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
