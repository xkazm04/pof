import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

// Cell intensity (0.15..1.0 for non-zero cells; 0 when empty).
export function cellIntensity(count: number, total: number): number {
  if (total === 0 || count === 0) return 0;
  return 0.15 + (count / total) * 0.85;
}

// Map intensity to a perceptually-spaced alpha hex in 0x26..0xE6 (~15%..90%).
// Why: the prior `intensity * 20` ramp capped at ~8% alpha, so even saturated
// cells were nearly transparent and the grid didn't read as a heatmap. A sqrt
// curve lifts low-density cells into the visible range without crushing the
// top end.
export function cellAlphaHex(intensity: number): string {
  if (intensity <= 0) return '00';
  const t = Math.min(1, Math.max(0, (intensity - 0.15) / 0.85));
  const alpha = Math.round(38 + Math.sqrt(t) * 192);
  return alpha.toString(16).padStart(2, '0');
}

/** The ONE done-% colour rule (heatmap rows, footer, 'Lowest Completion'):
 *  >=80 green, >=40 amber, >0 red, 0 muted (nothing done yet is not an alarm). */
export function completionColor(pct: number): string {
  if (pct >= 80) return STATUS_SUCCESS;
  if (pct >= 40) return STATUS_WARNING;
  if (pct > 0) return STATUS_ERROR;
  return 'var(--text-muted)';
}
