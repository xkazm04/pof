'use client';

import { useEffect, useRef } from 'react';
import { Boxes, Share2, Grid3X3, Hash, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { PreviewResult } from '@/lib/level-design/procgen-preview';
import {
  OVERLAY_BLACK, STATUS_LOCKED, ACCENT_VIOLET, ACCENT_INDIGO, STATUS_WARNING,
  STATUS_SUCCESS, STATUS_ERROR,
} from '@/lib/chart-colors';

/** Cell → swatch, sourced from chart-colors tokens (no hardcoded hex). */
const CELL_COLORS: Record<CellType, string> = {
  empty: OVERLAY_BLACK,
  wall: STATUS_LOCKED,
  floor: ACCENT_VIOLET,
  corridor: ACCENT_INDIGO,
  door: STATUS_WARNING,
};

const LEGEND: { cell: CellType; label: string }[] = [
  { cell: 'floor', label: 'Floor' },
  { cell: 'corridor', label: 'Corridor' },
  { cell: 'door', label: 'Door' },
  { cell: 'wall', label: 'Wall' },
];

function connectivityColor(c: number): string {
  return c >= 0.95 ? STATUS_SUCCESS : c >= 0.8 ? STATUS_WARNING : STATUS_ERROR;
}

interface ProcgenPreviewCanvasProps {
  result: PreviewResult;
  /** Raw seed text shown to the designer (resolved value lives in result.seedValue). */
  seedLabel?: string;
}

/**
 * Renders a {@link PreviewResult} grid to a 1px-per-cell canvas (CSS-scaled,
 * pixelated) with layout stats + a legend. Pure presentation — the grid is
 * generated upstream from the same FRandomStream seed the UE codegen targets.
 */
export function ProcgenPreviewCanvas({ result, seedLabel }: ProcgenPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { grid, width, height, stats } = result;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — stats still render.
    canvas.width = width;
    canvas.height = height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = CELL_COLORS[grid[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid, width, height]);

  const connPct = Math.round(stats.connectivity * 100);
  const floorPct = Math.round(stats.floorRatio * 100);
  const fullyConnected = stats.regions <= 1;
  const ariaLabel =
    `Procedural layout preview: ${stats.roomCount} rooms, ${connPct}% connected, ${width} by ${height} cells`;

  return (
    <div className="space-y-3" data-testid="procgen-preview">
      <div className="relative rounded-xl overflow-hidden border border-violet-900/40 bg-black/60">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel}
          data-testid="procgen-preview-canvas"
          data-width={width}
          data-height={height}
          className="w-full block"
          style={{ aspectRatio: `${width} / ${height}`, imageRendering: 'pixelated' }}
        />
        {result.scale < 1 && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-violet-300/80 text-[10px] font-mono tracking-wider">
            {Math.round(result.scale * 100)}% scale
          </span>
        )}
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="procgen-preview-stats">
        <StatChip icon={Boxes} label="Rooms" value={String(stats.roomCount)} color={ACCENT_VIOLET} />
        <StatChip
          icon={Share2}
          label="Connectivity"
          value={`${connPct}%`}
          color={connectivityColor(stats.connectivity)}
        />
        <StatChip icon={Grid3X3} label="Floor" value={`${floorPct}%`} color={ACCENT_INDIGO} />
        <StatChip icon={Hash} label="Size" value={`${width}×${height}`} color={STATUS_LOCKED} />
      </div>

      {/* Connectivity verdict — the key signal designers need before dispatching */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono"
        style={{
          borderColor: `${fullyConnected ? STATUS_SUCCESS : connectivityColor(stats.connectivity)}40`,
          backgroundColor: `${fullyConnected ? STATUS_SUCCESS : connectivityColor(stats.connectivity)}12`,
          color: fullyConnected ? STATUS_SUCCESS : connectivityColor(stats.connectivity),
        }}
        data-testid="procgen-preview-verdict"
      >
        {fullyConnected ? (
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        )}
        <span>
          {fullyConnected
            ? `Fully connected — ${connPct}% of floor reachable in one region.`
            : `${stats.regions} disconnected regions — largest holds ${connPct}% of floor. Tweak params or reseed.`}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="procgen-preview-legend">
        {LEGEND.map(({ cell, label }) => (
          <span key={cell} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300/70">
            <span className="w-2.5 h-2.5 rounded-sm border border-white/10" style={{ backgroundColor: CELL_COLORS[cell] }} />
            {label}
          </span>
        ))}
        {seedLabel !== undefined && (
          <span className="ml-auto text-[10px] font-mono text-violet-400/60">
            seed: {seedLabel.trim() === '' ? `${result.seedValue} (default)` : seedLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon, label, value, color,
}: { icon: typeof Boxes; label: string; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/40 border border-violet-900/30"
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-widest text-violet-400/60 leading-none">{label}</div>
        <div className="text-xs font-mono font-bold leading-tight mt-0.5" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}
