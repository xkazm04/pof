import { heatmapScale } from '@/lib/chart-colors';

/* ── Flank color helper (matches FlankAngleHeatmap) ───────────────────────── */

export function flankColor(angleDeg: number): string {
  // Matches FlankAngleHeatmap: shared canonical heatmap ramp.
  return heatmapScale(Math.min(angleDeg / 180, 1));
}

/* ── Forward-vector angle helpers ─────────────────────────────────────────── */

/**
 * Screen-space angle (radians, SVG convention: 0 = +x/east, +y = down) →
 * compass bearing in degrees (0 = north, increasing clockwise), normalized to
 * [0, 360). The diagram already labels N/E/S/W, so bearings — not raw radians —
 * are what the readout and the handle's `aria-valuenow` report.
 */
export function compassDeg(angleRad: number): number {
  const deg = (angleRad * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Nearest cardinal/intercardinal name for a bearing — spoken alongside the degrees. */
export function compassCardinal(bearingDeg: number): string {
  return CARDINALS[Math.round(bearingDeg / 45) % 8];
}
