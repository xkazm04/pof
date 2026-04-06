'use client';

import { ACCENT } from '../data';
import { withOpacity, OPACITY_30, OPACITY_50 } from '@/lib/chart-colors';

const PIPELINE_STAGES = 5; // LootTable → WeightedRandom → WorldItem → Pickup → Inventory
const DOT_R = 2;
const SPACING = 8;
const SVG_W = (PIPELINE_STAGES - 1) * SPACING + DOT_R * 2;
const SVG_H = DOT_R * 2 + 2;

export function PipelineMetric() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} aria-hidden="true">
        {Array.from({ length: PIPELINE_STAGES }, (_, i) => {
          const cx = DOT_R + i * SPACING;
          const cy = SVG_H / 2;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={DOT_R} fill={ACCENT}>
                <title>Stage {i + 1}</title>
              </circle>
              {i < PIPELINE_STAGES - 1 && (
                <line
                  x1={cx + DOT_R + 0.5}
                  y1={cy}
                  x2={cx + SPACING - DOT_R - 0.5}
                  y2={cy}
                  stroke={withOpacity(ACCENT, OPACITY_30)}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{PIPELINE_STAGES}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> stages</span>
      </div>
    </div>
  );
}
