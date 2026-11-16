'use client';

import { ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_40, OPACITY_60 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { LOOT_PIPELINE_STAGES, type MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/**
 * The loot pipeline, in order. The stage list lives in the view (LOOT_PIPELINE_STAGES):
 * the dots are drawn from it and the printed count + flow tooltip are the view's
 * reading, so the diagram and the copy cannot drift.
 */
const STAGE_COUNT = LOOT_PIPELINE_STAGES.length;

const DOT_R = 2;
const SPACING = 8;
const SVG_W = (STAGE_COUNT - 1) * SPACING + DOT_R * 2;
const SVG_H = DOT_R * 2 + 2;

export function PipelineMetric({ reading }: { reading: MetricReading }) {
  return (
    // No `title` here: the per-dot tooltips were unhittable 4px targets, and a wrapper
    // title would shadow the Feature Map's fixture tooltip (metrics/index.tsx), which
    // already shows the reading's detail - the stage flow - plus "sample data".
    <div className="flex items-center gap-1.5">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} aria-hidden="true">
        {LOOT_PIPELINE_STAGES.map((stage, i) => {
          const cx = DOT_R + i * SPACING;
          const cy = SVG_H / 2;
          return (
            <g key={stage}>
              <circle cx={cx} cy={cy} r={DOT_R} fill={ACCENT} />
              {i < STAGE_COUNT - 1 && (
                <line
                  x1={cx + DOT_R + 0.5}
                  y1={cy}
                  x2={cx + SPACING - DOT_R - 0.5}
                  y2={cy}
                  // 40% rather than the deprecated 30%: FeatureCard desaturates an
                  // inactive card's metric, which pushed the connectors to invisible
                  // and left the diagram reading as loose dots instead of a flow.
                  stroke={withOpacity(ACCENT, OPACITY_40)}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
        <span className="font-bold" style={{ color: ACCENT }}>{reading.value ?? '?'}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_60) }}> {reading.unit}</span>
      </div>
    </div>
  );
}
