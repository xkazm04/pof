'use client';

import { TREEMAP_DATA } from '../data';
import { withOpacity, OPACITY_25 } from '@/lib/chart-colors';

const W = 40;
const H = 30;

const total = TREEMAP_DATA.reduce((s, d) => s + d.probability, 0);

/** Pre-compute rect positions outside render to avoid mutable reassignment */
const RECTS = (() => {
  let x = 0;
  return TREEMAP_DATA.map((d) => {
    const w = (d.probability / total) * W;
    const rect = { x, w, name: d.name, probability: d.probability, color: d.color };
    x += w;
    return rect;
  });
})();

export function TreemapMetric() {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block rounded-sm">
      {RECTS.map((r) => (
        <rect
          key={r.name}
          x={r.x}
          y={0}
          width={r.w}
          height={H}
          fill={r.color}
          rx={1}
          style={{ filter: `drop-shadow(0 0 2px ${withOpacity(r.color, OPACITY_25)})` }}
        >
          <title>{r.name}: {r.probability}%</title>
        </rect>
      ))}
    </svg>
  );
}
