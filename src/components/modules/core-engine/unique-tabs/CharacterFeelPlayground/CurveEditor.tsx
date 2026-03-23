'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { OPACITY_10, OVERLAY_WHITE } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { CurvePoint } from './types';
import { SVG_W, SVG_H, PAD, PLOT_W, PLOT_H } from './types';

/* ── Draggable SVG Curve Component ────────────────────────────────────────── */

interface CurveEditorProps {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  xLabel: string;
  yLabel: string;
  /** Which point indices are draggable (first and last usually locked) */
  draggableIndices?: number[];
}

export function CurveEditor({
  label, icon: Icon, color, points, onChange, xLabel, yLabel,
  draggableIndices,
}: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const dragIds = draggableIndices ?? points.map((_, i) => i).filter(i => i > 0 && i < points.length - 1);

  const toSvg = useCallback((p: CurvePoint) => ({
    x: PAD.left + p.x * PLOT_W,
    y: PAD.top + (1 - p.y) * PLOT_H,
  }), []);

  const fromSvg = useCallback((sx: number, sy: number): CurvePoint => ({
    x: Math.max(0, Math.min(1, (sx - PAD.left) / PLOT_W)),
    y: Math.max(0, Math.min(1, 1 - (sy - PAD.top) / PLOT_H)),
  }), []);

  const handlePointerDown = useCallback((idx: number) => (e: React.PointerEvent) => {
    if (!dragIds.includes(idx)) return;
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
  }, [dragIds]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const newPt = fromSvg(sx, sy);

    // Constrain X between neighbors
    const prev = points[draggingIdx - 1];
    const next = points[draggingIdx + 1];
    if (prev) newPt.x = Math.max(prev.x + 0.02, newPt.x);
    if (next) newPt.x = Math.min(next.x - 0.02, newPt.x);

    const updated = [...points];
    updated[draggingIdx] = newPt;
    onChange(updated);
  }, [draggingIdx, points, onChange, fromSvg]);

  const handlePointerUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  // Build smooth path
  const pathD = useMemo(() => {
    const svgPts = points.map(toSvg);
    if (svgPts.length < 2) return '';
    let d = `M ${svgPts[0].x},${svgPts[0].y}`;
    for (let i = 1; i < svgPts.length; i++) {
      const p0 = svgPts[Math.max(0, i - 2)];
      const p1 = svgPts[i - 1];
      const p2 = svgPts[i];
      const p3 = svgPts[Math.min(svgPts.length - 1, i + 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [points, toSvg]);

  // Fill area path
  const areaD = useMemo(() => {
    if (!pathD) return '';
    const bottomY = PAD.top + PLOT_H;
    const svgPts = points.map(toSvg);
    return `${pathD} L ${svgPts[svgPts.length - 1].x},${bottomY} L ${svgPts[0].x},${bottomY} Z`;
  }, [pathD, points, toSvg]);

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader label={label} color={color} icon={Icon} />
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="overflow-visible cursor-crosshair select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = PAD.top + (1 - t) * PLOT_H;
          return (
            <line key={`gy-${t}`} x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const x = PAD.left + t * PLOT_W;
          return (
            <line key={`gx-${t}`} x1={x} y1={PAD.top} x2={x} y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          );
        })}

        {/* Axis labels */}
        <text x={PAD.left + PLOT_W / 2} y={SVG_H - 2} textAnchor="middle"
          className="text-[9px] font-mono" fill="var(--text-muted)" style={{ fontSize: 9 }}>{xLabel}</text>
        <text x={8} y={PAD.top + PLOT_H / 2} textAnchor="middle"
          className="text-[9px] font-mono" fill="var(--text-muted)" style={{ fontSize: 9 }}
          transform={`rotate(-90, 8, ${PAD.top + PLOT_H / 2})`}>{yLabel}</text>

        {/* Area fill */}
        <path d={areaD} fill={`${color}${OPACITY_10}`} />

        {/* Curve */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />

        {/* Control points */}
        {points.map((pt, i) => {
          const sp = toSvg(pt);
          const isDraggable = dragIds.includes(i);
          const isActive = draggingIdx === i;
          return (
            <g key={i}>
              {isDraggable && (
                <circle cx={sp.x} cy={sp.y} r={12} fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={handlePointerDown(i)} />
              )}
              <circle cx={sp.x} cy={sp.y}
                r={isDraggable ? (isActive ? 6 : 5) : 3}
                fill={isDraggable ? color : `${color}80`}
                stroke={isActive ? OVERLAY_WHITE : 'none'}
                strokeWidth={isActive ? 2 : 0}
                style={{
                  filter: isDraggable ? `drop-shadow(0 0 4px ${color})` : undefined,
                  transition: 'r 0.15s ease',
                }}
                className={isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
                onPointerDown={isDraggable ? handlePointerDown(i) : undefined}
              />
              {isActive && (
                <g>
                  <rect x={sp.x - 28} y={sp.y - 24} width={56} height={16} rx={4}
                    fill="rgba(0,0,0,0.8)" stroke={color} strokeWidth="0.5" />
                  <text x={sp.x} y={sp.y - 13} textAnchor="middle"
                    fill={color} className="text-[8px] font-mono font-bold" style={{ fontSize: 8 }}>
                    {pt.x.toFixed(2)}, {pt.y.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </BlueprintPanel>
  );
}
