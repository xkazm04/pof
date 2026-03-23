'use client';

import { useState } from 'react';
import { ACCENT_RED, STATUS_SUCCESS, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { DifficultyPoint } from './data';

interface DifficultySeriesItem {
  label: string;
  data: DifficultyPoint[];
  color: string;
}

interface DifficultyChartProps {
  series: DifficultySeriesItem[];
  accent?: string;
}

const CHART_W = 280, CHART_H = 120, PAD_L = 30, PAD_B = 20;
const PLOT_W = CHART_W - PAD_L - 10;
const PLOT_H = CHART_H - PAD_B - 10;

function toX(level: number) { return PAD_L + ((level - 1) / 49) * PLOT_W; }
function toY(value: number) { return 10 + PLOT_H * (1 - value / 100); }
function polyline(pts: DifficultyPoint[]) { return pts.map(p => `${toX(p.level)},${toY(p.value)}`).join(' '); }

export function DifficultyChart({ series }: DifficultyChartProps) {
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);

  return (
    <div className="min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
      <svg width={CHART_W} height={200} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full max-w-[280px]"
        onMouseLeave={() => setHoverLevel(null)}
      >
        {/* Zones */}
        <rect x={PAD_L} y={toY(100)} width={PLOT_W} height={toY(70) - toY(100)} fill="rgba(239,68,68,0.08)" />
        <rect x={PAD_L} y={toY(70)} width={PLOT_W} height={toY(40) - toY(70)} fill="rgba(74,222,128,0.08)" />
        <rect x={PAD_L} y={toY(40)} width={PLOT_W} height={toY(0) - toY(40)} fill="rgba(107,114,128,0.06)" />
        {/* Zone labels */}
        <text x={PAD_L + 3} y={toY(88)} className="text-[11px] font-mono fill-[rgba(239,68,68,0.5)]" style={{ fontSize: 11 }}>DANGER</text>
        <text x={PAD_L + 3} y={toY(55)} className="text-[11px] font-mono fill-[rgba(74,222,128,0.5)]" style={{ fontSize: 11 }}>SWEET SPOT</text>
        <text x={PAD_L + 3} y={toY(20)} className="text-[11px] font-mono fill-[rgba(107,114,128,0.4)]" style={{ fontSize: 11 }}>TRIVIAL</text>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <line key={v} x1={PAD_L} y1={toY(v)} x2={PAD_L + PLOT_W} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        {/* X axis labels */}
        {[1, 10, 20, 30, 40, 50].map(l => (
          <text key={l} x={toX(l)} y={CHART_H - 3} textAnchor="middle" className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>Lv{l}</text>
        ))}
        {/* Lines */}
        {series.map(s => (
          <polyline key={s.label} points={polyline(s.data)} fill="none" stroke={s.color} strokeWidth="1.5" />
        ))}
        {/* Hover line + floating tooltip */}
        {hoverLevel !== null && (() => {
          const hx = toX(hoverLevel);
          const nearest = (pts: DifficultyPoint[]) => pts.reduce((a, b) => Math.abs(b.level - hoverLevel) < Math.abs(a.level - hoverLevel) ? b : a).value;
          const archetypes = series.map(s => ({ label: s.label, value: nearest(s.data), color: s.color }));
          const getZone = (v: number) => v >= 70 ? { label: 'DANGER', color: ACCENT_RED } : v >= 40 ? { label: 'SWEET SPOT', color: STATUS_SUCCESS } : { label: 'TRIVIAL', color: STATUS_NEUTRAL };
          const tooltipW = 90;
          const flipLeft = hx + tooltipW + 6 > CHART_W - 10;
          const tx = flipLeft ? hx - tooltipW - 6 : hx + 6;
          return (
            <g>
              <line x1={hx} y1={10} x2={hx} y2={CHART_H - PAD_B} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
              {archetypes.map(a => (
                <circle key={a.label} cx={hx} cy={toY(a.value)} r={2.5} fill={a.color} />
              ))}
              <foreignObject x={tx} y={12} width={tooltipW} height={PLOT_H - 4} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 6px', fontSize: 11, lineHeight: 1.5 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>Lv {hoverLevel}</div>
                  {archetypes.map(a => {
                    const zone = getZone(a.value);
                    return (
                      <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ background: `${a.color}25`, color: a.color, borderRadius: 3, padding: '0 4px', fontFamily: 'monospace', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {a.label}: {a.value}
                        </span>
                        <span style={{ color: zone.color, fontSize: 11, fontFamily: 'monospace', opacity: 0.8 }}>{zone.label}</span>
                      </div>
                    );
                  })}
                </div>
              </foreignObject>
            </g>
          );
        })()}
        {/* Invisible hover rects for interaction */}
        {Array.from({ length: 50 }, (_, i) => i + 1).map(level => (
          <rect
            key={level}
            x={toX(level) - (PLOT_W / 49) / 2}
            y={10}
            width={PLOT_W / 49}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHoverLevel(level)}
          />
        ))}
      </svg>
      <div className="flex gap-3 mt-2">
        {series.map(s => (
          <span key={s.label} className="flex items-center gap-1 text-xs font-mono text-text-muted">
            <span className="w-3 h-[2px] flex-shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
