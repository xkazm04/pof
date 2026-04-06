'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  withOpacity, OPACITY_12, OPACITY_25, OPACITY_8, OPACITY_20, OPACITY_15, OPACITY_5,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { BalanceAlertSeverity } from '@/types/combat-simulator';
import type { BalanceAlert } from './types';

export function BalanceAlertsPanel({ alerts }: { alerts: BalanceAlert[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const firstCritRef = useRef<HTMLDivElement>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const prevAlertsLen = useRef(alerts.length);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);

  useEffect(() => {
    if (alerts.length === 0) { prevAlertsLen.current = 0; return; }
    if (alerts.length !== prevAlertsLen.current) {
      prevAlertsLen.current = alerts.length;
      const critIdx = alerts.findIndex(a => a.severity === 'critical');
      if (critIdx !== -1) {
        const raf = requestAnimationFrame(() => {
          setFlashIdx(critIdx);
          firstCritRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        const timer = setTimeout(() => setFlashIdx(null), 600);
        return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
      }
    }
  }, [alerts]);

  const SEVERITY_PILLS: { key: BalanceAlertSeverity; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: STATUS_ERROR },
    { key: 'warning', label: 'Warning', color: STATUS_WARNING },
    { key: 'info', label: 'Info', color: STATUS_INFO },
  ];

  return (
    <BlueprintPanel className="p-3 space-y-3">
      <SectionHeader label="Balance Alerts" icon={AlertTriangle} />

      {alerts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {SEVERITY_PILLS.map(s => (
            <span
              key={s.key}
              className="text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${withOpacity(s.color, OPACITY_12)}`, color: s.color, opacity: counts[s.key] > 0 ? 1 : 0.35 }}
            >
              {counts[s.key]} {s.label}
            </span>
          ))}
        </div>
      )}

      <div ref={listRef} className="max-h-48 overflow-y-auto space-y-1" aria-live="polite" aria-relevant="additions">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 p-2 rounded-md border"
            style={{ borderColor: `${withOpacity(STATUS_SUCCESS, OPACITY_25)}`, backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_8)}` }}>
            <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>
              No balance issues detected
            </span>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const color = alert.severity === 'critical' ? STATUS_ERROR
              : alert.severity === 'warning' ? STATUS_WARNING : STATUS_INFO;
            const isFirstCrit = i === alerts.findIndex(a => a.severity === 'critical');
            return (
              <div
                key={i}
                ref={isFirstCrit ? firstCritRef : undefined}
                className="flex items-start gap-1.5 p-1.5 rounded-md border transition-colors"
                style={{
                  borderColor: `${withOpacity(color, OPACITY_20)}`,
                  backgroundColor: flashIdx === i ? `${withOpacity(color, OPACITY_15)}` : `${withOpacity(color, OPACITY_5)}`,
                  transition: 'background-color 0.6s ease-out',
                }}
              >
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                <span className="text-xs font-mono" style={{ color }}>{alert.message}</span>
              </div>
            );
          })
        )}
      </div>
    </BlueprintPanel>
  );
}
