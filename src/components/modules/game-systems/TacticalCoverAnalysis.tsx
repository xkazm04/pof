'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Shield, RotateCcw, Info, Mountain, Eye, EyeOff } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

const SVG_SIZE = 380;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_PADDING = 44;
const DRAW_RADIUS = (SVG_SIZE - SVG_PADDING * 2) / 2;

// World-space defaults (matching C++)
const DEFAULT_MIN_RADIUS = 300;
const DEFAULT_MAX_RADIUS = 1200;
const DEFAULT_SAMPLE_COUNT = 36;
const DEFAULT_COVER_CHECK = 150;
const DEFAULT_RINGS = 3;

// ── Mock obstacles (walls, pillars) for visualization ───────────────────────

interface Obstacle {
  id: string;
  label: string;
  type: 'wall' | 'pillar' | 'elevation';
  /** World-space position relative to threat center */
  x: number;
  y: number;
  /** For walls: width/height; for pillars: radius; for elevation: height */
  w: number;
  h: number;
  elevation?: number;
}

const MOCK_OBSTACLES: Obstacle[] = [
  { id: 'wall-1', label: 'Stone Wall', type: 'wall', x: -400, y: -300, w: 250, h: 40 },
  { id: 'wall-2', label: 'Barricade', type: 'wall', x: 500, y: 200, w: 180, h: 35 },
  { id: 'pillar-1', label: 'Pillar A', type: 'pillar', x: -200, y: 500, w: 45, h: 45 },
  { id: 'pillar-2', label: 'Pillar B', type: 'pillar', x: 600, y: -400, w: 50, h: 50 },
  { id: 'pillar-3', label: 'Pillar C', type: 'pillar', x: -700, y: 100, w: 40, h: 40 },
  { id: 'elev-1', label: 'Ledge', type: 'elevation', x: 300, y: -600, w: 200, h: 100, elevation: 250 },
  { id: 'elev-2', label: 'Stairway', type: 'elevation', x: -500, y: -700, w: 150, h: 80, elevation: 180 },
];

// ── Cover position computation ──────────────────────────────────────────────

interface CoverPoint {
  x: number;
  y: number;
  ring: number;
  angle: number;
  coverScore: number;     // 0.0=exposed, 1.0=full cover (LOS)
  elevationScore: number; // 0.0=flat, 1.0=max height advantage
  combinedScore: number;
  nearestObstacle: string | null;
}

function isPointBehindObstacle(
  px: number, py: number,
  threatX: number, threatY: number,
  obstacles: Obstacle[],
): { covered: boolean; nearestId: string | null; elevBonus: number } {
  let bestCover = false;
  let nearestId: string | null = null;
  let bestDist = Infinity;
  let elevBonus = 0;

  for (const obs of obstacles) {
    // Direction from threat to candidate point
    const dirX = px - threatX;
    const dirY = py - threatY;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen < 1) continue;

    // Check if the obstacle lies between threat and point
    const toObsX = obs.x - threatX;
    const toObsY = obs.y - threatY;

    // Project obstacle onto threat->point line
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;
    const proj = toObsX * ndx + toObsY * ndy;

    if (proj < 0 || proj > dirLen) continue; // Obstacle not between them

    // Perpendicular distance from obstacle center to the line
    const perpX = toObsX - proj * ndx;
    const perpY = toObsY - proj * ndy;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

    const blockRadius = obs.type === 'pillar' ? obs.w : Math.max(obs.w, obs.h) * 0.5;

    if (perpDist < blockRadius + 30) {
      // This obstacle provides cover
      const dist = Math.sqrt(
        (px - obs.x) * (px - obs.x) + (py - obs.y) * (py - obs.y),
      );
      if (dist < bestDist) {
        bestDist = dist;
        nearestId = obs.id;
        bestCover = true;
      }
    }

    // Elevation bonus
    if (obs.type === 'elevation' && obs.elevation) {
      const distToElev = Math.sqrt(
        (px - obs.x) * (px - obs.x) + (py - obs.y) * (py - obs.y),
      );
      if (distToElev < Math.max(obs.w, obs.h) * 1.2) {
        elevBonus = Math.max(elevBonus, Math.min(obs.elevation / 300, 1));
      }
    }
  }

  return { covered: bestCover, nearestId, elevBonus };
}

