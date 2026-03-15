'use client';

import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, MapPin, Info } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Constants matching C++ defaults ──────────────────────────────────────────

const DEFAULT_MIN_RADIUS = 500;
const DEFAULT_MAX_RADIUS = 1500;
const DEFAULT_NUM_POINTS = 15;

// SVG layout
const SVG_SIZE = 320;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_PADDING = 20;
const DRAW_RADIUS = (SVG_SIZE - SVG_PADDING * 2) / 2;

// ── Point generation (mirrors UEnvQueryGenerator_PatrolPoints::GenerateItems) ─

interface PatrolPoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

function generatePatrolPoints(
  numPoints: number,
  minRadius: number,
  maxRadius: number,
): PatrolPoint[] {
  const points: PatrolPoint[] = [];
  const minR = Math.max(minRadius, 0);
  const maxR = Math.max(maxRadius, minR + 1);

  for (let i = 0; i < numPoints; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = minR + Math.random() * (maxR - minR);
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle,
      radius,
    });
  }
  return points;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PatrolPointsDistribution() {
  const [seed, setSeed] = useState(0);

  const points = useMemo(
    () => generatePatrolPoints(DEFAULT_NUM_POINTS, DEFAULT_MIN_RADIUS, DEFAULT_MAX_RADIUS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  );

  const regenerate = useCallback(() => setSeed((s) => s + 1), []);

  // Scale factor: map world-space MaxRadius → drawable SVG radius
  const scale = DRAW_RADIUS / DEFAULT_MAX_RADIUS;
  const minSvgR = DEFAULT_MIN_RADIUS * scale;
  const maxSvgR = DEFAULT_MAX_RADIUS * scale;

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="patrol-points-distribution">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_VIOLET }}><MapPin className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">PatrolPoints Distribution</h3>
          <p className="text-2xs text-text-muted">
            Top-down view of <code className="font-mono">UEnvQueryGenerator_PatrolPoints</code> output
          </p>
        </div>
        <button
          onClick={regenerate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`,
            color: ACCENT_VIOLET,
            border: `1px solid ${ACCENT_VIOLET}30`,
          }}
          title="Regenerate random distribution"
          data-testid="patrol-points-regenerate-btn"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      {/* SVG + side panel */}
      <div className="flex flex-col sm:flex-row">
        {/* SVG diagram */}
        <div className="flex items-center justify-center p-4" data-testid="patrol-points-svg">
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="shrink-0"
          >
            {/* Grid rings for reference */}
            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <circle
                key={frac}
                cx={SVG_CENTER}
                cy={SVG_CENTER}
                r={maxSvgR * frac}
                fill="none"
                stroke="var(--border)"
                strokeWidth={0.5}
                strokeDasharray="3 3"
                opacity={0.3}
              />
            ))}

            {/* MaxRadius circle (outer boundary) */}
            <circle
              cx={SVG_CENTER}
              cy={SVG_CENTER}
              r={maxSvgR}
              fill="none"
              stroke={ACCENT_VIOLET}
              strokeWidth={1.5}
              opacity={0.6}
            />

            {/* MinRadius circle (inner boundary) */}
            <circle
              cx={SVG_CENTER}
              cy={SVG_CENTER}
              r={minSvgR}
              fill="none"
              stroke={ACCENT_VIOLET}
              strokeWidth={1.5}
              opacity={0.6}
              strokeDasharray="6 3"
            />

            {/* Valid annular zone fill */}
            <path
              d={[
                `M ${SVG_CENTER + maxSvgR} ${SVG_CENTER}`,
                `A ${maxSvgR} ${maxSvgR} 0 1 1 ${SVG_CENTER - maxSvgR} ${SVG_CENTER}`,
                `A ${maxSvgR} ${maxSvgR} 0 1 1 ${SVG_CENTER + maxSvgR} ${SVG_CENTER}`,
                `Z`,
                `M ${SVG_CENTER + minSvgR} ${SVG_CENTER}`,
                `A ${minSvgR} ${minSvgR} 0 1 0 ${SVG_CENTER - minSvgR} ${SVG_CENTER}`,
                `A ${minSvgR} ${minSvgR} 0 1 0 ${SVG_CENTER + minSvgR} ${SVG_CENTER}`,
                `Z`,
              ].join(' ')}
              fill={ACCENT_VIOLET}
              fillOpacity={0.06}
              fillRule="evenodd"
            />

            {/* Dead zone (inner circle) */}
            <circle
              cx={SVG_CENTER}
              cy={SVG_CENTER}
              r={minSvgR}
              fill="var(--surface-deep)"
              fillOpacity={0.4}
            />

            {/* Origin crosshair */}
            <line
              x1={SVG_CENTER - 8} y1={SVG_CENTER}
              x2={SVG_CENTER + 8} y2={SVG_CENTER}
              stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.8}
            />
            <line
              x1={SVG_CENTER} y1={SVG_CENTER - 8}
              x2={SVG_CENTER} y2={SVG_CENTER + 8}
              stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.8}
            />

            {/* Patrol points */}
            {points.map((pt, i) => {
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              return (
                <g key={i}>
                  {/* Line from origin to point */}
                  <line
                    x1={SVG_CENTER} y1={SVG_CENTER}
                    x2={sx} y2={sy}
                    stroke={ACCENT_VIOLET}
                    strokeWidth={0.5}
                    opacity={0.15}
                  />
                  {/* Point dot */}
                  <circle
                    cx={sx}
                    cy={sy}
                    r={4}
                    fill={ACCENT_VIOLET}
                    fillOpacity={0.9}
                    stroke="var(--surface-deep)"
                    strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* Labels */}
            <text
              x={SVG_CENTER + maxSvgR + 2}
              y={SVG_CENTER - 4}
              fill={ACCENT_VIOLET}
              fontSize={9}
              fontFamily="monospace"
              opacity={0.7}
            >
              {DEFAULT_MAX_RADIUS}
            </text>
            <text
              x={SVG_CENTER + minSvgR + 2}
              y={SVG_CENTER + 12}
              fill={ACCENT_VIOLET}
              fontSize={9}
              fontFamily="monospace"
              opacity={0.7}
            >
              {DEFAULT_MIN_RADIUS}
            </text>

            {/* Querier label */}
            <text
              x={SVG_CENTER}
              y={SVG_CENTER + 20}
              fill={ACCENT_CYAN}
              fontSize={8}
              fontFamily="monospace"
              textAnchor="middle"
              opacity={0.8}
            >
              Querier
            </text>
          </svg>
        </div>

        {/* Side panel — parameters + notes */}
        <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-border/40 space-y-3 min-w-0">
          {/* Parameters */}
          <div>
            <h4 className="text-xs font-bold text-text mb-2">Generator Parameters</h4>
            <div className="space-y-1.5">
              {[
                { label: 'NumberOfPoints', value: String(DEFAULT_NUM_POINTS), desc: 'Random points per query' },
                { label: 'MinRadius', value: `${DEFAULT_MIN_RADIUS}.0`, desc: 'Inner boundary (dashed)' },
                { label: 'MaxRadius', value: `${DEFAULT_MAX_RADIUS}.0`, desc: 'Outer boundary (solid)' },
              ].map((p) => (
                <div key={p.label} className="flex items-baseline gap-2">
                  <span className="text-2xs font-mono shrink-0" style={{ color: ACCENT_VIOLET }}>{p.label}</span>
                  <span className="text-2xs font-mono font-bold text-text">{p.value}</span>
                  <span className="text-2xs text-text-muted ml-auto">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithm */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5">Algorithm</h4>
            <div className="text-2xs text-text-muted leading-relaxed space-y-1">
              <p className="font-mono" style={{ color: ACCENT_VIOLET }}>
                for (i = 0; i &lt; NumberOfPoints; ++i)
              </p>
              <div className="pl-3 space-y-0.5">
                <p><span className="font-mono text-text">Angle</span> = FRandRange(0, 2&pi;)</p>
                <p><span className="font-mono text-text">Radius</span> = FRandRange(MinR, MaxR)</p>
                <p><span className="font-mono text-text">Point</span> = Origin + (cos(&theta;) &times; R, sin(&theta;) &times; R, 0)</p>
              </div>
            </div>
          </div>

          {/* Nav projection note */}
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
            data-testid="patrol-points-nav-note"
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              After generation, all points are <strong>nav-projected</strong> via{' '}
              <code className="font-mono">ProjectAndFilterNavPoints()</code> &mdash; points
              that don&apos;t land on the NavMesh are discarded. The diagram shows
              pre-projection positions.
            </span>
          </div>

          {/* Coverage insight */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-text">Coverage Analysis</h4>
            <p className="text-2xs text-text-muted leading-relaxed">
              The annular area is{' '}
              <span className="font-mono text-text">
                &pi;({DEFAULT_MAX_RADIUS}&sup2; &minus; {DEFAULT_MIN_RADIUS}&sup2;) &asymp;{' '}
                {Math.round(Math.PI * (DEFAULT_MAX_RADIUS ** 2 - DEFAULT_MIN_RADIUS ** 2)).toLocaleString()}
              </span>{' '}
              uu&sup2;. With {DEFAULT_NUM_POINTS} points, average density is{' '}
              <span className="font-mono text-text">
                ~{Math.round(Math.PI * (DEFAULT_MAX_RADIUS ** 2 - DEFAULT_MIN_RADIUS ** 2) / DEFAULT_NUM_POINTS).toLocaleString()} uu&sup2;/point
              </span>.
              Increase <code className="font-mono">NumberOfPoints</code> for tighter coverage.
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
