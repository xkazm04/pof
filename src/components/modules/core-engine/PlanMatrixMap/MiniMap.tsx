'use client';

import { type CanvasLayout } from '@/lib/implementation-planner/layout-engine';
import {
  MODULE_COLORS,
  SURFACE_MINIMAP_CLUSTER_FILL,
  BORDER_DAG_NEUTRAL,
  OPACITY_5, OPACITY_30,
  withOpacity,
} from '@/lib/chart-colors';
import { MINIMAP_W, MINIMAP_H } from './constants';

export function MiniMap({
  layout,
  viewport,
  filterModuleId,
  onJump,
}: {
  layout: CanvasLayout;
  viewport: { x: number; y: number; w: number; h: number };
  filterModuleId: string;
  onJump: (worldX: number, worldY: number) => void;
}) {
  const { bounds, clusters } = layout;
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(MINIMAP_W / bw, MINIMAP_H / bh) * 0.85;

  const offsetX = (MINIMAP_W - bw * scale) / 2;
  const offsetY = (MINIMAP_H - bh * scale) / 2;

  return (
    <div
      className="absolute bottom-6 right-6 rounded-lg border border-border/50 bg-surface-deep/80 backdrop-blur-md overflow-hidden cursor-crosshair shadow-xl z-20"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left - offsetX;
        const my = e.clientY - rect.top - offsetY;
        onJump(bounds.minX + mx / scale, bounds.minY + my / scale);
      }}
    >
      {clusters.map((c) => (
        <div
          key={c.moduleId}
          className="absolute rounded-sm"
          style={{
            left: offsetX + (c.x - bounds.minX) * scale,
            top: offsetY + (c.y - bounds.minY) * scale,
            width: Math.max(4, c.width * scale),
            height: Math.max(4, c.height * scale),
            backgroundColor: filterModuleId === c.moduleId ? withOpacity(MODULE_COLORS.core, OPACITY_30) : SURFACE_MINIMAP_CLUSTER_FILL,
            border: `1px solid ${withOpacity(BORDER_DAG_NEUTRAL, OPACITY_30)}`,
          }}
        />
      ))}

      {/* Viewport rectangle */}
      <div
        className="absolute border border-blue-400/60 rounded-sm"
        style={{
          left: offsetX + (viewport.x - bounds.minX) * scale,
          top: offsetY + (viewport.y - bounds.minY) * scale,
          width: viewport.w * scale,
          height: viewport.h * scale,
          backgroundColor: withOpacity(MODULE_COLORS.core, OPACITY_5),
        }}
      />
    </div>
  );
}
