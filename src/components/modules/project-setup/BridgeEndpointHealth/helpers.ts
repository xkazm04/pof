import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { HealthStatus } from './types';

export function healthDotColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return STATUS_SUCCESS;
    case 'error': return STATUS_ERROR;
    case 'timeout': return STATUS_WARNING;
    default: return STATUS_NEUTRAL;
  }
}

/** Map a single latency reading (ms) to a semantic gradient color. */
export function latencyColor(ms: number): string {
  if (ms < 150) return STATUS_SUCCESS;
  if (ms < 750) return STATUS_WARNING;
  return STATUS_ERROR;
}

/** Median of a non-empty numeric list (used for the baseline reference). */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
