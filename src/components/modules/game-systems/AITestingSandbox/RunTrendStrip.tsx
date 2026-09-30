'use client';

import { TrendingDown, TrendingUp, Pencil } from 'lucide-react';
import type { ScenarioRunRecord } from '@/types/ai-testing';
import type { ScenarioTrend } from '@/lib/ai-testing/run-trend';
import { OPACITY_15, OPACITY_30, STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { STATUS_META } from './constants';

/**
 * A scenario's retained report-graded runs as a compact strip, oldest -> newest
 * left to right. Each run is a distinct glyph (check / cross / warning), so the
 * strip reads without colour; the whole strip carries one spoken summary.
 */
export function RunTrendStrip({ name, history }: { name: string; history: readonly ScenarioRunRecord[] }) {
  if (history.length === 0) return null;
  const spoken = `${name} run history, newest first: ${history.map((h) => h.status).join(', ')}`;
  return (
    <span role="img" aria-label={spoken} title={spoken} className="flex flex-row-reverse items-center gap-0.5 flex-shrink-0">
      {history.map((h) => {
        const meta = STATUS_META[h.status];
        const Icon = meta.icon;
        return (
          <Icon
            key={h.runId}
            data-testid="run-outcome"
            className="w-2.5 h-2.5"
            style={{ color: meta.color }}
            aria-hidden="true"
          />
        );
      })}
    </span>
  );
}

const CHIP = {
  regressed: { label: 'Regressed', icon: TrendingDown, color: STATUS_ERROR, was: 'passed on its previous run and does not pass now' },
  fixed: { label: 'Fixed', icon: TrendingUp, color: STATUS_SUCCESS, was: 'did not pass on its previous run and passes now' },
} as const;

/** "Regressed" / "Fixed" since the previous run; nothing for any other trend. */
export function TrendChip({ trend }: { trend: ScenarioTrend }) {
  if (trend.kind !== 'regressed' && trend.kind !== 'fixed') return null;
  const chip = CHIP[trend.kind];
  const Icon = chip.icon;
  const why = `This scenario ${chip.was}${trend.afterEdit ? ', after an edit to its definition' : ' with its definition unchanged'}.`;
  return (
    <span
      className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ backgroundColor: `${chip.color}${OPACITY_15}`, color: chip.color, border: `1px solid ${chip.color}${OPACITY_30}` }}
      title={why}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {chip.label}
      {trend.afterEdit && <Pencil className="w-2.5 h-2.5" aria-hidden="true" />}
      <span className="sr-only"> — {trend.afterEdit ? 'after an edit' : 'definition unchanged'}</span>
    </span>
  );
}
