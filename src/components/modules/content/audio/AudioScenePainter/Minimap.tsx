import { Volume2, Radio, Map as MapIcon } from 'lucide-react';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import { STATUS_INFO, withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { CHROME_ACCENT, EMITTER_COLORS, MINIMAP_W, MINIMAP_H } from './constants';
import { resolveZoneColor } from './helpers';
import type { MinimapModel } from './types';

export function Minimap({
  zones,
  emitters,
  showMinimap,
  setShowMinimap,
  minimapRef,
  handleMinimapDown,
  minimap,
  accentColor,
}: {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  minimapRef: React.RefObject<SVGSVGElement | null>;
  handleMinimapDown: (e: React.MouseEvent) => void;
  minimap: MinimapModel;
  accentColor: string;
}) {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      {/* Stats badge */}
      <div
        className="px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold text-text backdrop-blur-md flex items-center gap-3"
        style={{ borderColor: withOpacity(CHROME_ACCENT, OPACITY_30), backgroundColor: withOpacity(CHROME_ACCENT, OPACITY_10) }}
      >
        <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" style={{ color: CHROME_ACCENT }} /> {zones.length}</span>
        <span className="text-text-muted">/</span>
        <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-text-muted" /> {emitters.length}</span>
      </div>

      {/* Minimap — filled zone rects + emitter dots + a draggable viewport box */}
      {showMinimap ? (
        <div className="rounded-lg bg-black/40 backdrop-blur-md border border-border overflow-hidden">
          <div className="flex items-center justify-between pl-2 pr-1 py-0.5">
            <span className="flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-text-muted">
              <MapIcon className="w-3 h-3" /> map
            </span>
            <button
              onClick={() => setShowMinimap(false)}
              title="Hide minimap"
              aria-label="Hide minimap"
              className="px-1 text-text-muted hover:text-text text-xs leading-none focus-ring rounded"
            >
              ×
            </button>
          </div>
          <svg
            ref={minimapRef}
            width={MINIMAP_W}
            height={MINIMAP_H}
            className="block cursor-pointer"
            onMouseDown={handleMinimapDown}
            aria-label="Scene minimap — drag to navigate"
          >
            {zones.map((z) => {
              const isCircle = z.shape === 'circle';
              const left = isCircle ? z.x - z.width / 2 : z.x;
              const top = isCircle ? z.y - z.width / 2 : z.y;
              const w = z.width;
              const h = isCircle ? z.width : z.height;
              const color = resolveZoneColor(z);
              return (
                <rect
                  key={z.id}
                  x={minimap.proj.offsetX + left * minimap.proj.scale}
                  y={minimap.proj.offsetY + top * minimap.proj.scale}
                  width={Math.max(1, w * minimap.proj.scale)}
                  height={Math.max(1, h * minimap.proj.scale)}
                  rx={1}
                  fill={color}
                  fillOpacity={0.55}
                  stroke={color}
                  strokeOpacity={0.8}
                  strokeWidth={0.5}
                />
              );
            })}
            {emitters.map((em) => (
              <circle
                key={em.id}
                cx={minimap.proj.offsetX + em.x * minimap.proj.scale}
                cy={minimap.proj.offsetY + em.y * minimap.proj.scale}
                r={1.5}
                fill={EMITTER_COLORS[em.type] || STATUS_INFO}
              />
            ))}
            {/* Current viewport */}
            <rect
              x={minimap.proj.offsetX + minimap.vpRect.minX * minimap.proj.scale}
              y={minimap.proj.offsetY + minimap.vpRect.minY * minimap.proj.scale}
              width={Math.max(2, (minimap.vpRect.maxX - minimap.vpRect.minX) * minimap.proj.scale)}
              height={Math.max(2, (minimap.vpRect.maxY - minimap.vpRect.minY) * minimap.proj.scale)}
              fill={accentColor}
              fillOpacity={0.12}
              stroke={accentColor}
              strokeWidth={1}
              style={{ pointerEvents: 'none' }}
            />
          </svg>
        </div>
      ) : (
        <button
          onClick={() => setShowMinimap(true)}
          title="Show minimap"
          aria-label="Show minimap"
          className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md border border-border px-2 py-1 text-2xs font-mono uppercase tracking-widest text-text-muted hover:text-text focus-ring"
        >
          <MapIcon className="w-3 h-3" /> map
        </button>
      )}
    </div>
  );
}
