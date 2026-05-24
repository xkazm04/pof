export function mcStats(vals: number[]) {
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const stddev = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { mean, median, stddev, min: sorted[0], max: sorted[n - 1] };
}

export function buildBins(vals: number[], count: number) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const w = (hi - lo || 1) / count;
  const bins = Array.from({ length: count }, (_, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, n: 0 }));
  for (const v of vals) { bins[Math.min(Math.floor((v - lo) / w), count - 1)].n++; }
  return bins;
}
