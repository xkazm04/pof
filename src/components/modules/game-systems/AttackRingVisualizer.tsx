'use client';

import { useState, useMemo, useCallback } from 'react';
import { Target, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';

// ── Real C++ defaults from EnvQueryGenerator_AttackPositions.h ──────────────

const DEFAULT_ATTACK_DISTANCE = 200;
const DEFAULT_NUMBER_OF_POINTS = 12;
const DEFAULT_INNER_RING = false;
const MIN_POINTS = 4;
const MAX_POINTS = 36;
const MIN_DISTANCE = 50;

// Nav projection from constructor
const PROJECT_DOWN = 500;
const PROJECT_UP = 100;

// SVG layout
const SVG_SIZE = 340;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_PADDING = 50;
const MAX_DRAW_RADIUS = (SVG_SIZE - SVG_PADDING * 2) / 2;

export function AttackRingVisualizer() {
  const [numPoints, setNumPoints] = useState(DEFAULT_NUMBER_OF_POINTS);
  const [attackDist, setAttackDist] = useState(DEFAULT_ATTACK_DISTANCE);
  const [innerRing, setInnerRing] = useState(DEFAULT_INNER_RING);

  const reset = useCallback(() => {
    setNumPoints(DEFAULT_NUMBER_OF_POINTS);
    setAttackDist(DEFAULT_ATTACK_DISTANCE);
    setInnerRing(DEFAULT_INNER_RING);
  }, []);

  // Scale: map attack distance to SVG radius (200 units = MAX_DRAW_RADIUS)
  const scale = MAX_DRAW_RADIUS / 300; // 300 units fits at max radius
  const outerR = attackDist * scale;
  const innerR = (attackDist * 0.5) * scale;

  const outerPoints = useMemo(() => {
    const pts: { x: number; y: number; angle: number }[] = [];
    const step = (2 * Math.PI) / numPoints;
    for (let i = 0; i < numPoints; i++) {
      const angle = step * i;
      pts.push({
        x: SVG_CENTER + Math.cos(angle) * outerR,
        y: SVG_CENTER + Math.sin(angle) * outerR,
        angle: (angle * 180) / Math.PI,
      });
    }
    return pts;
  }, [numPoints, outerR]);

  const innerPoints = useMemo(() => {
    if (!innerRing) return [];
    const pts: { x: number; y: number; angle: number }[] = [];
    const step = (2 * Math.PI) / numPoints;
    for (let i = 0; i < numPoints; i++) {
      const angle = step * i;
      pts.push({
        x: SVG_CENTER + Math.cos(angle) * innerR,
        y: SVG_CENTER + Math.sin(angle) * innerR,
        angle: (angle * 180) / Math.PI,
      });
    }
    return pts;
  }, [numPoints, innerR, innerRing]);

  const totalPoints = numPoints * (innerRing ? 2 : 1);

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden" data-testid="attack-ring-visualizer">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT_CYAN}08` }} />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}>
            <Target className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          </span>
          <div>
            <div className="text-sm font-bold text-text">Attack Ring Positions</div>
            <div className="text-xs font-mono text-text-muted">UEnvQueryGenerator_AttackPositions — real C++ defaults</div>
          </div>
          <button
            onClick={reset}
            className="ml-auto text-xs font-mono flex items-center gap-1 px-2 py-1 rounded border border-border/40 text-text-muted hover:text-text transition-colors"
            data-testid="attack-ring-reset"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 mt-2">
          {/* SVG Visualization */}
          <div className="flex-1 flex justify-center">
            <svg
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="rounded-lg border border-border/30 bg-surface-deep/50"
              data-testid="attack-ring-svg"
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map(f => (
                <circle
                  key={f}
                  cx={SVG_CENTER}
                  cy={SVG_CENTER}
                  r={MAX_DRAW_RADIUS * f}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
              ))}
              {/* Crosshair */}
              <line x1={SVG_PADDING} y1={SVG_CENTER} x2={SVG_SIZE - SVG_PADDING} y2={SVG_CENTER} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <line x1={SVG_CENTER} y1={SVG_PADDING} x2={SVG_CENTER} y2={SVG_SIZE - SVG_PADDING} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

              {/* Outer ring circle */}
              <circle
                cx={SVG_CENTER}
                cy={SVG_CENTER}
                r={outerR}
                fill="none"
                stroke={ACCENT_CYAN}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                opacity={0.5}
              />

              {/* Inner ring circle (when enabled) */}
              {innerRing && (
                <circle
                  cx={SVG_CENTER}
                  cy={SVG_CENTER}
                  r={innerR}
                  fill="none"
                  stroke={ACCENT_VIOLET}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.5}
                />
              )}

              {/* Outer ring points */}
              {outerPoints.map((pt, i) => (
                <g key={`outer-${i}`}>
                  {/* Line from center to point */}
                  <line
                    x1={SVG_CENTER}
                    y1={SVG_CENTER}
                    x2={pt.x}
                    y2={pt.y}
                    stroke={ACCENT_CYAN}
                    strokeWidth={0.5}
                    opacity={0.15}
                  />
                  {/* Point dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill={ACCENT_CYAN}
                    opacity={0.8}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={7}
                    fill={ACCENT_CYAN}
                    opacity={0.15}
                  />
                </g>
              ))}

              {/* Inner ring points */}
              {innerPoints.map((pt, i) => (
                <g key={`inner-${i}`}>
                  <line
                    x1={SVG_CENTER}
                    y1={SVG_CENTER}
                    x2={pt.x}
                    y2={pt.y}
                    stroke={ACCENT_VIOLET}
                    strokeWidth={0.5}
                    opacity={0.1}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3}
                    fill={ACCENT_VIOLET}
                    opacity={0.7}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill={ACCENT_VIOLET}
                    opacity={0.12}
                  />
                </g>
              ))}

              {/* Center target actor */}
              <circle cx={SVG_CENTER} cy={SVG_CENTER} r={8} fill={ACCENT_ORANGE} opacity={0.3} />
              <circle cx={SVG_CENTER} cy={SVG_CENTER} r={4} fill={ACCENT_ORANGE} opacity={0.8} />
              <text
                x={SVG_CENTER}
                y={SVG_CENTER - 14}
                textAnchor="middle"
                className="text-[11px] font-mono font-bold"
                fill={ACCENT_ORANGE}
              >
                TargetActor
              </text>

              {/* Distance labels */}
              <text
                x={SVG_CENTER + outerR + 4}
                y={SVG_CENTER - 4}
                className="text-[11px] font-mono"
                fill={ACCENT_CYAN}
                opacity={0.7}
              >
                {attackDist}u
              </text>
              {innerRing && (
                <text
                  x={SVG_CENTER + innerR + 4}
                  y={SVG_CENTER + 10}
                  className="text-[11px] font-mono"
                  fill={ACCENT_VIOLET}
                  opacity={0.7}
                >
                  {Math.round(attackDist * 0.5)}u
                </text>
              )}

              {/* Total points badge */}
              <rect x={4} y={4} width={70} height={20} rx={4} fill="rgba(0,0,0,0.5)" />
              <text x={8} y={17} className="text-[11px] font-mono font-bold" fill={ACCENT_CYAN}>
                {totalPoints} pts
              </text>
            </svg>
          </div>

          {/* Controls panel */}
          <div className="w-full xl:w-56 space-y-3 flex-shrink-0">
            {/* NumberOfPoints slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-text-muted">NumberOfPoints</span>
                <span className="text-xs font-mono font-bold" style={{ color: ACCENT_CYAN }}>{numPoints}</span>
              </div>
              <input
                type="range"
                min={MIN_POINTS}
                max={MAX_POINTS}
                step={1}
                value={numPoints}
                onChange={e => setNumPoints(Number(e.target.value))}
                data-testid="attack-ring-num-points"
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${ACCENT_CYAN} 0%, ${ACCENT_CYAN} ${((numPoints - MIN_POINTS) / (MAX_POINTS - MIN_POINTS)) * 100}%, rgba(255,255,255,0.1) ${((numPoints - MIN_POINTS) / (MAX_POINTS - MIN_POINTS)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-[11px] font-mono text-text-muted mt-0.5">
                <span>{MIN_POINTS}</span>
                <span>ClampMin={MIN_POINTS}, ClampMax={MAX_POINTS}</span>
                <span>{MAX_POINTS}</span>
              </div>
            </div>

            {/* AttackDistance slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-text-muted">AttackDistance</span>
                <span className="text-xs font-mono font-bold" style={{ color: ACCENT_CYAN }}>{attackDist}u</span>
              </div>
              <input
                type="range"
                min={MIN_DISTANCE}
                max={500}
                step={10}
                value={attackDist}
                onChange={e => setAttackDist(Number(e.target.value))}
                data-testid="attack-ring-distance"
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${ACCENT_CYAN} 0%, ${ACCENT_CYAN} ${((attackDist - MIN_DISTANCE) / (500 - MIN_DISTANCE)) * 100}%, rgba(255,255,255,0.1) ${((attackDist - MIN_DISTANCE) / (500 - MIN_DISTANCE)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-[11px] font-mono text-text-muted mt-0.5">
                <span>{MIN_DISTANCE}</span>
                <span>ClampMin={MIN_DISTANCE}</span>
                <span>500</span>
              </div>
            </div>

            {/* Inner ring toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-text-muted">bGenerateInnerRing</div>
                <div className="text-[11px] text-text-muted">Inner ring at {Math.round(attackDist * 0.5)}u (50%)</div>
              </div>
              <button
                onClick={() => setInnerRing(v => !v)}
                data-testid="attack-ring-inner-toggle"
                className="text-xs font-mono font-bold px-2.5 py-1 rounded border transition-all"
                style={{
                  backgroundColor: innerRing ? `${ACCENT_VIOLET}${OPACITY_20}` : 'transparent',
                  color: innerRing ? ACCENT_VIOLET : 'var(--text-muted)',
                  borderColor: innerRing ? `${ACCENT_VIOLET}50` : 'var(--border)',
                }}
              >
                {innerRing ? 'true' : 'false'}
              </button>
            </div>

            {/* Nav Projection info */}
            <div className="rounded-lg border border-border/30 p-2 bg-surface-deep/50">
              <div className="text-xs font-mono font-bold text-text mb-1.5">Nav Projection</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted">TraceMode</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_SUCCESS }}>Navigation</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted">ProjectDown</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_WARNING }}>{PROJECT_DOWN}u</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted">ProjectUp</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_WARNING }}>{PROJECT_UP}u</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted">bCanProjectDown</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_SUCCESS }}>true</span>
                </div>
              </div>
              {/* Height band indicator */}
              <div className="mt-2 relative h-10 rounded border border-border/20 bg-surface overflow-hidden">
                <div className="absolute inset-x-0 text-center" style={{ top: '15%' }}>
                  <div className="h-px w-full" style={{ backgroundColor: `${STATUS_WARNING}40` }} />
                  <span className="text-[11px] font-mono" style={{ color: STATUS_WARNING }}>+{PROJECT_UP}u</span>
                </div>
                <div className="absolute inset-x-0 text-center" style={{ top: '40%' }}>
                  <div className="h-px w-full" style={{ backgroundColor: `${STATUS_SUCCESS}60` }} />
                  <span className="text-[11px] font-mono" style={{ color: STATUS_SUCCESS }}>Ground (0)</span>
                </div>
                <div className="absolute inset-x-0 text-center" style={{ top: '80%' }}>
                  <div className="h-px w-full" style={{ backgroundColor: `${STATUS_WARNING}40` }} />
                  <span className="text-[11px] font-mono" style={{ color: STATUS_WARNING }}>-{PROJECT_DOWN}u</span>
                </div>
              </div>
            </div>

            {/* UPROPERTY summary */}
            <div className="rounded-lg border border-border/30 p-2 bg-surface-deep/50">
              <div className="text-xs font-mono font-bold text-text mb-1.5">C++ Properties</div>
              {[
                { name: 'CenterContext', value: 'TargetActor', type: 'TSubclassOf<UEnvQueryContext>' },
                { name: 'AttackDistance', value: `${attackDist}.f`, type: 'float' },
                { name: 'NumberOfPoints', value: `${numPoints}`, type: 'int32' },
                { name: 'bGenerateInnerRing', value: innerRing ? 'true' : 'false', type: 'bool' },
              ].map(prop => (
                <div key={prop.name} className="flex items-center gap-1.5 py-0.5">
                  <span className="text-[11px] font-mono text-text-muted flex-1 truncate">{prop.name}</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: ACCENT_CYAN }}>{prop.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
