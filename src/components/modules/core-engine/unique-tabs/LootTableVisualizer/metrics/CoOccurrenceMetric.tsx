'use client';

import { AFFIX_COOCCURRENCE_CELLS, AFFIX_COOCCURRENCE_ROWS, AFFIX_COOCCURRENCE_COLS, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

/** Count cells with value >= 0.7 as "hot" co-occurrence conflicts */
const HOT_THRESHOLD = 0.7;
const hotCount = AFFIX_COOCCURRENCE_CELLS.filter(c => c.value >= HOT_THRESHOLD).length;

const ROWS = AFFIX_COOCCURRENCE_ROWS.length;
const COLS = AFFIX_COOCCURRENCE_COLS.length;
const CELL_PX = 5;

function getCellValue(row: number, col: number): number {
  return AFFIX_COOCCURRENCE_CELLS.find(c => c.row === row && c.col === col)?.value ?? 0;
}

export function CoOccurrenceMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={COLS * CELL_PX} height={ROWS * CELL_PX} aria-hidden="true">
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const val = getCellValue(r, c);
            const isHot = val >= HOT_THRESHOLD;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * CELL_PX}
                y={r * CELL_PX}
                width={CELL_PX - 0.5}
                height={CELL_PX - 0.5}
                rx={0.5}
                fill={ACCENT}
                opacity={isHot ? 0.9 : Math.max(0.08, val * 0.6)}
              >
                <title>{AFFIX_COOCCURRENCE_ROWS[r]} × {AFFIX_COOCCURRENCE_COLS[c]}: {(val * 100).toFixed(0)}%</title>
              </rect>
            );
          }),
        )}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{hotCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> hot cells</span>
      </div>
    </div>
  );
}
