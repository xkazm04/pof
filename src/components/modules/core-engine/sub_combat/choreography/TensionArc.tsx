'use client';

import { useMemo, useId } from 'react';
import {
  STATUS_ERROR, ACCENT_ORANGE, ACCENT_CYAN,
  withOpacity, OPACITY_8, OPACITY_25, OPACITY_50, OPACITY_60, GLOW_SM,
} from '@/lib/chart-colors';
import type { TensionCurve } from '@/lib/combat/tension-curve';
import { LANE_TENSION_H, BEAT_STYLES } from './types';

/**
 * The dramatic-arc overlay lane: a continuous tension curve (area + line, warm
 * at the peaks) with story-beat markers — climax, near-death, comeback,
 * breather — and translucent bands for ranged pacing defects (dead zones, flat
 * pacing). Sits at the top of the UnifiedTimeline. Extracted to keep
 * TimelineLanes.tsx under 200 LOC.
 */
export function TensionArc({
  curve, duration, totalWidth, pxPerSec,
}: {
  curve: TensionCurve;
  duration: number;
  totalWidth: number;
  pxPerSec: number;
}) {
  const gradId = useId();
  const h = LANE_TENSION_H;

  const { area, line } = useMemo(() => {
    const pts = curve.samples.map((s) => ({
      x: s.timeSec * pxPerSec,
      y: h - 2 - s.tension * (h - 6),
    }));
    if (pts.length === 0) return { area: '', line: '' };
    let l = '';
    for (let i = 0; i < pts.length; i++) l += (i === 0 ? 'M' : 'L') + `${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    const a = `${l}L${pts[pts.length - 1].x.toFixed(1)},${h}L${pts[0].x.toFixed(1)},${h}Z`;
    return { area: a, line: l };
  }, [curve.samples, pxPerSec, h]);

  return (
    <div className="relative bg-black/30 rounded border border-border/20" style={{ height: h }}>
      {/* second-grid backdrop */}
      {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
        <div key={i} className="absolute top-0 h-full border-l border-border/10" style={{ left: i * pxPerSec }} />
      ))}

      {/* ranged-beat bands (dead zone / flat pacing) sit under the curve */}
      {curve.beats.filter((b) => b.endTimeSec !== undefined).map((b, i) => {
        const x = b.timeSec * pxPerSec;
        const w = Math.max(2, ((b.endTimeSec ?? b.timeSec) - b.timeSec) * pxPerSec);
        const color = BEAT_STYLES[b.type].color;
        return (
          <div key={`band-${i}`} className="absolute top-0 h-full pointer-events-none" title={`${BEAT_STYLES[b.type].label}: ${b.detail}`}
            style={{ left: x, width: w, backgroundColor: withOpacity(color, OPACITY_8), borderLeft: `1px dashed ${withOpacity(color, OPACITY_50)}`, borderRight: `1px dashed ${withOpacity(color, OPACITY_50)}` }} />
        );
      })}

      <svg className="absolute inset-0" width={totalWidth} height={h} viewBox={`0 0 ${totalWidth} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={withOpacity(STATUS_ERROR, OPACITY_60)} />
            <stop offset="55%" stopColor={withOpacity(ACCENT_ORANGE, OPACITY_25)} />
            <stop offset="100%" stopColor={withOpacity(ACCENT_CYAN, OPACITY_8)} />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradId})`} stroke="none" />}
        {line && <path d={line} fill="none" stroke={ACCENT_ORANGE} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>

      {/* point-beat flags (climax / near-death / comeback / breather) */}
      {curve.beats.filter((b) => b.endTimeSec === undefined).map((b, i) => {
        const x = b.timeSec * pxPerSec;
        const color = BEAT_STYLES[b.type].color;
        return (
          <div key={`flag-${i}`} className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ left: x }}
            title={`${BEAT_STYLES[b.type].label} @ ${b.timeSec}s — ${b.detail}`}>
            <div className="w-px" style={{ height: h - 8, backgroundColor: withOpacity(color, OPACITY_50) }} />
            <div className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `${GLOW_SM} ${color}` }} />
          </div>
        );
      })}
    </div>
  );
}
