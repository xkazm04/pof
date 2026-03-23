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
