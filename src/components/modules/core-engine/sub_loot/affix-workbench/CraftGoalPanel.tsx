'use client';

import { Calculator, AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, ACCENT_EMERALD,
  OPACITY_5, OPACITY_15, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, GlowStat } from '@/components/modules/core-engine/unique-tabs/_design';
import { CURRENCIES } from './constants';
import type { CraftGoalReport } from './craftGoal';

interface CraftGoalPanelProps {
  report: CraftGoalReport | null;
  /** Price the current hand-built item. Omitted = read-only report. */
  onPrice?: () => void;
  disabled?: boolean;
}

const successColor = (rate: number) => (rate >= 0.8 ? STATUS_SUCCESS : rate >= 0.4 ? STATUS_WARNING : STATUS_ERROR);

/**
 * "Price this item": the hand-built affix set as a craft goal, priced by a
 * seeded Monte Carlo over the crafting kernel. Unreachable goals show why;
 * priced goals headline Forging Potential, the one resource every craft spends.
 */
export function CraftGoalPanel({ report, onPrice, disabled = false }: CraftGoalPanelProps) {
  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-3.5 h-3.5" style={{ color: ACCENT_EMERALD }} />
        <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text">Craft cost</span>
        {onPrice && (
          <button type="button" onClick={onPrice} disabled={disabled}
            className="ml-auto px-2 py-1 rounded text-xs font-mono font-bold transition-opacity disabled:opacity-40"
            style={{ color: ACCENT_EMERALD, border: `1px solid ${withOpacity(ACCENT_EMERALD, OPACITY_30)}`, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_5) }}>
            Price this item
          </button>
        )}
      </div>

      {!report && (
        <p className="text-xs font-mono text-text-muted">
          Simulates crafting this affix set from an empty base with a copy of the default wallet. Your wallet and craft log are untouched.
        </p>
      )}

      {report?.status === 'unreachable' && (
        <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
          style={{ border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_15)}`, backgroundColor: withOpacity(STATUS_ERROR, OPACITY_5) }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-bold" style={{ color: STATUS_ERROR }}>Unreachable by crafting</div>
            <div className="text-xs font-mono text-text-muted">{report.reason}</div>
          </div>
        </div>
      )}

      {report?.status === 'priced' && <PricedReport report={report} />}
    </BlueprintPanel>
  );
}

function PricedReport({ report }: { report: Extract<CraftGoalReport, { status: 'priced' }> }) {
  const { spend, crafts, failures, runs } = report;
  const others = spend ? CURRENCIES.filter((c) => c.id !== 'forging' && spend[c.id].mean > 0) : [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div data-testid="craft-goal-success">
          <GlowStat label="Success in wallet" value={`${(report.successRate * 100).toFixed(1)}%`}
            unit={`of ${runs} runs`} color={successColor(report.successRate)} />
        </div>
        {spend && (
          <div data-testid="craft-goal-forging">
            <GlowStat label="Forging Potential" value={spend.forging.mean}
              unit={`mean / p90 ${spend.forging.p90}`} color={ACCENT_EMERALD} />
          </div>
        )}
      </div>

      {spend ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {others.map((c) => (
            <span key={c.id} className="px-1.5 py-0.5 rounded" title={`${c.name}: mean / p50 / p90`}
              style={{ color: c.color, border: `1px solid ${withOpacity(c.color, OPACITY_15)}` }}>
              {c.icon} {spend[c.id].mean} / {spend[c.id].p50} / {spend[c.id].p90}
            </span>
          ))}
          {crafts && <span className="ml-auto text-text-muted">crafts p50 {crafts.p50} / p90 {crafts.p90}</span>}
        </div>
      ) : (
        <p className="text-xs font-mono" style={{ color: STATUS_ERROR }}>No run reached this item within the default wallet.</p>
      )}

      {(failures.walletExhausted > 0 || failures.stepCap > 0 || failures.stuck > 0) && (
        <p className="text-xs font-mono text-text-muted">
          Misses: {failures.walletExhausted} ran out of currency
          {failures.stepCap > 0 && `, ${failures.stepCap} hit the step cap`}
          {failures.stuck > 0 && `, ${failures.stuck} found no legal craft`}.
        </p>
      )}
    </div>
  );
}
