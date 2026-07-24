'use client';

import { ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_40, OPACITY_60 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';

/**
 * The loot pipeline, in order. These names used to live in a trailing comment
 * next to a hardcoded `5`, so the diagram and the copy could silently drift —
 * the count and the tooltip now both derive from this one list.
 */
const PIPELINE_STAGES = ['LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory'] as const;
const STAGE_COUNT = PIPELINE_STAGES.length;
const FLOW_LABEL = PIPELINE_STAGES.join(' → ');

const DOT_R = 2;
const SPACING = 8;
const SVG_W = (STAGE_COUNT - 1) * SPACING + DOT_R * 2;
const SVG_H = DOT_R * 2 + 2;

export function PipelineMetric() {
  return (
    // `title` sits on the wrapper, not on each dot: the dots are 4px targets, so
    // per-dot tooltips were effectively unhittable — and they only said "Stage 3",
    // which names nothing. One hover anywhere on the metric now reveals the actual
    // flow. This mirrors FeatureCard's own `title` affordance on truncated copy;
    // it's supplementary detail, so the visible "5 stages" stays the text AT reads.
    <div className="flex items-center gap-1.5" title={FLOW_LABEL}>
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} aria-hidden="true">
        {PIPELINE_STAGES.map((stage, i) => {
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
      {/* Count + unit = dense metadata, so TEXT_SCALE.meta (the 10px token) rather
          than a raw `text-[10px]` literal off the scale. */}
      <div className={`${TEXT_SCALE.meta} font-mono leading-tight`}>
        <span className="font-bold" style={{ color: ACCENT }}>{STAGE_COUNT}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_60) }}> stages</span>
      </div>
    </div>
  );
}
