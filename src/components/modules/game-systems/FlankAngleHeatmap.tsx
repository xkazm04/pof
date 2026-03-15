'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Crosshair, RotateCcw, Info } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Constants matching C++ defaults ──────────────────────────────────────────

const ATTACK_DISTANCE = 200;
const NUMBER_OF_POINTS = 12;

// SVG layout
const SVG_SIZE = 360;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_PADDING = 40;
const DRAW_RADIUS = (SVG_SIZE - SVG_PADDING * 2) / 2;

// ── Flank angle color: 0°=red(front) → 90°=yellow(side) → 180°=green(behind)

function flankColor(angleDeg: number): string {
  const t = Math.min(angleDeg / 180, 1);
  // red → yellow → green
  if (t <= 0.5) {
    // red(255,68,68) → yellow(234,179,8)
    const f = t / 0.5;
    const r = Math.round(255 + (234 - 255) * f);
    const g = Math.round(68 + (179 - 68) * f);
    const b = Math.round(68 + (8 - 68) * f);
    return `rgb(${r},${g},${b})`;
  }
  // yellow(234,179,8) → green(34,197,94)
  const f = (t - 0.5) / 0.5;
  const r = Math.round(234 + (34 - 234) * f);
  const g = Math.round(179 + (197 - 179) * f);
  const b = Math.round(8 + (94 - 8) * f);
  return `rgb(${r},${g},${b})`;
}

// ── Compute flank angle exactly like C++ ─────────────────────────────────────

function computeFlankAngle(
  targetForwardX: number,
  targetForwardY: number,
  pointX: number,
  pointY: number,
): number {
  // DirToItem = normalize(point - origin) — origin is (0,0) in our coordinate space
  const len = Math.sqrt(pointX * pointX + pointY * pointY);
  if (len < 0.001) return 0;
  const dirX = pointX / len;
  const dirY = pointY / len;

  // dot(TargetForward, DirToItem)
  const dot = targetForwardX * dirX + targetForwardY * dirY;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return Math.acos(clampedDot) * (180 / Math.PI);
}

// ── Generate attack ring points (matches C++) ────────────────────────────────

interface RingPoint {
  x: number;
  y: number;
  angle: number;     // ring angle (radians)
  flankDeg: number;  // flank angle score (degrees)
  color: string;
}

function generateRingPoints(
  numPoints: number,
  forwardAngleRad: number,
): RingPoint[] {
  const fwdX = Math.cos(forwardAngleRad);
  const fwdY = Math.sin(forwardAngleRad);
  const angleStep = (2 * Math.PI) / numPoints;

  return Array.from({ length: numPoints }, (_, i) => {
    const angle = angleStep * i;
    const x = Math.cos(angle) * ATTACK_DISTANCE;
    const y = Math.sin(angle) * ATTACK_DISTANCE;
    const flankDeg = computeFlankAngle(fwdX, fwdY, x, y);
    return { x, y, angle, flankDeg, color: flankColor(flankDeg) };
  });
}

// ── Generate heatmap arc segments for the annular zone ───────────────────────

function generateHeatmapArcs(
  forwardAngleRad: number,
  segments: number = 72,
): { startAngle: number; endAngle: number; flankDeg: number; color: string }[] {
  const fwdX = Math.cos(forwardAngleRad);
  const fwdY = Math.sin(forwardAngleRad);
  const step = (2 * Math.PI) / segments;

  return Array.from({ length: segments }, (_, i) => {
    const midAngle = step * i + step / 2;
    const px = Math.cos(midAngle);
    const py = Math.sin(midAngle);
    const flankDeg = computeFlankAngle(fwdX, fwdY, px, py);
    return {
      startAngle: step * i,
      endAngle: step * (i + 1),
      flankDeg,
      color: flankColor(flankDeg),
    };
  });
}

