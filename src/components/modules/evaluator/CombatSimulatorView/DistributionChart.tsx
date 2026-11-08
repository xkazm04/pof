import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { percentileFromBuckets } from '@/lib/combat/histogram';

// ── Distribution Chart ──────────────────────────────────────────────────────

export function DistributionChart({
  title, buckets, color, unit = '',
}: {
  title: string;
  buckets: { min: number; max: number; count: number }[];
  color: 'emerald' | 'red' | 'blue';
  unit?: string;
}) {
  if (buckets.length === 0) {
    // Typed empty state: no axis or bars drawn around nothing, which would read as "measured: zero".
    return (
      <SurfaceCard className="p-3">
        <div className="text-2xs text-text-muted font-medium mb-2">{title}</div>
        <p className="text-xs text-text-muted">No fights recorded for this distribution.</p>
      </SurfaceCard>
    );
  }
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const colorMap = {
    emerald: 'bg-emerald-400/70',
    red: 'bg-red-400/70',
    blue: 'bg-blue-400/70',
  };

  // Median (p50) + tail (p95) markers give the spread a non-color, structural
  // read so the shape is legible even where the bar fill is hard to perceive.
  const lo = buckets[0].min;
  const hi = buckets[buckets.length - 1].max;
  const range = hi - lo || 1;
  const frac = (v: number) => Math.max(0, Math.min(1, (v - lo) / range));
  const p50 = percentileFromBuckets(buckets, 0.5);
  const p95 = percentileFromBuckets(buckets, 0.95);
  const summaryLabel = describeDistribution(title, buckets, unit, p50, p95);

  return (
    <SurfaceCard className="p-3">
      <div className="text-2xs text-text-muted font-medium mb-2">{title}</div>
      {/* The bars are one rendering of the data; the label is its text body, so the
          values reach keyboard, touch and screen-reader users, not hover alone. */}
      <div className="relative flex items-end gap-px h-16" role="img" aria-label={summaryLabel}>
        {buckets.map((b, i) => {
          const h = (b.count / maxCount) * 100;
          return (
            <div key={i} className="flex-1 group relative">
              <div className={`w-full rounded-t-sm ${colorMap[color]}`} style={{ height: `${h}%` }} />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 left-1/2 -translate-x-1/2">
                <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                  {b.min.toFixed(0)}{unit}-{b.max.toFixed(0)}{unit}: {b.count}
                </div>
              </div>
            </div>
          );
        })}
        {p50 != null && <PercentileMarker fraction={frac(p50)} label="p50" />}
        {p95 != null && <PercentileMarker fraction={frac(p95)} label="p95" dashed />}
      </div>
      <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
        <span>{buckets[0]?.min.toFixed(0)}{unit}</span>
        <span>{buckets[buckets.length - 1]?.max.toFixed(0)}{unit}</span>
      </div>
    </SurfaceCard>
  );
}

/** Text alternative for a distribution: sample size, range, p50/p95, peak bucket, every bucket. */
function describeDistribution(
  title: string,
  buckets: { min: number; max: number; count: number }[],
  unit: string,
  p50: number | null,
  p95: number | null,
): string {
  const fmt = (v: number) => `${v.toFixed(0)}${unit}`;
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peak = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);
  const parts = [
    `${title}: ${total} fights from ${fmt(buckets[0].min)} to ${fmt(buckets[buckets.length - 1].max)}`,
    p50 != null ? `median (p50) ${fmt(p50)}` : null,
    p95 != null ? `p95 ${fmt(p95)}` : null,
    `most common ${fmt(peak.min)}-${fmt(peak.max)} (${peak.count})`,
    `buckets ${buckets.map((b) => `${fmt(b.min)}-${fmt(b.max)}: ${b.count}`).join(', ')}`,
  ];
  return parts.filter(Boolean).join('; ');
}

/** A labeled vertical percentile line overlaid on a distribution's bars. */
function PercentileMarker({ fraction, label, dashed }: {
  fraction: number; label: string; dashed?: boolean;
}) {
  const flip = fraction > 0.85; // keep the label inside the chart near the right edge
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-10"
      style={{ left: `${fraction * 100}%` }}
      aria-hidden="true"
    >
      <div
        className="absolute top-0 bottom-0 left-0"
        style={{ borderLeftWidth: 1, borderLeftStyle: dashed ? 'dashed' : 'solid', borderLeftColor: 'var(--text-muted)' }}
      />
      <span className={`absolute -top-1 ${flip ? 'right-0.5' : 'left-0.5'} text-[9px] font-mono leading-none text-text-muted whitespace-nowrap`}>
        {label}
      </span>
    </div>
  );
}
