'use client';

import { useMemo } from 'react';
import { ACCENT_CYAN, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, OVERLAY_WHITE, OPACITY_6, withOpacity } from '@/lib/chart-colors';
import { usePityCohort } from './usePityCohort';
import { cohortPercentiles } from './pityCohort';

interface PityCohortChartProps {
  rate: number;
  /** null = pity off. */
  threshold: number | null;
  color: string;
}

const W = 400, H = 120, LEFT = 40, RIGHT = 390, BASE = 100, TOP = 14, BINS = 40;

export function PityCohortChart({ rate, threshold, color }: PityCohortChartProps) {
  const { result, pending } = usePityCohort({ rate, threshold });

  const view = useMemo(() => {
    if (!result) return null;
    const { pity } = result;
    const max = Math.max(1, pity.kills[pity.kills.length - 1] ?? 1);
    const binW = Math.max(1, Math.ceil(max / BINS));
    const nBins = Math.ceil(max / binW);
    const counts = new Array<number>(nBins).fill(0);
    for (const k of pity.kills) counts[Math.min(nBins - 1, Math.floor((k - 1) / binW))]++;
    // Analytic mass per bin; hard pity piles the whole tail onto the threshold kill.
    const analytic = counts.map((_, b) => {
      let m = 0;
      for (let n = b * binW + 1; n <= Math.min(max, (b + 1) * binW); n++) {
        if (threshold !== null && n === threshold) m += Math.pow(1 - rate, threshold - 1);
        else if (threshold === null || n < threshold) m += Math.pow(1 - rate, n - 1) * rate;
      }
      return m * pity.kills.length;
    });
    const peak = Math.max(1, ...counts, ...analytic);
    return { max, nBins, counts, analytic, peak };
  }, [result, rate, threshold]);

  if (!result || !view) {
    return <div className="mt-2 text-2xs font-mono text-text-muted">Simulating 5,000 players...</div>;
  }

  const x = (kill: number) => LEFT + (kill / view.max) * (RIGHT - LEFT);
  const y = (c: number) => BASE - (c / view.peak) * (BASE - TOP);
  const bw = (RIGHT - LEFT) / view.nBins;
  const [p50, p95, p99] = result.percentiles;
  const { benefit, drift, noPity } = result;
  const [noP99] = cohortPercentiles(noPity.kills, [99]);

  return (
    <div className="mt-2 relative bg-surface-deep/30 rounded-lg p-2" style={{ opacity: pending ? 0.6 : 1 }}>
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">
        {`Simulated time to first drop (${result.pity.kills.length.toLocaleString()} players)`}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Histogram of kills to first drop for ${result.pity.kills.length} simulated players with the analytic distribution overlaid`}>
        <title>Simulated drought distribution</title>
        <line x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} />
        {view.counts.map((c, i) => (
          <rect key={i} x={LEFT + i * bw} y={y(c)} width={Math.max(bw - 1, 0.5)} height={BASE - y(c)} fill={color} opacity={0.55} />
        ))}
        <polyline fill="none" stroke={ACCENT_CYAN} strokeWidth="1.5"
          points={view.analytic.map((a, i) => `${LEFT + (i + 0.5) * bw},${y(a)}`).join(' ')} />
        {[
          { label: 'P50', v: p50, c: ACCENT_CYAN },
          { label: 'P95', v: p95, c: STATUS_WARNING },
          { label: 'P99', v: p99, c: STATUS_ERROR },
        ].filter((m) => m.v !== null).map((m) => (
          <g key={m.label}>
            <line x1={x(m.v!)} y1={TOP} x2={x(m.v!)} y2={BASE} stroke={m.c} strokeDasharray="3 2" />
            <text x={x(m.v!)} y={TOP - 3} textAnchor="middle" className="text-xs font-mono font-bold" fill={m.c}>{m.label} {m.v}</text>
          </g>
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={x(view.max * f)} y={H - 6} textAnchor="middle" className="text-xs font-mono" fill="var(--text-muted)">{Math.round(view.max * f)}</text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 mt-1 text-2xs font-mono text-text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm opacity-60" style={{ backgroundColor: color }} /> Simulated</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{ backgroundColor: ACCENT_CYAN }} /> Analytic</span>
        <span style={{ color: drift.ok ? STATUS_SUCCESS : STATUS_WARNING }}>
          {`P95 sim ${drift.observedP95 ?? '-'} vs analytic ${drift.analyticP95}${drift.ok ? '' : ' (drift)'}`}
        </span>
      </div>
      {threshold !== null && (
        <div className="mt-1 text-2xs font-mono text-text-muted">
          {benefit.playersHelpedPct < 1
            ? `Pity @ ${threshold} is above the no-pity P99 (${noP99}): under 1% of players ever reach it.`
            : `Pity @ ${threshold} helps ${benefit.playersHelpedPct.toFixed(1)}% of players; P99 ${benefit.p99Saved} kills shorter, worst case ${benefit.worstCaseSaved} shorter.`}
        </div>
      )}
      {result.pity.capped && (
        <div className="mt-1 text-2xs font-mono" style={{ color: STATUS_WARNING }}>Some players hit the simulation cap without a drop.</div>
      )}
    </div>
  );
}
