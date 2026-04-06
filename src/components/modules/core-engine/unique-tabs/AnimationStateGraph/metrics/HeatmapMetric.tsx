'use client';

import { HEATMAP_CELLS, HEATMAP_STATE_NAMES, ACCENT } from '../data';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';

const CELL_PX = 5;

function getCellValue(row: number, col: number): number {
  if (row === col) return 0;
  return HEATMAP_CELLS.find(c => c.row === row && c.col === col)?.value ?? 0;
}

export function HeatmapMetric() {
  const gridSize = HEATMAP_STATE_NAMES.length;
  return (
    <div className="flex justify-center">
      <svg width={gridSize * CELL_PX} height={gridSize * CELL_PX} aria-label="State transition heatmap">
        {Array.from({ length: gridSize }, (_, r) =>
          Array.from({ length: gridSize }, (_, c) => {
            const val = getCellValue(r, c);
            const opacity = r === c ? 0 : Math.max(0.08, val);
            return (
              <rect
                key={`${r}-${c}`}
                x={c * CELL_PX}
                y={r * CELL_PX}
                width={CELL_PX - 0.5}
                height={CELL_PX - 0.5}
                rx={0.5}
                fill={r === c ? withOpacity(ACCENT, OPACITY_10) : ACCENT}
                opacity={opacity}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
