import { CheckCircle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import type { RecurringError } from '@/lib/ue5-bridge/build-health';

/** One fingerprint from the charted builds' diagnostics: recurrence, lane, verdict, fix hint. */
export function RecurringErrorRow({ error }: { error: RecurringError }) {
  const extraLanes = Math.max(0, (error.lanes?.length ?? 1) - 1);
  return (
    <div
      data-error-fingerprint={error.fingerprint}
      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-surface-hover transition-colors"
    >
      <span
        className="text-2xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_10), color: STATUS_ERROR }}
        title={`${error.occurrences} of ${error.buildsScanned} charted builds carried this error`}
      >
        in {error.occurrences} build{error.occurrences !== 1 ? 's' : ''}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text truncate" title={error.message}>
          {error.errorCode ? <span className="font-mono text-text-muted">{error.errorCode} </span> : null}
          {error.pattern}
        </div>
        <div className="text-2xs text-text-muted truncate" title={error.lanes?.join(', ')}>
          {error.category} · {error.lane}
          {extraLanes > 0 ? ` +${extraLanes} lane${extraLanes !== 1 ? 's' : ''}` : ''}
        </div>
        {error.fixDescription ? (
          <div className="text-2xs text-text-muted truncate" title={error.fixDescription}>
            {error.fixDescription}
          </div>
        ) : null}
      </div>
      {error.stillFailing ? (
        <span data-still-failing="true" className="text-2xs font-medium flex-shrink-0" style={{ color: STATUS_ERROR }}>
          still failing
        </span>
      ) : (
        <CheckCircle
          className="w-3 h-3 flex-shrink-0"
          style={{ color: STATUS_SUCCESS }}
          aria-label="resolved"
        />
      )}
    </div>
  );
}
