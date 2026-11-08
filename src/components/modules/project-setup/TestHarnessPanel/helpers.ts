import {
  FlaskConical, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { PofTestResult } from '@/types/pof-bridge';
import type { SuiteRunResult } from './types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A suite's verdict over what actually ran. `passed` needs every expected scenario back and
 * passing and every configured snapshot compared; a run that observed nothing is `error`.
 */
export function deriveSuiteStatus(run: {
  results: readonly PofTestResult[];
  expectedCount: number;
  /** Presets were captured and the read-back report did not pass (or never came). */
  snapshotsFailed: boolean;
  /** Presets are configured but the run stopped before capturing them. */
  snapshotsSkipped: boolean;
}): SuiteRunResult['status'] {
  const { results, expectedCount, snapshotsFailed, snapshotsSkipped } = run;
  if (snapshotsFailed || results.some((r) => r.status === 'failed' || r.status === 'error' || r.status === 'timeout')) {
    return 'failed';
  }
  if (results.length === 0) return 'error';
  const complete = results.length >= expectedCount && !snapshotsSkipped;
  return complete && results.every((r) => r.status === 'passed') ? 'passed' : 'partial';
}

// ── Status helpers ───────────────────────────────────────────────────────────

export function testStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'error': return STATUS_ERROR;
    case 'timeout': return STATUS_WARNING;
    case 'running': return ACCENT_CYAN;
    default: return STATUS_NEUTRAL;
  }
}

export function testStatusIcon(status: string) {
  switch (status) {
    case 'passed': return CheckCircle2;
    case 'failed': return XCircle;
    case 'error': return AlertTriangle;
    case 'timeout': return Clock;
    case 'running': return Loader2;
    default: return FlaskConical;
  }
}

export function snapshotStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'no-baseline': return STATUS_WARNING;
    case 'resolution-mismatch': return ACCENT_ORANGE;
    default: return STATUS_NEUTRAL;
  }
}
