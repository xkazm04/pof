import { TrendingDown, X } from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { PRIORITY_COLORS } from './constants';
import type { RegressionAlert } from './types';

export function RegressionAlerts({
  regressionAlerts,
  dismissAlert,
}: {
  regressionAlerts: RegressionAlert[];
  dismissAlert: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {regressionAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
          style={{
            backgroundColor: PRIORITY_COLORS[alert.severity]?.bg ?? `${STATUS_ERROR}12`,
            borderColor: PRIORITY_COLORS[alert.severity]?.border ?? `${STATUS_ERROR}25`,
          }}
        >
          <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: PRIORITY_COLORS[alert.severity]?.text ?? STATUS_ERROR }} />
          <span className="text-xs text-text flex-1">{alert.message}</span>
          <span
            className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: PRIORITY_COLORS[alert.severity]?.text,
              backgroundColor: PRIORITY_COLORS[alert.severity]?.bg,
            }}
          >
            Regression
          </span>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3 text-text-muted" />
          </button>
        </div>
      ))}
    </div>
  );
}
