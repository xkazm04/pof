'use client';

import { AlertTriangle, Activity } from 'lucide-react';
import { SEVERITY_ICON_COLORS, type BalanceReport } from './data';

import { withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';

const MAX_SHOWN = 8;
const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function AlertBadges({ alerts }: { alerts: BalanceReport['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-xs text-text-muted font-mono">
        No balance issues detected.
      </div>
    );
  }

  const severityIcons = {
    critical: AlertTriangle,
    warning: AlertTriangle,
    info: Activity,
  };

  // Most severe first, THEN cap: the engine emits alerts encounter-major, so a
  // late encounter's critical would otherwise fall behind the cap of warnings.
  const deduped = alerts
    .filter((a, i, arr) => arr.findIndex(b => b.message === a.message) === i)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (SEVERITY_RANK[x.a.severity] ?? 9) - (SEVERITY_RANK[y.a.severity] ?? 9) || x.i - y.i)
    .map(x => x.a);
  const unique = deduped.slice(0, MAX_SHOWN);
  const hidden = deduped.length - unique.length;

  return (
    <div className="space-y-1.5">
      {unique.map((alert, i) => {
        const color = SEVERITY_ICON_COLORS[alert.severity];
        const Icon = severityIcons[alert.severity as keyof typeof severityIcons];
        return (
          <div
            key={i}
            data-alert-severity={alert.severity}
            className="flex items-start gap-2 px-2 py-1.5 rounded border text-xs font-mono"
            style={{ backgroundColor: `${withOpacity(color, OPACITY_8)}`, borderColor: `${withOpacity(color, OPACITY_20)}` }}
          >
            <Icon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color }} />
            <span className="text-text-muted">{alert.message}</span>
          </div>
        );
      })}
      {hidden > 0 && (
        <div className="text-xs text-text-muted font-mono">+{hidden} more</div>
      )}
    </div>
  );
}
