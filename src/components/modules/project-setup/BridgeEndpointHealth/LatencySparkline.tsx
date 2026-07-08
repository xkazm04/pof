import { STATUS_NEUTRAL } from '@/lib/chart-colors';
import { SPARK_W, SPARK_H } from './constants';
import { latencyColor, median } from './helpers';

/**
 * Inline 60×16 latency sparkline. Plots the per-endpoint ring buffer as a
 * gradient-filled trend line colored by the latest sample, over a faint dashed
 * baseline at the median so spikes and dropouts read at a glance.
 */
export function LatencySparkline({ samples, gradientId }: { samples: number[]; gradientId: string }) {
  if (samples.length === 0) return null;

  const latest = samples[samples.length - 1];
  const color = latencyColor(latest);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  const n = samples.length;

  // x: spread samples across the width (centered when a single sample exists).
  const xFor = (i: number) => (n <= 1 ? SPARK_W / 2 : (i / (n - 1)) * SPARK_W);
  // y: invert so higher latency sits higher; 1.5px padding keeps the line/dot in-bounds.
  const yFor = (v: number) => SPARK_H - ((v - min) / range) * (SPARK_H - 3) - 1.5;

  const linePts = samples.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const medY = yFor(median(samples)).toFixed(1);
  const lastX = xFor(n - 1).toFixed(1);
  const lastY = yFor(latest).toFixed(1);

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`Latency trend: latest ${latest}ms across last ${n} ping${n === 1 ? '' : 's'}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* faint median baseline — spikes read as deviations from this line */}
      <line
        x1={0} y1={medY} x2={SPARK_W} y2={medY}
        stroke={STATUS_NEUTRAL} strokeOpacity={0.5} strokeWidth={0.75} strokeDasharray="2 2"
      />
      {n > 1 && (
        <>
          <polygon points={`0,${SPARK_H} ${linePts} ${SPARK_W},${SPARK_H}`} fill={`url(#${gradientId})`} />
          <polyline
            points={linePts}
            fill="none"
            stroke={color}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 1.5px ${color})` }}
          />
        </>
      )}
      <circle cx={lastX} cy={lastY} r={1.5} fill={color} />
    </svg>
  );
}
