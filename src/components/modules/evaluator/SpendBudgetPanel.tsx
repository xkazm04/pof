'use client';

import { useState } from 'react';
import { Wallet, Pencil, Check, X } from 'lucide-react';
import { MeterBar } from '@/components/ui/MeterBar';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { formatUsd } from '@/lib/cli-spend/format';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { BudgetStatus, BudgetConfig } from '@/types/cli-spend';

/** Threshold color for a budget meter: green < 80% < amber < 100% < red. */
function budgetColor(pct: number): string {
  if (pct >= 100) return STATUS_ERROR;
  if (pct >= 80) return STATUS_WARNING;
  return STATUS_SUCCESS;
}

interface SpendBudgetPanelProps {
  status: BudgetStatus;
  isSaving: boolean;
  onSave: (config: BudgetConfig) => Promise<void>;
}

/**
 * Daily + monthly budget meters with an inline editor. Reads the live
 * spend-against-budget status and lets the user set/clear each limit. An empty
 * input clears that limit ("no limit").
 */
export function SpendBudgetPanel({ status, isSaving, onSave }: SpendBudgetPanelProps) {
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState(status.config.dailyLimitUsd?.toString() ?? '');
  const [monthly, setMonthly] = useState(status.config.monthlyLimitUsd?.toString() ?? '');

  const startEdit = () => {
    setDaily(status.config.dailyLimitUsd?.toString() ?? '');
    setMonthly(status.config.monthlyLimitUsd?.toString() ?? '');
    setEditing(true);
  };

  const save = async () => {
    await onSave({
      dailyLimitUsd: daily.trim() === '' ? null : Number(daily),
      monthlyLimitUsd: monthly.trim() === '' ? null : Number(monthly),
    });
    setEditing(false);
  };

  return (
    <SurfaceCard level={2} className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
          <h3 className="text-xs font-semibold text-text">Budget guard</h3>
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-2xs text-text-muted hover:text-text transition-colors focus-ring rounded px-1.5 py-0.5"
          >
            <Pencil className="w-2.5 h-2.5" /> Edit limits
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={isSaving}
              className="flex items-center gap-1 text-2xs text-text-muted hover:text-text transition-colors focus-ring rounded px-1.5 py-0.5 disabled:opacity-50"
            >
              <Check className="w-2.5 h-2.5" /> Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-2xs text-text-muted hover:text-text transition-colors focus-ring rounded px-1.5 py-0.5"
            >
              <X className="w-2.5 h-2.5" /> Cancel
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <LimitInput label="Daily limit (USD)" value={daily} onChange={setDaily} />
          <LimitInput label="Monthly limit (USD)" value={monthly} onChange={setMonthly} />
          <p className="col-span-2 text-2xs text-text-muted">
            Leave a field blank for no limit. When a limit is set, expensive task launches that would
            exceed it prompt a confirmation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BudgetMeter
            label="Today"
            spend={status.todaySpendUsd}
            limit={status.config.dailyLimitUsd}
            pct={status.dailyPct}
            remaining={status.dailyRemainingUsd}
          />
          <BudgetMeter
            label="This month"
            spend={status.monthSpendUsd}
            limit={status.config.monthlyLimitUsd}
            pct={status.monthlyPct}
            remaining={status.monthlyRemainingUsd}
          />
        </div>
      )}
    </SurfaceCard>
  );
}

function BudgetMeter({
  label,
  spend,
  limit,
  pct,
  remaining,
}: {
  label: string;
  spend: number;
  limit: number | null;
  pct: number | null;
  remaining: number | null;
}) {
  const exceeded = remaining != null && remaining < 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xs text-text-muted uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-text tabular-nums">
          {formatUsd(spend)}
          {limit != null && <span className="text-text-muted font-normal"> / {formatUsd(limit)}</span>}
        </span>
      </div>
      {limit != null && pct != null ? (
        <>
          <MeterBar
            value={Math.min(100, pct)}
            color={budgetColor(pct)}
            ariaLabel={`${label} budget used`}
            valueText={`${Math.round(pct)}% of budget used`}
            height={6}
          />
          <p className="text-2xs mt-1" style={{ color: exceeded ? STATUS_ERROR : 'var(--text-muted)' }}>
            {exceeded
              ? `Over by ${formatUsd(Math.abs(remaining!))}`
              : `${formatUsd(remaining ?? 0)} remaining (${Math.round(pct)}%)`}
          </p>
        </>
      ) : (
        <p className="text-2xs text-text-muted mt-1">No limit set</p>
      )}
    </div>
  );
}

function LimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-2xs text-text-muted block mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="None"
        className="w-full px-2 py-1.5 text-xs rounded-md bg-background border border-border text-text focus-ring"
      />
    </label>
  );
}
