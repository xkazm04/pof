'use client';

import { useMemo } from 'react';
import { Activity, AlertTriangle, MoonStar } from 'lucide-react';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_EMERALD, ACCENT_VIOLET,
  OPACITY_10, OPACITY_20, OPACITY_40,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { formatPlaytime, type PlaytimePathMode } from '../_shared/data';
import {
  buildInterestPoints, detectPacingRegions,
  GRIND_THRESHOLD, DEAD_THRESHOLD,
} from './playtime-target';

interface Props {
  mode: PlaytimePathMode;
}

const W = 560;
const H = 200;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 28;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function InterestCurveChart({ mode }: Props) {
  const points = useMemo(() => buildInterestPoints(mode), [mode]);
  const regions = useMemo(() => detectPacingRegions(points), [points]);

  if (points.length === 0) {
    return (
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <SectionHeader icon={Activity} label="Tension / Interest Curve" color={ACCENT_VIOLET} />
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center py-6 opacity-60">
          No zones on the current path.
        </div>
      </BlueprintPanel>
    );
  }

  const maxT = points[points.length - 1].cumulativeSec || 1;
  const xFor = (sec: number) => PAD_L + (sec / maxT) * PLOT_W;
  const yFor = (intensity: number) => PAD_T + (1 - intensity) * PLOT_H;

  const polyline = points.map(p => `${xFor(p.cumulativeSec).toFixed(1)},${yFor(p.intensity).toFixed(1)}`).join(' ');
  // Closed area under the curve, for fill
  const areaPath = `M ${xFor(points[0].cumulativeSec).toFixed(1)},${yFor(0).toFixed(1)} ` +
    points.map(p => `L ${xFor(p.cumulativeSec).toFixed(1)},${yFor(p.intensity).toFixed(1)}`).join(' ') +
    ` L ${xFor(points[points.length - 1].cumulativeSec).toFixed(1)},${yFor(0).toFixed(1)} Z`;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * maxT);

  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <SectionHeader icon={Activity} label="Tension / Interest Curve" color={ACCENT_VIOLET} />

      <div className="bg-surface-deep/30 rounded-lg p-2">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible" role="img" aria-label="Interest curve across critical path">
          {/* Grind / dead threshold bands */}
          <rect
            x={PAD_L} y={yFor(1)}
            width={PLOT_W} height={yFor(GRIND_THRESHOLD) - yFor(1)}
            fill={withOpacity(STATUS_ERROR, OPACITY_10)}
          />
          <rect
            x={PAD_L} y={yFor(DEAD_THRESHOLD)}
            width={PLOT_W} height={yFor(0) - yFor(DEAD_THRESHOLD)}
            fill={withOpacity(STATUS_WARNING, OPACITY_10)}
          />
          {/* Y gridlines + labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <g key={`yg-${t}`}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} stroke={withOpacity(ACCENT_VIOLET, OPACITY_10)} strokeWidth={0.5} />
              <text x={PAD_L - 6} y={yFor(t) + 3} textAnchor="end" className="text-[9px] font-mono fill-text-muted">{(t * 100).toFixed(0)}</text>
            </g>
          ))}

          {/* Region shading + labels */}
          {regions.map((r, i) => {
            const x1 = xFor(points[r.fromIdx].cumulativeSec);
            const x2 = xFor(points[r.toIdx].cumulativeSec);
            const c = r.kind === 'grind' ? STATUS_ERROR : STATUS_WARNING;
            return (
              <g key={`rg-${i}`}>
                <rect
                  x={x1} y={PAD_T}
                  width={Math.max(2, x2 - x1)} height={PLOT_H}
                  fill={withOpacity(c, OPACITY_20)}
                  stroke={withOpacity(c, OPACITY_40)} strokeDasharray="3 3"
                />
                <text
                  x={(x1 + x2) / 2} y={PAD_T + 10}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-bold uppercase tracking-[0.15em]"
                  fill={c}
                >
                  {r.kind === 'grind' ? 'Grind wall' : 'Dead spot'}
                </text>
              </g>
            );
          })}

          {/* Curve area + line */}
          <path d={areaPath} fill={withOpacity(ACCENT_VIOLET, OPACITY_20)} />
          <polyline
            points={polyline}
            fill="none"
            stroke={ACCENT_VIOLET}
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 4px ${withOpacity(ACCENT_VIOLET, OPACITY_40)})` }}
          />

          {/* Zone dots */}
          {points.map(p => {
            const c =
              p.band === 'grind' ? STATUS_ERROR
              : p.band === 'dead' ? STATUS_WARNING
              : ACCENT_EMERALD;
            return (
              <g key={`dot-${p.zoneId}`}>
                <circle
                  cx={xFor(p.cumulativeSec)} cy={yFor(p.intensity)} r={4}
                  fill={c} stroke={ACCENT_VIOLET} strokeWidth={1}
                />
                <title>
                  {p.zoneName}: intensity {(p.intensity * 100).toFixed(0)} · at {formatPlaytime(p.cumulativeSec)}
                </title>
              </g>
            );
          })}

          {/* X ticks */}
          {ticks.map((t, i) => (
            <g key={`xt-${i}`}>
              <line x1={xFor(t)} x2={xFor(t)} y1={H - PAD_B} y2={H - PAD_B + 4} stroke={withOpacity(ACCENT_VIOLET, OPACITY_20)} strokeWidth={1} />
              <text x={xFor(t)} y={H - PAD_B + 14} textAnchor="middle" className="text-[9px] font-mono fill-text-muted">{formatPlaytime(t)}</text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={PAD_L} y={H - 4}
            className="text-[9px] font-mono uppercase tracking-[0.15em] fill-text-muted"
          >
            cumulative time →
          </text>
          <text
            x={2} y={PAD_T + PLOT_H / 2}
            transform={`rotate(-90 6 ${PAD_T + PLOT_H / 2})`}
            className="text-[9px] font-mono uppercase tracking-[0.15em] fill-text-muted"
          >
            intensity %
          </text>
        </svg>
      </div>

      {/* Legend / regions list */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-border/40 text-[10px] font-mono uppercase tracking-[0.15em]">
        <span className="flex items-center gap-1.5" style={{ color: STATUS_ERROR }}>
          <AlertTriangle className="w-3 h-3" />
          Grind ≥ {Math.round(GRIND_THRESHOLD * 100)}%
        </span>
        <span className="flex items-center gap-1.5" style={{ color: STATUS_WARNING }}>
          <MoonStar className="w-3 h-3" />
          Dead ≤ {Math.round(DEAD_THRESHOLD * 100)}%
        </span>
        <span className="text-text-muted opacity-70">
          {regions.length === 0
            ? 'No grind walls or dead spots detected.'
            : regions.map(r => `${r.kind === 'grind' ? 'Grind' : 'Dead'}: ${r.zoneNames.join(' → ')}`).join(' · ')}
        </span>
      </div>
    </BlueprintPanel>
  );
}
