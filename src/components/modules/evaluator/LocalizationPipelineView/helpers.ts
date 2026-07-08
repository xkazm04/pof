import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

/* ── Expansion helpers ──────────────────────────────────────────────────── */

/** Returns a color from green (compact) → amber (neutral) → red (high expansion). */
export function expansionColor(factor: number): string {
  if (factor <= 0.7) return ACCENT_EMERALD;
  if (factor <= 1.0) return STATUS_INFO;
  if (factor <= 1.2) return STATUS_WARNING;
  return STATUS_ERROR;
}

export function formatExpansion(factor: number): string {
  if (factor === 1.0) return 'baseline';
  const pct = Math.round((factor - 1) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
