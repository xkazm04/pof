import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { ProbeFailureKind } from '@/lib/bridge-doctor/probes';
import type { NotProbedReason } from '@/lib/pof-bridge/routes';
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

/** Plain-language reading of the Bridge Doctor's failure classification. */
export function probeKindLabel(kind: ProbeFailureKind): string {
  switch (kind) {
    case 'plugin-disabled': return 'route not in this plugin build';
    case 'auth-rejected': return 'auth token rejected';
    case 'editor-not-running': return 'editor not running';
    case 'timeout': return 'timed out';
    case 'wrong-port': return 'not a PoF reply';
    case 'http-error': return 'HTTP error';
    default: return 'unknown failure';
  }
}

/** Why a declared route is deliberately left alone by Ping All. */
export function notProbedLabel(reason: NotProbedReason): string {
  return reason === 'mutates'
    ? 'not probed — would change the editor'
    : 'not probed — needs an argument';
}
