import { heatmapScale } from '@/lib/chart-colors';

/* ── Flank color helper (matches FlankAngleHeatmap) ───────────────────────── */

export function flankColor(angleDeg: number): string {
  // Matches FlankAngleHeatmap: shared canonical heatmap ramp.
  return heatmapScale(Math.min(angleDeg / 180, 1));
}
