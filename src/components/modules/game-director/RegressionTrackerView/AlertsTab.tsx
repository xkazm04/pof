'use client';

import { useState, useMemo } from 'react';
import {
  AlertOctagon, CheckCircle2,
  ChevronDown, ChevronRight, X, Shield,
  ArrowRight,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { RegressionAlert } from '@/types/regression-tracker';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { SEVERITY_TOKENS } from '@/lib/game-director-styles';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACCENT } from './constants';

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

export function AlertsTab({
  alerts,
  onDismiss,
}: {
  alerts: RegressionAlert[];
  onDismiss: (alertId: string) => void;
}) {
  const active = useMemo(() => alerts.filter(a => !a.dismissed), [alerts]);
  const dismissed = useMemo(() => alerts.filter(a => a.dismissed), [alerts]);
  const [showDismissed, setShowDismissed] = useState(false);

  return (
    <div className="space-y-3">
      {active.length === 0 && dismissed.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          iconColor={ACCENT}
          satelliteIcons={[Shield, CheckCircle2]}
          title="No regression alerts"
          description="Regression alerts appear when a previously fixed bug reappears in a later playtest. Process multiple sessions over time to enable automatic regression detection."
        />
      ) : (
        <>
          {active.length === 0 ? (
            <SurfaceCard level={2}>
              <div className="p-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
                <span className="text-sm font-medium" style={{ color: STATUS_SUCCESS }}>All clear — no active regression alerts</span>
              </div>
            </SurfaceCard>
          ) : (
            <div className="space-y-2">
              {active.map(alert => (
                <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
              ))}
            </div>
          )}

          {dismissed.length > 0 && (
            <div>
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                aria-expanded={showDismissed}
                className="focus-ring rounded-sm flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
              >
                {showDismissed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {dismissed.length} dismissed alert{dismissed.length !== 1 ? 's' : ''}
              </button>
              {showDismissed && (
                <div className="space-y-2 mt-2 opacity-50">
                  {dismissed.map(alert => (
                    <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AlertCard({ alert, onDismiss }: { alert: RegressionAlert; onDismiss: (id: string) => void }) {
  const sev = SEVERITY_TOKENS[alert.severity];
  const SevIcon = sev.icon;
  const denseBg = `${sev.color}${OPACITY_20}`;

  return (
    <SurfaceCard level={2}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: denseBg }}>
            <SevIcon className="w-3.5 h-3.5" style={{ color: sev.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text truncate">{alert.title}</span>
              <SeverityBadge severity={alert.severity} density="dense" showIcon={false} upper className="flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-2xs text-text-muted">
              <span>{alert.category}</span>
              <span className="text-border">|</span>
              <span className="font-medium" style={{ color: STATUS_ERROR }}>
                Regressed after {alert.buildGap} build{alert.buildGap !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-2xs">
              <span className="px-1.5 py-0.5 rounded" style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>
                Fixed: {alert.fixedInSessionName || 'Unknown'}
              </span>
              <ArrowRight className="w-3 h-3 text-text-muted" />
              <span className="px-1.5 py-0.5 rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}>
                Reappeared: {alert.reappearedInSessionName || 'Unknown'}
              </span>
            </div>
          </div>
          {!alert.dismissed && (
            <button
              onClick={() => onDismiss(alert.id)}
              aria-label="Dismiss alert"
              className="focus-ring p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors flex-shrink-0"
              title="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
