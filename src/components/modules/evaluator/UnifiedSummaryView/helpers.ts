import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER, OPACITY_10 } from '@/lib/chart-colors';

// ─── Score coloring ──────────────────────────────────────────────────────────

export function healthColor(score: number): string {
  if (score >= 70) return STATUS_SUCCESS;
  if (score >= 45) return STATUS_WARNING;
  if (score >= 25) return STATUS_BLOCKER;
  return STATUS_ERROR;
}

export function healthBg(score: number): string {
  if (score >= 70) return `${STATUS_SUCCESS}${OPACITY_10}`;
  if (score >= 45) return `${STATUS_WARNING}${OPACITY_10}`;
  if (score >= 25) return `${STATUS_BLOCKER}${OPACITY_10}`;
  return `${STATUS_ERROR}${OPACITY_10}`;
}
