'use client';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { STATUS_ERROR, OPACITY_8, OPACITY_15 } from '@/lib/chart-colors';

interface InlineErrorRetryProps {
  /** Error text shown beside the alert icon. */
  message: string;
  /** Invoked when the user clicks Retry. */
  onRetry: () => void;
  /** When provided, renders a dismiss (×) button on the right. */
  onDismiss?: () => void;
  /** Compact variant for nested/dense surfaces (tighter padding + `text-2xs`). */
  dense?: boolean;
  /** Accessible label for the dismiss button (defaults to "Dismiss error"). */
  dismissLabel?: string;
  className?: string;
}

/**
 * Inline, dismissible red "error + Retry" surface. A failed action explains itself
 * (red surface + Retry) instead of silently leaving the UI unchanged.
 *
 * Single source for the failed-action feedback across the regression view: the
 * top-level action banner (analyze / dismiss / resolve) and the dense
 * occurrence-history error block both render this, so colour/role/WCAG tweaks live
 * in one place. `stopPropagation` on the buttons keeps the banner safe when nested
 * inside a clickable parent (e.g. an expandable card) without affecting standalone use.
 */
export function InlineErrorRetry({
  message,
  onRetry,
  onDismiss,
  dense = false,
  dismissLabel = 'Dismiss error',
  className,
}: InlineErrorRetryProps) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-2 ${
        dense ? 'px-2 py-1.5 rounded text-2xs' : 'px-3 py-2 rounded-md text-xs'
      }${className ? ` ${className}` : ''}`}
      style={{
        color: STATUS_ERROR,
        backgroundColor: `${STATUS_ERROR}${OPACITY_8}`,
        border: `1px solid ${STATUS_ERROR}${OPACITY_15}`,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <AlertTriangle className={`${dense ? 'w-3 h-3' : 'w-3.5 h-3.5'} flex-shrink-0`} />
        <span className="truncate">{message}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="focus-ring flex items-center gap-1 px-1.5 py-0.5 rounded font-medium hover:opacity-80 transition-opacity"
          style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
        >
          <RefreshCw className="w-2.5 h-2.5" /> Retry
        </button>
        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            aria-label={dismissLabel}
            className="focus-ring p-0.5 rounded text-text-muted hover:text-text transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
