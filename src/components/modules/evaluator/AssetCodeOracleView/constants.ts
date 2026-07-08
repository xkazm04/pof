import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { ViolationType, ViolationSeverity } from '@/lib/asset-code-oracle';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<ViolationSeverity, { icon: typeof AlertCircle; color: string; variant: 'error' | 'warning' | 'default' }> = {
  error: { icon: AlertCircle, color: STATUS_ERROR, variant: 'error' },
  warning: { icon: AlertTriangle, color: STATUS_WARNING, variant: 'warning' },
  info: { icon: Info, color: STATUS_INFO, variant: 'default' },
};

export const TYPE_LABELS: Record<ViolationType, string> = {
  'orphaned-asset': 'Orphaned Asset',
  'missing-asset': 'Missing Asset',
  'stale-reference': 'Stale Reference',
  'naming-mismatch': 'Naming Mismatch',
  'unreferenced-asset': 'Unreferenced',
};

export type FilterSeverity = 'all' | ViolationSeverity;
