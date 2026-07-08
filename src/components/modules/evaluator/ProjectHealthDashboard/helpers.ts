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

export function priorityOrder(p: string): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p] ?? 4;
}
