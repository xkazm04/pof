import { heatmapScale } from '@/lib/chart-colors';
import { computeFlankAngle, ringPoint, forwardVector } from '@/lib/ai-director/eqs-geometry';
import { ringPoints, type RingPoint as PolarPoint } from '@/components/ui/svg/polar-layout';
import { ATTACK_DISTANCE } from './constants';

// ── Flank angle color: 0°=red(front) → 90°=yellow(side) → 180°=green(behind)

export function flankColor(angleDeg: number): string {
  // 0° (front, exposed) → low end of heatmap; 180° (behind, safe) → high end.
  return heatmapScale(Math.min(angleDeg / 180, 1));
}

// ── Generate attack ring points (matches C++) ────────────────────────────────
// Flank-angle scoring comes from the shared `@/lib/ai-director/eqs-geometry`
// helpers — the single source of truth that mirrors the C++
// UEnvQueryTest_FlankAngle (also used by the squad simulation engine).

export interface RingPoint extends PolarPoint {
  flankDeg: number;  // flank angle score (degrees)
  color: string;
}

export function generateRingPoints(
  numPoints: number,
  forwardAngleRad: number,
): RingPoint[] {
  const { x: fwdX, y: fwdY } = forwardVector(forwardAngleRad);

  return ringPoints(numPoints, ATTACK_DISTANCE).map(({ x, y, angle }) => {
    const flankDeg = computeFlankAngle(fwdX, fwdY, x, y);
    return { x, y, angle, flankDeg, color: flankColor(flankDeg) };
  });
}

// ── Generate heatmap arc segments for the annular zone ───────────────────────

export function generateHeatmapArcs(
  forwardAngleRad: number,
  segments: number = 72,
): { startAngle: number; endAngle: number; flankDeg: number; color: string }[] {
  const { x: fwdX, y: fwdY } = forwardVector(forwardAngleRad);
  const step = (2 * Math.PI) / segments;

  return Array.from({ length: segments }, (_, i) => {
    const midAngle = step * i + step / 2;
    const { x: px, y: py } = ringPoint(midAngle, 1);
    const flankDeg = computeFlankAngle(fwdX, fwdY, px, py);
    return {
      startAngle: step * i,
      endAngle: step * (i + 1),
      flankDeg,
      color: flankColor(flankDeg),
    };
  });
}