function generateCoverPoints(
  sampleCount: number,
  rings: number,
  minRadius: number,
  maxRadius: number,
  obstacles: Obstacle[],
): CoverPoint[] {
  const points: CoverPoint[] = [];
  const threatX = 0;
  const threatY = 0;

  for (let ringIdx = 0; ringIdx < rings; ringIdx++) {
    const alpha = rings === 1 ? 0.5 : ringIdx / (rings - 1);
    const ringRadius = minRadius + (maxRadius - minRadius) * alpha;
    const angleStep = (2 * Math.PI) / sampleCount;

    for (let i = 0; i < sampleCount; i++) {
      const angle = angleStep * i;
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;

      const { covered, nearestId, elevBonus } = isPointBehindObstacle(
        x, y, threatX, threatY, obstacles,
      );

      const coverScore = covered ? 0.7 + Math.random() * 0.3 : Math.random() * 0.15;
      const elevationScore = elevBonus;
      const combinedScore = coverScore * 0.6 + elevationScore * 0.4;

      points.push({
        x, y, ring: ringIdx, angle,
        coverScore,
        elevationScore,
        combinedScore,
        nearestObstacle: nearestId,
      });
    }
  }

  return points;
}

// ── Color mapping ───────────────────────────────────────────────────────────

function coverColor(score: number): string {
  // Red (exposed) -> Yellow (partial) -> Green (good cover)
  const t = Math.min(Math.max(score, 0), 1);
  if (t <= 0.5) {
    const f = t / 0.5;
    const r = Math.round(248 + (251 - 248) * f);
    const g = Math.round(113 + (191 - 113) * f);
    const b = Math.round(113 + (36 - 113) * f);
    return `rgb(${r},${g},${b})`;
  }
  const f = (t - 0.5) / 0.5;
  const r = Math.round(251 + (74 - 251) * f);
  const g = Math.round(191 + (222 - 191) * f);
  const b = Math.round(36 + (128 - 36) * f);
  return `rgb(${r},${g},${b})`;
}

// ── SVG arc path helper ─────────────────────────────────────────────────────

function arcPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
): string {
  const cos1 = Math.cos(startAngle);
  const sin1 = Math.sin(startAngle);
  const cos2 = Math.cos(endAngle);
  const sin2 = Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx + outerR * cos1} ${cy + outerR * sin1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${cx + outerR * cos2} ${cy + outerR * sin2}`,
    `L ${cx + innerR * cos2} ${cy + innerR * sin2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${cx + innerR * cos1} ${cy + innerR * sin1}`,
    `Z`,
  ].join(' ');
}

// ── Component ───────────────────────────────────────────────────────────────

type ScoreMode = 'cover' | 'elevation' | 'combined';

export function TacticalCoverAnalysis() {
  const [sampleCount] = useState(DEFAULT_SAMPLE_COUNT);
  const [rings] = useState(DEFAULT_RINGS);
  const [minRadius] = useState(DEFAULT_MIN_RADIUS);
  const [maxRadius] = useState(DEFAULT_MAX_RADIUS);
  const [coverCheck] = useState(DEFAULT_COVER_CHECK);
  const [scoreMode, setScoreMode] = useState<ScoreMode>('combined');
  const [showLOSTraces, setShowLOSTraces] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [seed, setSeed] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const scale = DRAW_RADIUS / maxRadius;

  const points = useMemo(
    () => generateCoverPoints(sampleCount, rings, minRadius, maxRadius, MOCK_OBSTACLES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sampleCount, rings, minRadius, maxRadius, seed],
  );

  const getScore = useCallback((pt: CoverPoint) => {
    if (scoreMode === 'cover') return pt.coverScore;
    if (scoreMode === 'elevation') return pt.elevationScore;
    return pt.combinedScore;
  }, [scoreMode]);

  const bestPoint = useMemo(
    () => points.reduce((best, p) => (getScore(p) > getScore(best) ? p : best), points[0]),
    [points, getScore],
  );

  const coveredCount = useMemo(
    () => points.filter((p) => p.coverScore > 0.5).length,
    [points],
  );

  const elevatedCount = useMemo(
    () => points.filter((p) => p.elevationScore > 0.2).length,
    [points],
  );

  const regenerate = useCallback(() => setSeed((s) => s + 1), []);

  // Heatmap arcs — coverage quality around the ring
  const heatmapArcs = useMemo(() => {
    const segments = 72;
    const step = (2 * Math.PI) / segments;
    return Array.from({ length: segments }, (_, i) => {
      const midAngle = step * i + step / 2;
      // Find closest point to this arc to estimate coverage
      const closest = points.reduce((best, p) => {
        const angleDiff = Math.abs(
          ((p.angle - midAngle + Math.PI) % (2 * Math.PI)) - Math.PI,
        );
        const bestDiff = Math.abs(
          ((best.angle - midAngle + Math.PI) % (2 * Math.PI)) - Math.PI,
        );
        return angleDiff < bestDiff ? p : best;
      }, points[0]);
      const score = getScore(closest);
      return {
        startAngle: step * i,
        endAngle: step * (i + 1),
        score,
        color: coverColor(score),
      };
    });
  }, [points, getScore]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="tactical-cover-analysis">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_EMERALD }}><Shield className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">Tactical Cover Analysis</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">EnvQueryGenerator_CoverPositions</code> + LOS & elevation scoring
          </p>
        </div>
        <button
          onClick={regenerate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT_EMERALD}${OPACITY_15}`,
            color: ACCENT_EMERALD,
            border: `1px solid ${ACCENT_EMERALD}30`,
          }}
          title="Regenerate cover positions"
          data-testid="cover-regenerate-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      {/* Score mode selector */}
      <div className="px-4 py-2 border-b border-border/20 flex items-center gap-2">
        <span className="text-2xs text-text-muted mr-1">Score by:</span>
        {([
          { mode: 'combined' as ScoreMode, label: 'Combined', color: ACCENT_EMERALD },
          { mode: 'cover' as ScoreMode, label: 'LOS Cover', color: ACCENT_CYAN },
          { mode: 'elevation' as ScoreMode, label: 'Elevation', color: ACCENT_ORANGE },
        ]).map(({ mode, label, color }) => (
          <button
            key={mode}
            onClick={() => setScoreMode(mode)}
            className="text-2xs font-mono px-2 py-1 rounded-md transition-all"
            style={{
              backgroundColor: scoreMode === mode ? `${color}${OPACITY_15}` : 'transparent',
              color: scoreMode === mode ? color : 'var(--text-muted)',
              border: `1px solid ${scoreMode === mode ? `${color}40` : 'transparent'}`,
            }}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowLOSTraces((v) => !v)}
            className="text-2xs flex items-center gap-1 px-2 py-1 rounded-md transition-all"
            style={{
              backgroundColor: showLOSTraces ? `${ACCENT_CYAN}${OPACITY_10}` : 'transparent',
              color: showLOSTraces ? ACCENT_CYAN : 'var(--text-muted)',
            }}
            title="Toggle LOS trace lines"
          >
            {showLOSTraces ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Traces
          </button>
        </div>
      </div>

      {/* SVG + side panel */}
      <div className="flex flex-col sm:flex-row">
        {/* SVG diagram */}
        <div className="flex items-center justify-center p-4" data-testid="cover-svg-container">
          <svg
            ref={svgRef}
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="shrink-0 select-none"
          >
            {/* Coverage heatmap annular zone */}
            {heatmapArcs.map((arc, i) => (
              <path
                key={i}
                d={arcPath(
                  SVG_CENTER, SVG_CENTER,
                  DRAW_RADIUS * 0.5, DRAW_RADIUS * 0.95,
                  arc.startAngle, arc.endAngle,
                )}
                fill={arc.color}
                fillOpacity={0.12}
                stroke={arc.color}
                strokeWidth={0.3}
                strokeOpacity={0.2}
              />
            ))}

            {/* Ring boundaries */}
            {Array.from({ length: rings }, (_, ringIdx) => {
              const alpha = rings === 1 ? 0.5 : ringIdx / (rings - 1);
              const r = (minRadius + (maxRadius - minRadius) * alpha) * scale;
              return (
                <circle
                  key={ringIdx}
                  cx={SVG_CENTER} cy={SVG_CENTER} r={r}
                  fill="none" stroke="var(--border)"
                  strokeWidth={0.5} opacity={0.3}
                  strokeDasharray="4 3"
                />
              );
            })}

            {/* Outer boundary */}
            <circle
              cx={SVG_CENTER} cy={SVG_CENTER} r={DRAW_RADIUS}
              fill="none" stroke={ACCENT_EMERALD}
              strokeWidth={1} opacity={0.3}
            />

            {/* Inner boundary */}
            <circle
              cx={SVG_CENTER} cy={SVG_CENTER} r={minRadius * scale}
              fill="none" stroke={ACCENT_EMERALD}
              strokeWidth={0.8} opacity={0.2}
              strokeDasharray="3 2"
            />

            {/* Obstacles */}
            {MOCK_OBSTACLES.map((obs) => {
              const sx = SVG_CENTER + obs.x * scale;
              const sy = SVG_CENTER + obs.y * scale;
              const sw = obs.w * scale;
              const sh = obs.h * scale;

              if (obs.type === 'pillar') {
                return (
                  <g key={obs.id}>
                    <circle
                      cx={sx} cy={sy} r={sw / 2}
                      fill={ACCENT_VIOLET}
                      fillOpacity={0.3}
                      stroke={ACCENT_VIOLET}
                      strokeWidth={1}
                      opacity={0.7}
                    />
                    <text
                      x={sx} y={sy - sw / 2 - 4}
                      textAnchor="middle"
                      className="text-[11px] font-mono"
                      fill={ACCENT_VIOLET} opacity={0.7}
                    >
                      {obs.label}
                    </text>
                  </g>
                );
              }

              if (obs.type === 'elevation') {
                return (
                  <g key={obs.id}>
                    <rect
                      x={sx - sw / 2} y={sy - sh / 2}
                      width={sw} height={sh} rx={3}
                      fill={ACCENT_ORANGE}
                      fillOpacity={0.2}
                      stroke={ACCENT_ORANGE}
                      strokeWidth={1}
                      opacity={0.7}
                      strokeDasharray="3 2"
                    />
                    <Mountain
                      className="w-2.5 h-2.5"
                      x={sx - 5} y={sy - 5}
                      style={{ color: ACCENT_ORANGE }}
                    />
                    <text
                      x={sx} y={sy + sh / 2 + 8}
                      textAnchor="middle"
                      className="text-[11px] font-mono"
                      fill={ACCENT_ORANGE} opacity={0.7}
                    >
                      {obs.label} (+{obs.elevation}UU)
                    </text>
                  </g>
                );
              }

              // Wall
              return (
                <g key={obs.id}>
                  <rect
                    x={sx - sw / 2} y={sy - sh / 2}
                    width={sw} height={sh} rx={2}
                    fill={ACCENT_VIOLET}
                    fillOpacity={0.25}
                    stroke={ACCENT_VIOLET}
                    strokeWidth={1}
                    opacity={0.7}
                  />
                  <text
                    x={sx} y={sy - sh / 2 - 4}
                    textAnchor="middle"
                    className="text-[11px] font-mono"
                    fill={ACCENT_VIOLET} opacity={0.7}
                  >
                    {obs.label}
                  </text>
                </g>
              );
            })}

            {/* LOS trace lines from covered points to threat center */}
            {showLOSTraces && points.filter((p) => p.coverScore > 0.5).map((pt, i) => {
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              return (
                <line
                  key={`los-${i}`}
                  x1={SVG_CENTER} y1={SVG_CENTER}
                  x2={sx} y2={sy}
                  stroke={STATUS_SUCCESS}
                  strokeWidth={0.4}
                  opacity={0.15}
                  strokeDasharray="2 3"
                />
              );
            })}

            {/* Cover points */}
            {points.map((pt, i) => {
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              const score = getScore(pt);
              const color = coverColor(score);
              const isBest = pt === bestPoint;
              const isHovered = hoveredPoint === i;
              const baseR = isBest ? 6 : score > 0.5 ? 4 : 3;
              const r = isHovered ? baseR + 2 : baseR;

              return (
                <g key={i}>
                  {/* Best point glow */}
                  {isBest && (
                    <circle
                      cx={sx} cy={sy} r={11}
                      fill="none" stroke={color}
                      strokeWidth={1.2} opacity={0.5}
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle
                    cx={sx} cy={sy} r={r}
                    fill={color}
                    fillOpacity={score > 0.3 ? 0.85 : 0.4}
                    stroke="var(--surface-deep)"
                    strokeWidth={1}
                    className="cursor-pointer transition-all"
                    onPointerEnter={() => setHoveredPoint(i)}
                    onPointerLeave={() => setHoveredPoint(null)}
                  />
                  {/* Score label on hover/best */}
                  {(isHovered || isBest) && (
                    <text
                      x={sx}
                      y={sy - r - 4}
                      textAnchor="middle"
                      className="text-[11px] font-mono font-bold"
                      fill={color}
                    >
                      {(score * 100).toFixed(0)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Hovered point detail tooltip */}
            {hoveredPoint !== null && (() => {
              const pt = points[hoveredPoint];
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              const tooltipX = sx + (sx > SVG_CENTER ? -90 : 10);
              const tooltipY = sy + (sy > SVG_CENTER ? -52 : 10);

              return (
                <g>
                  <rect
                    x={tooltipX} y={tooltipY}
                    width={82} height={42}
                    rx={4}
                    fill="var(--surface-deep)"
                    stroke="var(--border)"
                    strokeWidth={0.5}
                    opacity={0.95}
                  />
                  <text x={tooltipX + 4} y={tooltipY + 11}
                    className="text-[11px] font-mono fill-[var(--text-muted)]"
                  >
                    Cover: {(pt.coverScore * 100).toFixed(0)}%
                  </text>
                  <text x={tooltipX + 4} y={tooltipY + 22}
                    className="text-[11px] font-mono fill-[var(--text-muted)]"
                  >
                    Elev: {(pt.elevationScore * 100).toFixed(0)}%
                  </text>
                  <text x={tooltipX + 4} y={tooltipY + 33}
                    className="text-[11px] font-mono font-bold"
                    fill={coverColor(pt.combinedScore)}
                  >
                    Combined: {(pt.combinedScore * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })()}

            {/* Threat center crosshair */}
            <line
              x1={SVG_CENTER - 10} y1={SVG_CENTER}
              x2={SVG_CENTER + 10} y2={SVG_CENTER}
              stroke={ACCENT_ORANGE} strokeWidth={1.5} opacity={0.7}
            />
            <line
              x1={SVG_CENTER} y1={SVG_CENTER - 10}
              x2={SVG_CENTER} y2={SVG_CENTER + 10}
              stroke={ACCENT_ORANGE} strokeWidth={1.5} opacity={0.7}
            />
            <text
              x={SVG_CENTER}
              y={SVG_CENTER + 20}
              textAnchor="middle"
              className="text-[11px] font-mono"
              fill={ACCENT_ORANGE} opacity={0.8}
            >
              Threat (Player)
            </text>

            {/* Legend gradient */}
            <defs>
              <linearGradient id="cover-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={coverColor(0)} />
                <stop offset="50%" stopColor={coverColor(0.5)} />
                <stop offset="100%" stopColor={coverColor(1)} />
              </linearGradient>
            </defs>
            <rect
              x={SVG_CENTER - 60} y={SVG_SIZE - 22}
              width={120} height={6} rx={3}
              fill="url(#cover-gradient)"
              opacity={0.8}
            />
            <text x={SVG_CENTER - 62} y={SVG_SIZE - 14} textAnchor="end" className="text-[11px] font-mono fill-[var(--text-muted)]">Exposed</text>
            <text x={SVG_CENTER + 62} y={SVG_SIZE - 14} textAnchor="start" className="text-[11px] font-mono fill-[var(--text-muted)]">Covered</text>

            {/* Degree markings */}
            {[0, 90, 180, 270].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const lx = SVG_CENTER + Math.cos(rad) * (DRAW_RADIUS + 16);
              const ly = SVG_CENTER + Math.sin(rad) * (DRAW_RADIUS + 16);
              return (
                <text
                  key={deg}
                  x={lx} y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[11px] font-mono fill-[var(--text-muted)]"
                  opacity={0.4}
                >
                  {deg}°
                </text>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-border/40 space-y-3 min-w-0">
          {/* Stats summary */}
          <div>
            <h4 className="text-xs font-bold text-text mb-2">Coverage Analysis</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Points', value: points.length, color: ACCENT_VIOLET },
                { label: 'Covered', value: coveredCount, color: STATUS_SUCCESS },
                { label: 'Elevated', value: elevatedCount, color: ACCENT_ORANGE },
                { label: 'Obstacles', value: MOCK_OBSTACLES.length, color: ACCENT_CYAN },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-2xs text-text-muted">{s.label}</span>
                  <span className="text-2xs font-mono font-bold" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Generator parameters */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5">Generator Params</h4>
            <div className="space-y-1">
              {[
                { label: 'SampleCount', value: String(sampleCount), desc: 'Per ring' },
                { label: 'NumberOfRings', value: String(rings), desc: 'Radial layers' },
                { label: 'MinRadius', value: `${minRadius} UU`, desc: 'Inner boundary' },
                { label: 'MaxRadius', value: `${maxRadius} UU`, desc: 'Outer boundary' },
                { label: 'CoverCheckDist', value: `${coverCheck} UU`, desc: 'Geometry trace' },
              ].map((p) => (
                <div key={p.label} className="flex items-baseline gap-2">
                  <span className="text-2xs font-mono shrink-0" style={{ color: ACCENT_EMERALD }}>{p.label}</span>
                  <span className="text-2xs font-mono font-bold text-text">{p.value}</span>
                  <span className="text-2xs text-text-muted ml-auto">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithm */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5">Cover Detection Algorithm</h4>
            <div className="text-2xs text-text-muted leading-relaxed space-y-1">
              <p className="font-mono" style={{ color: ACCENT_EMERALD }}>
                for each ring in [Min..Max]:
              </p>
              <div className="pl-3 space-y-0.5">
                <p><span className="font-mono text-text">1.</span> Generate points at ring radius</p>
                <p><span className="font-mono text-text">2.</span> Trace away from threat → detect walls</p>
                <p><span className="font-mono text-text">3.</span> If hit: place point at wall surface</p>
                <p><span className="font-mono text-text">4.</span> No hit: trace toward threat for pillars</p>
                <p><span className="font-mono text-text">5.</span> Project survivors to NavMesh</p>
              </div>
            </div>
          </div>

          {/* Scoring tests */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5">Scoring Pipeline</h4>
            <div className="space-y-1.5">
              {[
                { test: 'LineOfSight', cost: 'High', desc: '3-height trace → exposure %', color: ACCENT_CYAN },
                { test: 'ElevationAdv', cost: 'Low', desc: 'Height diff → 0-1 bonus', color: ACCENT_ORANGE },
                { test: 'FlankAngle', cost: 'Low', desc: 'Compose with existing test', color: ACCENT_EMERALD },
                { test: 'PathExists', cost: 'High', desc: 'Nav reachability filter', color: ACCENT_VIOLET },
              ].map((t) => (
                <div key={t.test} className="flex items-center gap-2">
                  <span
                    className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: `${t.color}${OPACITY_10}`,
                      color: t.color,
                      border: `1px solid ${t.color}30`,
                    }}
                  >
                    {t.test}
                  </span>
                  <span
                    className="text-2xs font-mono px-1 py-0.5 rounded shrink-0"
                    style={{
                      color: t.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS,
                      backgroundColor: `${(t.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS)}${OPACITY_10}`,
                    }}
                  >
                    {t.cost}
                  </span>
                  <span className="text-2xs text-text-muted">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info note */}
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Cover positions are generated from <strong>level geometry traces</strong>, not
              pre-placed markers. AI dynamically finds walls, pillars, and elevation changes
              in any environment.
            </span>
          </div>

          {/* Top cover positions */}
          {hoveredPoint === null && (
            <div>
              <h4 className="text-xs font-bold text-text mb-1.5">Best Positions</h4>
              <div className="space-y-1">
                {[...points]
                  .sort((a, b) => getScore(b) - getScore(a))
                  .slice(0, 5)
                  .map((pt, i) => {
                    const score = getScore(pt);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: coverColor(score) }}
                        />
                        <span className="text-2xs font-mono text-text-muted w-4 shrink-0">
                          #{i + 1}
                        </span>
                        <div className="flex-1 h-3 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                          <div
                            className="h-full rounded-sm"
                            style={{
                              backgroundColor: coverColor(score),
                              width: `${score * 100}%`,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <span
                          className="text-2xs font-mono font-bold w-10 text-right shrink-0"
                          style={{ color: coverColor(score) }}
                        >
                          {(score * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
