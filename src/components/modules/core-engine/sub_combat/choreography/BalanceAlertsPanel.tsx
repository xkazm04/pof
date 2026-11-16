'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS,
  withOpacity, OPACITY_12, OPACITY_25, OPACITY_8, OPACITY_20, OPACITY_15, OPACITY_5,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { BalanceAlertSeverity } from '@/types/combat-simulator';
import { severityColor, findingTimeLabel, type BalanceAlert } from './types';

/** Stable finding identity: kind plus where it sits; a repeat of the same pair gets an occurrence suffix. */
function findingKeys(alerts: BalanceAlert[]): string[] {
  const seen = new Map<string, number>();
  return alerts.map((a) => {
    const base = `${a.kind}@${a.timeSec}-${a.endTimeSec ?? ''}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  });
}

export function BalanceAlertsPanel({ alerts }: { alerts: BalanceAlert[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const keys = useMemo(() => findingKeys(alerts), [alerts]);
  const seenCritical = useRef(new Set(alerts.flatMap((a, i) => (a.severity === 'critical' ? [keys[i]] : []))));

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);

  useEffect(() => {
    const critical = alerts.flatMap((a, i) => (a.severity === 'critical' ? [i] : []));
    const fresh = critical.filter((i) => !seenCritical.current.has(keys[i]));
    seenCritical.current = new Set(critical.map((i) => keys[i]));
    if (fresh.length === 0) return;
    const critIdx = fresh[0];
    const raf = requestAnimationFrame(() => {
      setFlashIdx(critIdx);
      listRef.current?.children[critIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    const timer = setTimeout(() => setFlashIdx(null), 600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [alerts, keys]);

  const SEVERITY_PILLS: { key: BalanceAlertSeverity; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: severityColor('critical') },
    { key: 'warning', label: 'Warning', color: severityColor('warning') },
    { key: 'info', label: 'Info', color: severityColor('info') },
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
            const color = severityColor(alert.severity);
            return (
              <div
                key={keys[i]}
                className="flex items-start gap-1.5 p-1.5 rounded-md border transition-colors"
                style={{
                  borderColor: `${withOpacity(color, OPACITY_20)}`,
                  backgroundColor: flashIdx === i ? `${withOpacity(color, OPACITY_15)}` : `${withOpacity(color, OPACITY_5)}`,
                  transition: 'background-color 0.6s ease-out',
                }}
              >
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                <span className="text-xs font-mono flex-1" style={{ color }}>{alert.message}</span>
                {alert.endTimeSec !== undefined && (
                  <span className="text-xs font-mono tabular-nums shrink-0 opacity-70" style={{ color }} data-testid="finding-range">
                    {findingTimeLabel(alert)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </BlueprintPanel>
  );
}
