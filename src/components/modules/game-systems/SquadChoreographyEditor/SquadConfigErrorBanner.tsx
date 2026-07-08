import { AlertTriangle } from 'lucide-react';
import { STATUS_ERROR, OPACITY_10 } from '@/lib/chart-colors';
import type { SquadConfigError } from '@/types/squad-tactics';

/* ── Inline config error state ────────────────────────────────────────────── */

export function SquadConfigErrorBanner({ error }: { error: SquadConfigError }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg"
      style={{
        backgroundColor: `${STATUS_ERROR}${OPACITY_10}`,
        border: `1px solid ${STATUS_ERROR}30`,
      }}
      data-testid="squad-config-error"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: STATUS_ERROR }} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-bold" style={{ color: STATUS_ERROR }}>
          Invalid squad configuration
        </p>
        <p className="text-2xs text-text-muted">
          {error.message}
          {error.field && (
            <span className="font-mono"> (field: {error.field})</span>
          )}
        </p>
      </div>
    </div>
  );
}
