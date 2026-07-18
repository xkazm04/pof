import { Loader2 } from 'lucide-react';
import { scoreColor } from './helpers';

export function RadialScoreGauge({ score, isScanning }: { score: number | null; isScanning: boolean }) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 270-degree arc: starts at 135° (bottom-left), sweeps 270° clockwise to 45° (bottom-right)
  const startAngle = 135;
  const sweepAngle = 270;

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = polarToCart(startDeg, r);
    const end = polarToCart(endDeg, r);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // Background track (full 270°)
  const trackPath = arcPath(startAngle, startAngle + sweepAngle, radius);

  // Score arc
  const clampedScore = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const scoreEndAngle = startAngle + (clampedScore / 100) * sweepAngle;
  const scorePath = clampedScore > 0 ? arcPath(startAngle, scoreEndAngle, radius) : '';

  // Use the shared 4-band score→color scale so the gauge stays consistent with
  // every other score-colored widget in the dashboard.
  const gaugeColor = score !== null ? scoreColor(score) : 'var(--text-muted)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        {score !== null && clampedScore > 0 && (
          <path
            d={scorePath}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}40)` }}
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isScanning ? (
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: gaugeColor }} />
        ) : score !== null ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[32px] font-bold leading-none" style={{ color: gaugeColor }}>
              {score}
            </span>
            <span className="text-xs text-text-muted font-medium">/100</span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">--</span>
        )}
      </div>
    </div>
  );
}
