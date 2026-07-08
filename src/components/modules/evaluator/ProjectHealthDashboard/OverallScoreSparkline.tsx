import type { EvaluatorReport } from '@/types/evaluator';

export function OverallScoreSparkline({ scanHistory, accent }: { scanHistory: EvaluatorReport[]; accent: string }) {
  if (scanHistory.length < 2) return null;

  const w = 300;
  const h = 32;
  const pad = 4;
  const scores = scanHistory.map((s) => s.overallScore);
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const range = max - min || 1;

  const points = scores.map((s, i) => ({
    x: pad + (i / (scores.length - 1)) * (w - pad * 2),
    y: h - pad - ((s - min) / range) * (h - pad * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg width={w} height={h} className="w-full">
      <defs>
        <linearGradient id="overall-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
        fill="url(#overall-sparkline-fill)"
      />
      <path d={pathD} fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill={accent} />
    </svg>
  );
}
