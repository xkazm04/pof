'use client';

import { useMemo } from 'react';
import { mcStats, buildBins } from './monte-carlo-utils';

export function Histogram({ vals, color }: { vals: number[]; color: string }) {
  const binCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(vals.length))));
  const bins = useMemo(() => buildBins(vals, binCount), [vals, binCount]);
  const stats = useMemo(() => mcStats(vals), [vals]);
  const maxN = Math.max(...bins.map(b => b.n), 1);

  const W = 280, H = 90, PL = 28, PR = 8, PT = 12, PB = 16;
  const cW = W - PL - PR, cH = H - PT - PB;
  const barW = cW / bins.length;
  const lo = bins[0].lo, hi = bins[bins.length - 1].hi, range = hi - lo || 1;
  const toX = (v: number) => PL + ((v - lo) / range) * cW;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Stddev band */}
      <rect x={toX(stats.mean - stats.stddev)} y={PT} width={Math.max(toX(stats.mean + stats.stddev) - toX(stats.mean - stats.stddev), 0)} height={cH} fill={color} opacity={0.08} />
      {/* Bars */}
      {bins.map((bin, i) => {
        const bh = (bin.n / maxN) * cH;
        return (
          <rect key={i} x={PL + i * barW + 1} y={PT + cH - bh} width={Math.max(barW - 2, 1)} height={bh} fill={color} opacity={0.65} rx={1}>
            <title>{bin.lo.toFixed(0)}–{bin.hi.toFixed(0)}: {bin.n} runs</title>
          </rect>
        );
      })}
      {/* Curve overlay */}
      {bins.length > 2 && (
        <path
          d={bins.map((bin, i) => {
            const cx = PL + (i + 0.5) * barW;
            const cy = PT + cH - (bin.n / maxN) * cH;
            return `${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
          }).join(' ')}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.9}
        />
      )}
      {/* Mean line */}
      <line x1={toX(stats.mean)} y1={PT} x2={toX(stats.mean)} y2={PT + cH} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={toX(stats.mean)} y={PT - 2} textAnchor="middle" className="text-[8px] font-mono" fill={color}>μ={stats.mean.toFixed(1)}</text>
      {/* Median line */}
      <line x1={toX(stats.median)} y1={PT} x2={toX(stats.median)} y2={PT + cH} stroke="white" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
      {/* Axis labels */}
      <text x={PL} y={H - 2} className="text-[8px] font-mono" fill="var(--text-muted)">{lo.toFixed(0)}</text>
      <text x={W - PR} y={H - 2} textAnchor="end" className="text-[8px] font-mono" fill="var(--text-muted)">{hi.toFixed(0)}</text>
      <text x={PL - 2} y={PT + 8} textAnchor="end" className="text-[8px] font-mono" fill="var(--text-muted)">{maxN}</text>
    </svg>
  );
}
