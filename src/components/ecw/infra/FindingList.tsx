'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';

export type FindingSeverity = 'ok' | 'warn' | 'error';

/** The shape every ECW lint emits ({ severity, rule, message }). */
export interface Finding {
  severity: FindingSeverity;
  rule: string;
  message: string;
}

/** ok→positive (green), warn→warning (amber), error→critical (red) on the canonical bands. */
const TOKEN: Record<FindingSeverity, { color: string }> = {
  ok: SEVERITY_TOKENS.positive,
  warn: SEVERITY_TOKENS.warning,
  error: SEVERITY_TOKENS.critical,
};
const ICON: Record<FindingSeverity, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};
const SR_LABEL: Record<FindingSeverity, string> = { ok: 'OK', warn: 'Warning', error: 'Error' };

/**
 * Shared lint-finding list (ECW Phase 11-DS / a11y). Renders `{severity, rule,
 * message}` findings with severity colors drawn from `SEVERITY_TOKENS` (not
 * hardcoded Tailwind classes) and a screen-reader label per row. Replaces the
 * per-facet ICON/COLOR maps that the Balance/Economy/Combat/Zone/Montage analysis
 * facets each duplicated, so severity styling stays consistent shell-wide.
 */
export function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="space-y-1.5" role="list">
      {findings.map((f, i) => {
        const Icon = ICON[f.severity];
        return (
          <li key={`${f.rule}-${i}`} className="flex items-start gap-2 text-xs">
            <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: TOKEN[f.severity].color }} aria-hidden="true" />
            <span className="sr-only">{SR_LABEL[f.severity]}:</span>
            <span className="text-text">{f.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
