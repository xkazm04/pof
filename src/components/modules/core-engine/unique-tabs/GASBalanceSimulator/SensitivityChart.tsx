'use client';

import { useState, useRef, useEffect } from 'react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { SensitivityResult } from './data';

const SENSITIVITY_ASPECT = 0.4;
const SENSITIVITY_MIN_H = 100;

/** SVG sensitivity curve chart with hover crosshair and diminishing-returns marker */
export function SensitivityChart({ result, color }: {
  result: SensitivityResult;
  color: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => { setContainerW(entry.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = result.points;
  if (pts.length < 2) return <div ref={containerRef} className="w-full" style={{ minHeight: SENSITIVITY_MIN_H }} />;

  const width = Math.max(containerW, 120);
  const height = Math.max(Math.round(width * SENSITIVITY_ASPECT), SENSITIVITY_MIN_H);

  const xMin = pts[0].value;
  const xMax = pts[pts.length - 1].value;
  const yMin = Math.min(...pts.map(p => p.dps));
  const yMax = Math.max(...pts.map(p => p.dps));
  const yRange = yMax - yMin || 1;

  const pad = { l: 40, r: 8, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - ((v - yMin) / yRange) * h;

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.value).toFixed(1)} ${toY(p.dps).toFixed(1)}`).join(' ');

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
  const hx = hp ? toX(hp.value) : 0;
  const tooltipOnRight = hp ? hx < width / 2 : true;

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: SENSITIVITY_MIN_H }}>
      {containerW > 0 && (
        <svg ref={svgRef} width={width} height={height} className="overflow-visible"
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = pad.t + h * (1 - f);
            const v = yMin + yRange * f;
            return (
              <g key={f}>
                <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.3} />
                <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">{v.toFixed(0)}</text>
              </g>
            );
          })}
          {/* DPS curve */}
          <path d={path} fill="none" stroke={color} strokeWidth={2} />
          {/* Points */}
          {pts.map((p, i) => (
            <circle key={i} cx={toX(p.value)} cy={toY(p.dps)} r={hoveredIdx === i ? 5 : 2.5} fill={color} opacity={hoveredIdx === i ? 1 : 0.8} />
          ))}
          {/* Hover crosshair + tooltip */}
          {hp && (
            <g>
              <line x1={hx} y1={pad.t} x2={hx} y2={pad.t + h}
                stroke={color} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6} />
              <foreignObject x={tooltipOnRight ? hx + 8 : hx - 118}
                y={Math.min(toY(hp.dps) - 10, pad.t + h - 68)} width={110} height={68}>
                <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-2xs font-mono shadow-lg" style={{ borderColor: `${color}40` }}>
                  <div className="font-bold mb-0.5" style={{ color }}>{result.attribute}: {hp.value.toFixed(0)}</div>
                  <div className="text-text-muted">DPS: <span className="text-text">{hp.dps.toFixed(1)}</span></div>
                  <div className="text-text-muted">TTK: <span className="text-text">{hp.ttk.toFixed(2)}s</span></div>
                  <div className="text-text-muted">EHP: <span className="text-text">{hp.ehp.toFixed(0)}</span></div>
                </div>
              </foreignObject>
            </g>
          )}
          {/* Diminishing returns marker */}
          {result.diminishingAt !== null && (
            <g>
              <line x1={toX(result.diminishingAt)} y1={pad.t} x2={toX(result.diminishingAt)} y2={pad.t + h}
                stroke={STATUS_WARNING} strokeDasharray="4 3" strokeWidth={1.5} />
              <text x={toX(result.diminishingAt)} y={pad.t - 2} textAnchor="middle" className="text-2xs" fill={STATUS_WARNING}>DR</text>
            </g>
          )}
          {/* X axis labels */}
          {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, i) => (
            <text key={i} x={toX(p.value)} y={height - 2} textAnchor="middle" className="text-2xs fill-text-muted">{p.value.toFixed(0)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}
