'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SizeTrendPoint } from '@/lib/packaging/build-history-store';
import { apiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { budgetInputError, getDefaultBudgets, type SizeBudgetsPayload } from '@/lib/packaging/size-verdict';
import { buildSizeTrendModel, whatIf, type ComparePair, type PlatformSeries } from '@/lib/packaging/size-trend-model';
import { SizeTrendChart } from '../SizeTrendChart';

const GIB = 1024 ** 3;

interface TrendsTabProps {
  trend: SizeTrendPoint[];
  /** What the dashboard reported; null = the server did not report budgets. */
  budgets: SizeBudgetsPayload | null;
  onOpenPair: (pair: ComparePair) => void;
  /** Called after a budget was applied, so the dashboard refetches. */
  onApplied: () => void;
}

/**
 * Per-platform size vs the budget the cook gate judges against. Every point is judged
 * by the gate's own rule (size-trend-model -> size-verdict); a flagged point opens
 * Compare on (baseline, regressor); the what-if preview is pure until Apply.
 */
export function TrendsTab({ trend, budgets, onOpenPair, onApplied }: TrendsTabProps) {
  const config = useMemo(
    () => ({ budgets: budgets?.budgets ?? getDefaultBudgets(), failOnRegression: budgets?.failOnRegression ?? false }),
    [budgets],
  );
  const model = useMemo(() => buildSizeTrendModel(trend, config), [trend, config]);
  const [picked, setPicked] = useState<string | null>(null);
  const series = model.series.find((s) => s.platform === picked) ?? model.series[0] ?? null;

  return (
    <div className="rounded border border-border bg-background/60 p-4 space-y-3">
      {budgets?.unreadable && (
        <div className="flex items-center gap-1.5 text-2xs" style={{ color: STATUS_ERROR }} role="alert">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          Budget config is UNREADABLE — these are fail-closed defaults, not your configured budgets.
        </div>
      )}
      {!budgets && (
        <div className="text-2xs text-text-muted">Budgets were not reported by the server — judging against the defaults.</div>
      )}

      {model.series.length > 1 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Platform">
          {model.series.map((s) => (
            <button
              key={s.platform}
              type="button"
              aria-pressed={series?.platform === s.platform}
              onClick={() => setPicked(s.platform)}
              className={`text-2xs px-2 py-0.5 rounded-full border transition-colors ${
                series?.platform === s.platform ? 'border-[var(--systems)] text-text' : 'border-border-bright text-text-muted hover:text-text'
              }`}
            >
              {s.label} · {s.points.length}{s.flaggedCount > 0 ? ` · ${s.flaggedCount} flagged` : ''}
            </button>
          ))}
        </div>
      )}

      <SizeTrendChart
        data={series?.points ?? []}
        height={200}
        title={series ? `${series.label} package size` : 'Package Size Trend'}
        budgetBytes={series?.budget.budgetBytes}
        onOpenPair={onOpenPair}
      />

      {series && <SeriesReadout series={series} />}
      {series && (
        <WhatIfBudget
          key={`${series.platform}:${series.budget.budgetBytes}:${series.budget.growthPercent}`}
          series={series}
          onApplied={onApplied}
        />
      )}
    </div>
  );
}

function SeriesReadout({ series }: { series: PlatformSeries }) {
  const steps = series.points.length - 1;
  return (
    <div className="text-2xs text-text-muted font-mono space-y-0.5">
      <div>
        {series.flaggedCount} flagged · {series.noBaselineCount} without a baseline in this window (growth not evaluated)
      </div>
      {series.deltaPercent != null && series.allowedCompoundPercent != null && (
        <div>
          Grew {series.deltaPercent >= 0 ? '+' : ''}{series.deltaPercent.toFixed(1)}% over {steps} builds; a{' '}
          {series.budget.growthPercent}%/build allowance lets up to +{series.allowedCompoundPercent.toFixed(0)}% through
          unflagged — only the {formatBytes(series.budget.budgetBytes)} budget stops the ratchet.
        </div>
      )}
    </div>
  );
}

function WhatIfBudget({ series, onApplied }: { series: PlatformSeries; onApplied: () => void }) {
  const [gib, setGib] = useState(String(+(series.budget.budgetBytes / GIB).toFixed(2)));
  const [growth, setGrowth] = useState(String(series.budget.growthPercent));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const budgetBytes = Math.round(Number(gib) * GIB);
  const growthPercent = Number(growth);
  const invalid = gib.trim() === '' || growth.trim() === ''
    ? 'enter a budget and a growth allowance'
    : budgetInputError(series.platform, budgetBytes, growthPercent);
  const unchanged = budgetBytes === series.budget.budgetBytes && growthPercent === series.budget.growthPercent;
  // Pure preview — the same rule, a candidate budget, no request.
  const preview = useMemo(
    () => (invalid ? null : whatIf(series.points, { [series.platform]: { budgetBytes, growthPercent } })),
    [invalid, series, budgetBytes, growthPercent],
  );

  const apply = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch('/api/packaging/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-budget', platform: series.platform, budgetBytes, growthPercent }),
      });
      onApplied();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-20 bg-surface-deep border border-border-bright rounded px-1.5 py-0.5 text-xs font-mono text-text outline-none focus:border-[var(--systems)]';
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-2xs text-text-muted">
      <span className="uppercase tracking-wide">What if</span>
      <label className="flex items-center gap-1">
        {series.label} budget (GiB)
        <input type="number" step="0.1" min="0" value={gib} onChange={(e) => setGib(e.target.value)} className={input} />
      </label>
      <label className="flex items-center gap-1">
        growth allowance (%)
        <input type="number" step="1" min="1" max="100" value={growth} onChange={(e) => setGrowth(e.target.value)} className={input} />
      </label>
      <span data-testid="size-whatif-flagged" className="font-mono" style={preview && preview.flagged > 0 ? { color: STATUS_WARNING } : undefined}>
        {preview ? `${preview.flagged} of ${preview.total} ${series.label} builds would be flagged` : invalid}
      </span>
      <button
        type="button"
        onClick={apply}
        disabled={busy || !!invalid || unchanged}
        className="ml-auto px-2 py-0.5 rounded border border-border-bright text-text enabled:hover:border-[var(--systems)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Apply
      </button>
      {status && <span role="alert" style={{ color: STATUS_ERROR }}>{status}</span>}
    </div>
  );
}
