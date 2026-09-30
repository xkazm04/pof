'use client';

import { CheckCircle2 } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import type { WeekLanded } from './weekLanded';

interface LandedListProps {
  landed: WeekLanded;
  checklistTotal: number;
  /** Zone the digest week was cut in — each stamp's weekday is shown in it. */
  zone: string;
}

function weekday(at: number, zone: string): string {
  try {
    return new Date(at).toLocaleDateString('en', { weekday: 'short', timeZone: zone });
  } catch {
    return new Date(at).toLocaleDateString('en', { weekday: 'short' });
  }
}

/** The checklist items that landed in the viewed week, with the ledger's provenance. */
export function LandedList({ landed, checklistTotal, zone }: LandedListProps) {
  return (
    <div className="px-4 py-3 rounded-lg bg-surface border border-border">
      <p className="text-2xs text-text-muted mb-2">Landed this week</p>
      {landed.items.length === 0 ? (
        <p className="text-xs text-text-muted">No dated checklist completions in this week.</p>
      ) : (
        <ul className="space-y-1.5">
          {landed.items.map((i) => (
            <li key={`${i.moduleId}/${i.itemId}`} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
              <span className="text-text truncate">{i.label}</span>
              <span className="text-text-muted truncate">{i.moduleLabel}</span>
              <span className="ml-auto text-2xs text-text-muted tabular-nums">{weekday(i.at, zone)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-2xs text-text-muted tabular-nums">
        {landed.doneByEnd}/{checklistTotal} dated done by week end
        {landed.undated > 0 && ` · ${landed.undated} undated (done before completion dates were recorded; not in any week)`}
      </p>
    </div>
  );
}
