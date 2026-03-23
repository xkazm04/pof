'use client';

import { useState, useRef } from 'react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { survivalColor, type SensitivityCurve } from './data';

export function SensitivityChart({ curve, width, height, color }: {
  curve: SensitivityCurve; width: number; height: number; color: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pts = curve.points;
  if (pts.length < 2) return null;

  const xMin = pts[0].value;
  const xMax = pts[pts.length - 1].value;
  const yMin = 0;
  const yMax = 1;

  const pad = { l: 36, r: 8, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - ((v - yMin) / (yMax - yMin)) * h;

  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.value).toFixed(1)} ${toY(p.survivalRate).toFixed(1)}`)
    .join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(toX(pts[i].value) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const hp = hoveredIdx !== null ? pts[hoveredIdx] : null;

  return (
    <svg
      ref={svgRef} width={width} height={height}
      className="overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + h * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y}
              stroke="var(--color-border)" strokeOpacity={0.3} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end"
              className="text-2xs fill-text-muted">
              {(f * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Path + dots */}
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {pts.map((p, i) => (
        <circle key={i} cx={toX(p.value)} cy={toY(p.survivalRate)}
          r={hoveredIdx === i ? 5 : 2.5} fill={color}
          opacity={hoveredIdx === i ? 1 : 0.8} />
      ))}

      {/* Hover tooltip */}
      {hp && (() => {
        const hx = toX(hp.value);
        const onRight = hx < width / 2;
        return (
          <g>
            <line x1={hx} y1={pad.t} x2={hx} y2={pad.t + h}
              stroke={color} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6} />
            <foreignObject
              x={onRight ? hx + 8 : hx - 118}
              y={Math.min(toY(hp.survivalRate) - 10, pad.t + h - 58)}
              width={110} height={58}
            >
              <div className="bg-surface-1 border border-border rounded px-2 py-1 text-2xs font-mono shadow-lg"
                style={{ borderColor: `${color}40` }}>
                <div className="font-bold mb-0.5" style={{ color }}>
                  {curve.attribute}: {hp.value.toFixed(curve.attribute === 'critChance' ? 2 : 0)}
                </div>
                <div className="text-text-muted">
                  Survival: <span style={{ color: survivalColor(hp.survivalRate) }}>
                    {(hp.survivalRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-text-muted">
                  TTK: <span className="text-text">{hp.avgTTK.toFixed(1)}s</span>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}

      {/* Diminishing returns marker */}
      {curve.diminishingAt !== null && (
        <g>
          <line x1={toX(curve.diminishingAt)} y1={pad.t}
            x2={toX(curve.diminishingAt)} y2={pad.t + h}
            stroke={STATUS_WARNING} strokeDasharray="4 3" strokeWidth={1.5} />
          <text x={toX(curve.diminishingAt)} y={pad.t - 2}
            textAnchor="middle" className="text-2xs" fill={STATUS_WARNING}>
            DR
          </text>
        </g>
      )}

      {/* X labels */}
      {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, i) => (
        <text key={i} x={toX(p.value)} y={height - 2}
          textAnchor="middle" className="text-2xs fill-text-muted">
          {curve.attribute === 'critChance' ? (p.value * 100).toFixed(0) + '%' : p.value.toFixed(0)}
        </text>
      ))}
    </svg>
  );
}
