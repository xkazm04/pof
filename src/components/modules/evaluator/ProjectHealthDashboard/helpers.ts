import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER, OPACITY_10 } from '@/lib/chart-colors';
import { RADAR_CX, RADAR_CY } from './constants';

// ── Score → color ──

export function scoreColor(score: number): string {
  if (score >= 80) return STATUS_SUCCESS;
  if (score >= 60) return STATUS_WARNING;
  if (score >= 40) return STATUS_BLOCKER;
  return STATUS_ERROR;
}

export function scoreBg(score: number): string {
  if (score >= 80) return STATUS_SUCCESS + OPACITY_10;
  if (score >= 60) return STATUS_WARNING + OPACITY_10;
  if (score >= 40) return STATUS_BLOCKER + OPACITY_10;
  return STATUS_ERROR + OPACITY_10;
}

export function polarToXY(angle: number, radius: number): { x: number; y: number } {
  // Start from top (-90°), go clockwise
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: RADAR_CX + Math.cos(rad) * radius,
    y: RADAR_CY + Math.sin(rad) * radius,
  };
}

/**
 * Place an older scan's scores on the CURRENT radar's axes. Coverage grows between
 * scans, so re-spacing the older set would put a module on another module's axis; a
 * module the older scan never scored has no point at all (never a 0).
 */
export function alignToAxes<T extends { moduleId: string }>(
  axes: readonly { moduleId: string; angle: number }[],
  scores: readonly T[],
): (T & { angle: number })[] {
  const byModule = new Map(scores.map((s) => [s.moduleId, s]));
  return axes.flatMap((axis) => {
    const score = byModule.get(axis.moduleId);
    return score ? [{ ...score, angle: axis.angle }] : [];
  });
}

export function priorityOrder(p: string): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p] ?? 4;
}
