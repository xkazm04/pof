'use client';

import { AlertTriangle, Activity } from 'lucide-react';
import { SEVERITY_ICON_COLORS, type BalanceReport } from './data';

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

  const unique = alerts
    .filter((a, i, arr) => arr.findIndex(b => b.message === a.message) === i)
    .slice(0, 8);

  return (
    <div className="space-y-1.5">
      {unique.map((alert, i) => {
        const color = SEVERITY_ICON_COLORS[alert.severity];
        const Icon = severityIcons[alert.severity as keyof typeof severityIcons];
        return (
          <div
            key={i}
            className="flex items-start gap-2 px-2 py-1.5 rounded border text-xs font-mono"
            style={{ backgroundColor: `${color}10`, borderColor: `${color}30` }}
          >
            <Icon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color }} />
            <span className="text-text-muted">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
