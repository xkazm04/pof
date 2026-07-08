import { CheckCircle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import type { RecurringError } from '@/lib/ue5-bridge/build-health';

export function RecurringErrorRow({ error }: { error: RecurringError }) {
  return (
    <div
      data-error-fingerprint={error.fingerprint}
      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-hover transition-colors"
    >
      <span
        className="text-2xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_10), color: STATUS_ERROR }}
        title={`${error.occurrences} occurrence${error.occurrences !== 1 ? 's' : ''}`}
      >
        ×{error.occurrences}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text truncate" title={error.message}>
          {error.errorCode ? <span className="font-mono text-text-muted">{error.errorCode} </span> : null}
          {error.pattern}
        </div>
        <div className="text-2xs text-text-muted">
          {error.category} · {error.moduleId}
        </div>
      </div>
      {error.wasResolved && (
        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="resolved" />
      )}
    </div>
  );
}
