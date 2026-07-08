import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { BalanceAlert } from '@/types/combat-simulator';
import { SEVERITY_STYLE } from './constants';

// ── Balance Alerts ──────────────────────────────────────────────────────────

export function AlertsSection({ alerts }: { alerts: BalanceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <SurfaceCard className="p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-text">Balance Check</span>
          <Badge variant="success">Encounter Balanced</Badge>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Balance Alerts</h2>
        <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'error' : 'warning'}>
          {alerts.length} issues
        </Badge>
      </div>
      <div className="space-y-1.5">
        {alerts.map((alert, i) => {
          const style = SEVERITY_STYLE[alert.severity];
          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}>
              <AlertTriangle className={`w-3 h-3 ${style.text} flex-shrink-0 mt-0.5`} />
              <span className="text-2xs text-text-muted/80">{alert.message}</span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
