import {
  FlaskConical, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_ORANGE,
} from '@/lib/chart-colors';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
