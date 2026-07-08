import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { HorizontalGridLines } from '@/components/ui/svg/ChartAxes';
import {
  paddedDomain, sparklinePoints, sparklineLinePath, sparklineAreaPath,
} from '@/components/modules/core-engine/sub_progression/_shared/chartMath';

/**
 * One parametric quality sparkline driving both the compact heatmap-cell trend
 * (`markers="end"`, solid fill) and the rich detail-panel trend (`markers="all"`,
 * gradient fill, grid lines, delta footer). All point/path geometry comes from
 * the shared `chartMath` helpers; only the styling differs by prop.
 */
export function Sparkline({
  snapshots,
  color,
  width,
  height,
  pad,
  domainCeil,
  strokeWidth,
  lineOpacity = 1,
  areaFill,
  areaOpacity = 0.15,
  markers,
  gridValues,
  gradientId,
  showDelta = false,
  className,
}: {
  snapshots: ReviewSnapshot[];
  color: string;
  width: number;
  height: number;
  pad: number;
  /** Upper clamp of the padded Y domain (lower bound is 0). */
  domainCeil: number;
  strokeWidth: number;
  lineOpacity?: number;
  /** `'solid'` = flat color at `areaOpacity`; `'gradient'` = vertical fade. */
  areaFill: 'solid' | 'gradient';
  areaOpacity?: number;
  /** `'end'` = dot at last point; `'all'` = dot + date tooltip per point. */
  markers: 'none' | 'end' | 'all';
  /** Draw horizontal grid lines at these data values. */
  gridValues?: readonly number[];
  /** Unique id for the gradient def — required when `areaFill="gradient"`. */
  gradientId?: string;
  /** Render the "N reviews / Δ since first" footer below the chart. */
  showDelta?: boolean;
  className?: string;
}) {
  const series = snapshots
    .map((s) => ({ q: s.avgQuality, date: s.reviewedAt }))
    .filter((p): p is { q: number; date: string } => p.q !== null);

  if (series.length < 2) return null;

  const values = series.map((p) => p.q);
  const { min, max } = paddedDomain(values, 0.5, 0, domainCeil);
  const points = sparklinePoints(values, { width, height, pad }, min, max);
  const linePath = sparklineLinePath(points);
  const areaPath = sparklineAreaPath(points, height);
  const lastPoint = points[points.length - 1];

  const svg = (
    <svg width={width} height={height} className={showDelta ? 'w-full' : className}>
      {gridValues && (
        <HorizontalGridLines
          values={gridValues}
          min={min}
          max={max}
          left={pad}
          right={width - pad}
          top={pad}
          bottom={height - pad}
        />
      )}
      {areaFill === 'gradient' && gradientId ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      ) : (
        <path d={areaPath} fill={color} fillOpacity={areaOpacity} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={lineOpacity}
      />
      {markers === 'end' && <circle cx={lastPoint.x} cy={lastPoint.y} r="1.5" fill={color} />}
      {markers === 'all' &&
        points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color}>
            <title>{`${new Date(series[i].date).toLocaleDateString()}: ${series[i].q}`}</title>
          </circle>
        ))}
    </svg>
  );

  if (!showDelta) return svg;

  const delta = values[values.length - 1] - values[0];
  const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta > 0.1 ? STATUS_SUCCESS : delta < -0.1 ? STATUS_ERROR : 'var(--text-muted)';

  return (
    <div className={className ?? 'mt-1'}>
      {svg}
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xs text-text-muted">{values.length} reviews</span>
        <span className="text-2xs font-medium" style={{ color: deltaColor }}>
          {deltaStr} since first
        </span>
      </div>
    </div>
  );
}
