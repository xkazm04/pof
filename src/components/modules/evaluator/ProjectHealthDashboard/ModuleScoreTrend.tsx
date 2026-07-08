import { useMemo } from 'react';
import type { EvaluatorReport } from '@/types/evaluator';
import type { SubModuleId } from '@/types/modules';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';

export function ModuleScoreTrend({ moduleId, scanHistory }: { moduleId: SubModuleId; scanHistory: EvaluatorReport[] }) {
  const points = useMemo(() => {
    return scanHistory
      .map((scan) => {
        const ms = scan.moduleScores.find((m) => m.moduleId === moduleId);
        return ms ? { score: ms.score, timestamp: scan.timestamp } : null;
      })
      .filter((p): p is { score: number; timestamp: number } => p !== null);
  }, [moduleId, scanHistory]);

  if (points.length < 2) return null;

  const w = 200;
  const h = 40;
  const pad = 4;
  const min = Math.max(0, Math.min(...points.map((p) => p.score)) - 10);
  const max = Math.min(100, Math.max(...points.map((p) => p.score)) + 10);
  const range = max - min || 1;

  const svgPoints = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: h - pad - ((p.score - min) / range) * (h - pad * 2),
  }));

  const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.score - first.score;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Score Trend</span>
        <span
          className="text-2xs font-medium"
          style={{ color: delta > 0 ? STATUS_SUCCESS : delta < 0 ? STATUS_ERROR : 'var(--text-muted)' }}
        >
          {delta > 0 ? '+' : ''}{delta} over {points.length} scans
        </span>
      </div>
      <svg width={w} height={h} className="w-full">
        <defs>
          <linearGradient id="module-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EVAL_ACCENT} stopOpacity="0.2" />
            <stop offset="100%" stopColor={EVAL_ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L${svgPoints[svgPoints.length - 1].x},${h} L${svgPoints[0].x},${h} Z`}
          fill="url(#module-trend-fill)"
        />
        <path d={pathD} fill="none" stroke={EVAL_ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {svgPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill={EVAL_ACCENT} />
        ))}
      </svg>
    </div>
  );
}
