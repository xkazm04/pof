import { useId } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';

export function QualitySparkline({
  snapshots,
  accentColor,
}: {
  snapshots: ReviewSnapshot[];
  accentColor: string;
}) {
  // Per-instance unique gradient id. Deriving it from the accent color alone
  // collided across concurrently-mounted modules that share a category color,
  // producing duplicate SVG <linearGradient> ids (invalid; WebKit blanks/misrenders
  // the fill when a same-id defs node mounts/unmounts elsewhere).
  const gradientRaw = useId();
  const gradientId = `spark-grad-${gradientRaw.replace(/:/g, '')}`;

  const qualityPoints = snapshots
    .map((s) => s.avgQuality)
    .filter((q): q is number => q !== null);

  if (qualityPoints.length < 2) return null;

  const w = 64;
  const h = 24;
  const pad = 2;
  const min = Math.max(0, Math.min(...qualityPoints) - 0.5);
  const max = Math.min(5, Math.max(...qualityPoints) + 0.5);
  const range = max - min || 1;

  const points = qualityPoints.map((q, i) => {
    const x = pad + (i / (qualityPoints.length - 1)) * (w - pad * 2);
    const y = h - pad - ((q - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Trend: compare last vs first
  const first = qualityPoints[0];
  const last = qualityPoints[qualityPoints.length - 1];
  const trend = last - first;
  const TrendIcon = trend > 0.2 ? TrendingUp : trend < -0.2 ? TrendingDown : Minus;
  const trendColor = trend > 0.2 ? STATUS_SUCCESS : trend < -0.2 ? STATUS_ERROR : 'var(--text-muted)';

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" title={`Quality trend: ${qualityPoints.map((q) => q.toFixed(1)).join(' → ')}`}>
      <svg width={w} height={h} className="flex-shrink-0">
        {/* Gradient fill under the line */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path
          d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
          fill={`url(#${gradientId})`}
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Endpoint dot */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={accentColor} />
      </svg>
      <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
    </div>
  );
}
