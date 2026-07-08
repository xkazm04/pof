import { AlertOctagon, AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';
import type { FindingSeverity } from '@/lib/evaluator/finding-collector';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, SEVERITY_TOKENS, type SeverityToken } from '@/lib/chart-colors';

// ─── Constants ───────────────────────────────────────────────────────────────

export const EVAL_ACCENT = MODULE_COLORS.evaluator;

// Severity colors come from the shared SEVERITY_TOKENS map so a critical
// finding looks identical here, in GDD Compliance, and in the Archeologist.
export const SEVERITY_CONFIG: Record<FindingSeverity, SeverityToken & { label: string; icon: typeof AlertOctagon }> = {
  critical: { label: 'Critical', icon: AlertOctagon, ...SEVERITY_TOKENS.critical },
  high: { label: 'High', icon: AlertTriangle, ...SEVERITY_TOKENS.high },
  medium: { label: 'Medium', icon: Info, ...SEVERITY_TOKENS.medium },
  low: { label: 'Low', icon: Info, ...SEVERITY_TOKENS.low },
};

export const EFFORT_LABELS: Record<string, string> = {
  trivial: '< 5 min',
  small: '< 30 min',
  medium: '< 2 hours',
  large: '> 2 hours',
};

export const PASS_STATUS_ICONS = {
  pending: <span className="w-2 h-2 rounded-full bg-border-bright" />,
  running: <Loader2 className="w-3 h-3 animate-spin" style={{ color: STATUS_WARNING }} />,
  done: <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />,
  error: <X className="w-3 h-3" style={{ color: STATUS_ERROR }} />,
  skipped: <span className="w-2 h-2 rounded-full bg-border" />,
};
