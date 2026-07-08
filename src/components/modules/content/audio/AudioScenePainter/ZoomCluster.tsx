import { Plus, Minus } from 'lucide-react';
import { ZoomBtn } from './ZoomBtn';
import type { Viewport } from '@/lib/audio-scene-viewport';

export function ZoomCluster({ view, zoomIn, zoomOut, fitToContent, resetView }: {
  view: Viewport;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToContent: () => void;
  resetView: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5 rounded-lg bg-black/40 backdrop-blur-md border border-border px-1 py-0.5 font-mono text-2xs text-text">
      <span className="px-2 tabular-nums text-center select-none" style={{ minWidth: 46 }} aria-live="polite">
        {Math.round(view.zoom * 100)}%
      </span>
      <div className="w-px h-4 bg-border" />
      <ZoomBtn onClick={zoomOut} title="Zoom out (−)" ariaLabel="Zoom out"><Minus className="w-3.5 h-3.5" /></ZoomBtn>
      <ZoomBtn onClick={zoomIn} title="Zoom in (+)" ariaLabel="Zoom in"><Plus className="w-3.5 h-3.5" /></ZoomBtn>
      <div className="w-px h-4 bg-border" />
      <ZoomBtn onClick={fitToContent} title="Fit to content (F)" ariaLabel="Fit to content">fit</ZoomBtn>
      <ZoomBtn onClick={resetView} title="Reset to 100% (0)" ariaLabel="Reset zoom to 100%">1:1</ZoomBtn>
    </div>
  );
}
