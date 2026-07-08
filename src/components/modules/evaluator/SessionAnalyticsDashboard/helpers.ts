import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

/**
 * Map a 0-100 score / success-rate to a color-blind-safe status band: a
 * semantic color PLUS a distinct icon shape PLUS a short word, so status is
 * never conveyed by hue alone. Shared by the quality, module-performance, and
 * context-impact views to keep their Good/Fair/Low encoding consistent.
 */
export function scoreBand(value: number): { color: string; label: string; Icon: typeof CheckCircle } {
  if (value >= 70) return { color: STATUS_SUCCESS, label: 'Good', Icon: CheckCircle };
  if (value >= 40) return { color: STATUS_WARNING, label: 'Fair', Icon: AlertTriangle };
  return { color: STATUS_ERROR, label: 'Low', Icon: XCircle };
}
