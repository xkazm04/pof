// ── Pure formatting helpers ─────────────────────────────────────────────────

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
