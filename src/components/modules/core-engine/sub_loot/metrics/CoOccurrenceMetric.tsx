'use client';

import { AFFIX_COOCCURRENCE_CELLS, AFFIX_COOCCURRENCE_ROWS, AFFIX_COOCCURRENCE_COLS, ACCENT } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import { AFFIX_HOT_THRESHOLD, type MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

const ROWS = AFFIX_COOCCURRENCE_ROWS.length;
const COLS = AFFIX_COOCCURRENCE_COLS.length;
const CELL_PX = 5;

function getCellValue(row: number, col: number): number {
  return AFFIX_COOCCURRENCE_CELLS.find(c => c.row === row && c.col === col)?.value ?? 0;
}

/** Hot-cell count comes from the view; the threshold is the view's one AFFIX_HOT_THRESHOLD. */
export function CoOccurrenceMetric({ reading }: { reading: MetricReading }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={COLS * CELL_PX} height={ROWS * CELL_PX} aria-hidden="true">
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const val = getCellValue(r, c);
            const isHot = val >= AFFIX_HOT_THRESHOLD;
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
      <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
        <span className="font-bold" style={{ color: ACCENT }}>{reading.value}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {reading.unit}</span>
      </div>
    </div>
  );
}
