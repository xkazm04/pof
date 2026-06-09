export interface HistogramBin {
  low: number;
  high: number;
  count: number;
}

export interface HistogramResult {
  min: number;
  max: number;
  bins: HistogramBin[];
}

/**
 * Build an equal-width histogram from a list of numeric values.
 * Values are sorted, divided into `bucketCount` bins, and counted.
 */
export function buildHistogram(values: number[], bucketCount: number): HistogramResult {
  if (values.length === 0) return { min: 0, max: 0, bins: [] };

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const binWidth = range / bucketCount;

  const bins: HistogramBin[] = Array.from({ length: bucketCount }, (_, i) => ({
    low: min + i * binWidth,
    high: min + (i + 1) * binWidth,
    count: 0,
  }));

  for (const v of sorted) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bucketCount - 1);
    bins[idx].count++;
  }

  return { min, max, bins };
}

/** Minimal histogram bucket shape shared with the combat summary distributions. */
export interface CountBucket {
  min: number;
  max: number;
  count: number;
}

/**
 * Estimate the value at percentile `p` (0–1) from pre-binned histogram buckets,
 * linearly interpolating within the bucket whose running total first reaches the
 * target rank. Returns `null` when there are no observations.
 *
 * Used to draw p50/p95 marker lines on the combat distribution charts so the
 * spread is readable without relying on bar color alone (WCAG 1.4.1).
 */
export function percentileFromBuckets(buckets: CountBucket[], p: number): number | null {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return null;

  const target = Math.max(0, Math.min(1, p)) * total;
  let cumulative = 0;
  for (const b of buckets) {
    if (b.count === 0) continue;
    if (cumulative + b.count >= target) {
      const within = (target - cumulative) / b.count; // 0–1 position inside this bucket
      return b.min + (b.max - b.min) * within;
    }
    cumulative += b.count;
  }

  const last = buckets[buckets.length - 1];
  return last ? last.max : null;
}