// ── SVG arc path helper ──────────────────────────────────────────────────────

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

  const outerX1 = cx + outerR * cos1;
  const outerY1 = cy + outerR * sin1;
  const outerX2 = cx + outerR * cos2;
  const outerY2 = cy + outerR * sin2;
  const innerX1 = cx + innerR * cos1;
  const innerY1 = cy + innerR * sin1;
  const innerX2 = cx + innerR * cos2;
  const innerY2 = cy + innerR * sin2;

  return [
    `M ${outerX1} ${outerY1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerX2} ${outerY2}`,
    `L ${innerX2} ${innerY2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX1} ${innerY1}`,
    `Z`,
  ].join(' ');
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlankAngleHeatmap() {
  // Forward direction as angle in radians (0 = right/east, PI/2 = down/south in SVG)
  // Default: pointing up (north) = -PI/2
  const [forwardAngle, setForwardAngle] = useState(-Math.PI / 2);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const scale = DRAW_RADIUS / ATTACK_DISTANCE;

  const points = useMemo(
    () => generateRingPoints(NUMBER_OF_POINTS, forwardAngle),
    [forwardAngle],
  );

  const heatmapArcs = useMemo(
    () => generateHeatmapArcs(forwardAngle),
    [forwardAngle],
  );

  const bestPoint = useMemo(
    () => points.reduce((best, p) => (p.flankDeg > best.flankDeg ? p : best), points[0]),
    [points],
  );

  const resetForward = useCallback(() => setForwardAngle(-Math.PI / 2), []);

  // Drag handler to rotate forward vector
  const handlePointerDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - SVG_CENTER;
      const y = e.clientY - rect.top - SVG_CENTER;
      setForwardAngle(Math.atan2(y, x));
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Forward arrow endpoint
  const arrowLen = DRAW_RADIUS * 0.85;
  const arrowEndX = SVG_CENTER + Math.cos(forwardAngle) * arrowLen;
  const arrowEndY = SVG_CENTER + Math.sin(forwardAngle) * arrowLen;

  // Forward degrees for display (0=up, clockwise)
  const forwardDeg = ((forwardAngle * 180 / Math.PI) + 90 + 360) % 360;

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="flank-angle-heatmap">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_VIOLET }}><Crosshair className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">Flank Angle Scoring Heatmap</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">UEnvQueryTest_FlankAngle</code> overlay on attack ring
          </p>
        </div>
        <button
          onClick={resetForward}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`,
            color: ACCENT_VIOLET,
            border: `1px solid ${ACCENT_VIOLET}30`,
          }}
          title="Reset forward direction to north"
          data-testid="flank-angle-reset-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* SVG + side panel */}
      <div className="flex flex-col sm:flex-row">
        {/* SVG diagram */}
        <div className="flex items-center justify-center p-4" data-testid="flank-angle-svg-container">
          <svg
            ref={svgRef}
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="shrink-0 select-none"
            style={{ cursor: isDragging ? 'grabbing' : 'default' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Heatmap annular zone */}
            {heatmapArcs.map((arc, i) => (
              <path
                key={i}
                d={arcPath(
                  SVG_CENTER, SVG_CENTER,
                  DRAW_RADIUS * 0.65, DRAW_RADIUS,
                  arc.startAngle, arc.endAngle,
                )}
                fill={arc.color}
                fillOpacity={0.18}
                stroke={arc.color}
                strokeWidth={0.3}
                strokeOpacity={0.3}
              />
            ))}

            {/* Attack ring circle */}
            <circle
              cx={SVG_CENTER}
              cy={SVG_CENTER}
              r={DRAW_RADIUS}
              fill="none"
              stroke={ACCENT_VIOLET}
              strokeWidth={1}
              opacity={0.4}
            />

            {/* Degree markings */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const labelR = DRAW_RADIUS + 16;
              const lx = SVG_CENTER + Math.cos(rad) * labelR;
              const ly = SVG_CENTER + Math.sin(rad) * labelR;
              return (
                <text
                  key={deg}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[8px] font-mono fill-[var(--text-muted)]"
                  opacity={0.5}
                >
                  {deg}°
                </text>
              );
            })}

            {/* Target forward vector arrow (draggable) */}
            <line
              x1={SVG_CENTER}
              y1={SVG_CENTER}
              x2={arrowEndX}
              y2={arrowEndY}
              stroke={ACCENT_CYAN}
              strokeWidth={2.5}
              opacity={0.9}
              markerEnd="url(#fwd-arrow)"
            />
            <defs>
              <marker
                id="fwd-arrow"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill={ACCENT_CYAN} />
              </marker>
            </defs>

            {/* Draggable handle at arrow tip */}
            <circle
              cx={arrowEndX}
              cy={arrowEndY}
              r={10}
              fill={ACCENT_CYAN}
              fillOpacity={0.15}
              stroke={ACCENT_CYAN}
              strokeWidth={1.5}
              className="cursor-grab"
              onPointerDown={handlePointerDown}
              data-testid="flank-angle-drag-handle"
            />

            {/* "Forward" label near arrow */}
            <text
              x={SVG_CENTER + Math.cos(forwardAngle) * (arrowLen * 0.55)}
              y={SVG_CENTER + Math.sin(forwardAngle) * (arrowLen * 0.55) - 8}
              textAnchor="middle"
              className="text-[9px] font-mono font-bold"
              fill={ACCENT_CYAN}
              opacity={0.8}
            >
              Forward
            </text>

            {/* Target center crosshair */}
            <line
              x1={SVG_CENTER - 10} y1={SVG_CENTER}
              x2={SVG_CENTER + 10} y2={SVG_CENTER}
              stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6}
            />
            <line
              x1={SVG_CENTER} y1={SVG_CENTER - 10}
              x2={SVG_CENTER} y2={SVG_CENTER + 10}
              stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6}
            />
            <text
              x={SVG_CENTER}
              y={SVG_CENTER + 22}
              textAnchor="middle"
              className="text-[8px] font-mono"
              fill={ACCENT_CYAN}
              opacity={0.7}
            >
              Target
            </text>

            {/* Attack ring points with flank scoring */}
            {points.map((pt, i) => {
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              const isBest = pt === bestPoint;
              const isHovered = hoveredPoint === i;
              const baseR = isBest ? 7 : 5;
              const r = isHovered ? baseR + 2 : baseR;

              return (
                <g key={i}>
                  {/* Glow for best point */}
                  {isBest && (
                    <circle
                      cx={sx} cy={sy} r={12}
                      fill="none" stroke={pt.color}
                      strokeWidth={1} opacity={0.4}
                      strokeDasharray="3 2"
                    />
                  )}
                  {/* Point */}
                  <circle
                    cx={sx} cy={sy} r={r}
                    fill={pt.color}
                    fillOpacity={0.9}
                    stroke="var(--surface-deep)"
                    strokeWidth={1.5}
                    className="cursor-pointer transition-all"
                    onPointerEnter={() => setHoveredPoint(i)}
                    onPointerLeave={() => setHoveredPoint(null)}
                    data-testid={`flank-point-${i}`}
                  />
                  {/* Score label */}
                  <text
                    x={sx}
                    y={sy - (isHovered ? r + 6 : r + 4)}
                    textAnchor="middle"
                    className="text-[9px] font-mono font-bold"
                    fill={pt.color}
                    opacity={isHovered || isBest ? 1 : 0.7}
                  >
                    {Math.round(pt.flankDeg)}°
                  </text>
                </g>
              );
            })}

            {/* Hovered point detail tooltip */}
            {hoveredPoint !== null && (() => {
              const pt = points[hoveredPoint];
              const sx = SVG_CENTER + pt.x * scale;
              const sy = SVG_CENTER + pt.y * scale;
              const tooltipX = sx + (sx > SVG_CENTER ? -70 : 10);
              const tooltipY = sy + (sy > SVG_CENTER ? -40 : 10);

              return (
                <g>
                  <rect
                    x={tooltipX} y={tooltipY}
                    width={62} height={28}
                    rx={4}
                    fill="var(--surface-deep)"
                    stroke="var(--border)"
                    strokeWidth={0.5}
                    opacity={0.95}
                  />
                  <text x={tooltipX + 4} y={tooltipY + 12}
                    className="text-[8px] font-mono fill-[var(--text-muted)]"
                  >
                    Score: {pt.flankDeg.toFixed(1)}°
                  </text>
                  <text x={tooltipX + 4} y={tooltipY + 22}
                    className="text-[8px] font-mono font-bold" fill={pt.color}
                  >
                    {pt.flankDeg >= 135 ? 'Behind' : pt.flankDeg >= 45 ? 'Side' : 'Front'}
                  </text>
                </g>
              );
            })()}

            {/* Color gradient legend */}
            <defs>
              <linearGradient id="flank-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={flankColor(0)} />
                <stop offset="50%" stopColor={flankColor(90)} />
                <stop offset="100%" stopColor={flankColor(180)} />
              </linearGradient>
            </defs>
            <rect
              x={SVG_CENTER - 60} y={SVG_SIZE - 22}
              width={120} height={6} rx={3}
              fill="url(#flank-gradient)"
              opacity={0.8}
            />
            <text x={SVG_CENTER - 62} y={SVG_SIZE - 14} textAnchor="end" className="text-[7px] font-mono fill-[var(--text-muted)]">0° Front</text>
            <text x={SVG_CENTER + 62} y={SVG_SIZE - 14} textAnchor="start" className="text-[7px] font-mono fill-[var(--text-muted)]">180° Behind</text>
          </svg>
        </div>

        {/* Side panel */}
        <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-border/40 space-y-3 min-w-0">
          {/* Parameters */}
          <div>
            <h4 className="text-xs font-bold text-text mb-2">Generator + Test Parameters</h4>
            <div className="space-y-1.5">
              {[
                { label: 'AttackDistance', value: `${ATTACK_DISTANCE}.0`, desc: 'Ring radius' },
                { label: 'NumberOfPoints', value: String(NUMBER_OF_POINTS), desc: 'Evenly spaced' },
                { label: 'Forward', value: `${forwardDeg.toFixed(0)}°`, desc: 'Drag to rotate' },
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
            <h4 className="text-xs font-bold text-text mb-1.5">Scoring Algorithm</h4>
            <div className="text-2xs text-text-muted leading-relaxed space-y-1">
              <p className="font-mono" style={{ color: ACCENT_VIOLET }}>
                for each generated point:
              </p>
              <div className="pl-3 space-y-0.5">
                <p><span className="font-mono text-text">Dir</span> = normalize(Point - Target)</p>
                <p><span className="font-mono text-text">Dot</span> = dot(TargetForward, Dir)</p>
                <p><span className="font-mono text-text">Angle</span> = acos(clamp(Dot, -1, 1))</p>
                <p><span className="font-mono text-text">Score</span> = Angle in degrees (0-180)</p>
              </div>
              <p className="mt-1">
                <span className="font-mono text-text">SetWorkOnFloatValues(true)</span> → UE5 normalizes 0-180 to 0.0-1.0
              </p>
            </div>
          </div>

          {/* Score distribution */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5">Current Scores</h4>
            <div className="space-y-1">
              {points.map((pt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2"
                  onPointerEnter={() => setHoveredPoint(i)}
                  onPointerLeave={() => setHoveredPoint(null)}
                  data-testid={`flank-score-row-${i}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pt.color }}
                  />
                  <span className="text-2xs font-mono text-text-muted w-8 shrink-0">
                    P{i + 1}
                  </span>
                  <div className="flex-1 h-3 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        backgroundColor: pt.color,
                        width: `${(pt.flankDeg / 180) * 100}%`,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span
                    className="text-2xs font-mono font-bold w-8 text-right shrink-0"
                    style={{ color: pt.color }}
                  >
                    {Math.round(pt.flankDeg)}°
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Nav projection note */}
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
            data-testid="flank-angle-nav-note"
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Higher scores are <strong>preferred</strong> by default (behind = better flanking).
              The EQS normalizes 0-180° to 0.0-1.0, then <code className="font-mono">PathExists</code> filters
              unreachable points.
            </span>
          </div>

          {/* Interaction hint */}
          <div className="text-2xs text-text-muted italic">
            Drag the cyan arrow handle to rotate the target&apos;s forward direction and watch scores update in real-time.
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
