'use client';

import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import type { CrashSeverity } from '@/types/crash-analyzer';
import { SEVERITY_LABELS } from './constants';

/** Severity pill chip driven by the shared SEVERITY_TOKENS, so its color always
 *  matches the corresponding filter pill (fixing the old green-badge-on-blue-row
 *  mismatch on `low`). */
export function SeverityBadge({ severity }: { severity: CrashSeverity }) {
  const token = SEVERITY_TOKENS[severity];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-2xs font-medium rounded border capitalize"
      style={{ color: token.color, backgroundColor: token.bg, borderColor: token.border }}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
