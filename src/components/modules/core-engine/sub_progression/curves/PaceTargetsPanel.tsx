'use client';

import { useState } from 'react';
import { Target, Plus, X, Check, RotateCcw } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, MAX_LEVEL } from '../_shared/data';
import type { CurveParams } from '../_shared/curveModel';
import {
  fitCurveToTargets, hoursToLevel, parsePaceTargets, FIT_TOLERANCE_PCT,
  type CurveFit, type FitBound, type FitVerdict,
} from '../_shared/curveFit';

/* -- Pace Targets: fit the curve to milestone hours, preview, apply/revert -- */

interface PaceTargetsPanelProps {
  /** The curve on the sliders now; seeds the default rows' hours. */
  live: CurveParams;
  /** A fit is previewed in the compare pane, awaiting Apply / Revert. */
  previewing: boolean;
  onPreview: (params: CurveParams) => void;
  onApply: () => void;
  onRevert: () => void;
}

interface Row { id: number; level: string; hours: string }

const MAX_ROWS = 6;
const EXTRA_LEVELS = [25, 40, 20, 30, 5, 15, 35, 45];
const VERDICT_COLOR: Record<FitVerdict, string> = { fit: STATUS_SUCCESS, range: STATUS_WARNING, shape: STATUS_ERROR };
const BOUND_LABEL: Record<FitBound, string> = {
  'baseXp.min': 'Base XP min', 'baseXp.max': 'Base XP max',
  'curveExp.min': 'Exponent min', 'curveExp.max': 'Exponent max',
};

const hrs = (h: number) => `${h.toFixed(2)}h`;
const signedPct = (p: number, digits = 0) => `${p >= 0 ? '+' : ''}${p.toFixed(digits)}%`;

function verdictText(fit: CurveFit): string {
  const miss = `worst miss L${fit.worst.level} ${signedPct(fit.worst.errPct)}`;
  if (fit.verdict === 'fit') return `Fit: every target within ±${FIT_TOLERANCE_PCT}%.`;
  if (fit.verdict === 'range') {
    const bounds = fit.limitedBy.map((b) => BOUND_LABEL[b]).join(', ');
    return `Range: the best curve sits on the slider bound (${bounds}); ${miss}. These targets need a value past the slider.`;
  }
  return `Shape: no curve of this family meets these targets; ${miss}. Change the targets or the formula, not the knobs.`;
}

export function PaceTargetsPanel({ live, previewing, onPreview, onApply, onRevert }: PaceTargetsPanelProps) {
  const prefill = (level: number) => hoursToLevel(live, level).toFixed(2);
  const [rows, setRows] = useState<Row[]>(() => [
    { id: 1, level: '10', hours: prefill(10) },
    { id: 2, level: String(MAX_LEVEL), hours: prefill(MAX_LEVEL) },
  ]);
  const [fit, setFit] = useState<CurveFit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edit = (next: Row[]) => { setRows(next); setFit(null); setError(null); };
  const update = (id: number, patch: Partial<Row>) => edit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => {
    const used = new Set(rows.map((r) => Number(r.level)));
    const level = EXTRA_LEVELS.find((l) => !used.has(l)) ?? 1;
    edit([...rows, { id: Math.max(...rows.map((r) => r.id)) + 1, level: String(level), hours: prefill(level) }]);
  };

  const runFit = () => {
    const parsed = parsePaceTargets(rows);
    if (!parsed.ok) { setFit(null); setError(parsed.error); return; }
    const result = fitCurveToTargets(parsed.data);
    setError(null);
    setFit(result);
    onPreview({ baseXp: result.baseXp, curveExp: result.curveExp });
  };

  const inputCls = 'w-14 bg-surface-deep/40 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text';
  const btnCls = 'flex items-center gap-1 px-2 py-1 rounded border text-2xs font-mono uppercase tracking-wider font-bold';

  return (
    <BlueprintPanel color={ACCENT} className="p-5 space-y-3">
      <SectionHeader label="Pace Targets" icon={Target} color={ACCENT} />
      <p className="text-2xs font-mono text-text-muted">Hours to reach each level on the Rewards-tab clock.</p>

      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
            <span>L</span>
            <input aria-label={`Target ${i + 1} level`} className={inputCls} inputMode="numeric" value={row.level}
              onChange={(e) => update(row.id, { level: e.target.value })} />
            <span>=</span>
            <input aria-label={`Target ${i + 1} hours`} className={inputCls} inputMode="decimal" value={row.hours}
              onChange={(e) => update(row.id, { hours: e.target.value })} />
            <span>h</span>
            {rows.length > 1 && (
              <button type="button" aria-label={`Remove target ${i + 1}`} className="ml-auto p-0.5 rounded hover:bg-surface-hover/50"
                onClick={() => edit(rows.filter((r) => r.id !== row.id))}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={addRow} disabled={rows.length >= MAX_ROWS}
          className={`${btnCls} border-border/40 text-text-muted hover:bg-surface-hover/50 disabled:opacity-40`}>
          <Plus className="w-3 h-3" /> Add target
        </button>
        <button type="button" onClick={runFit} className={btnCls}
          style={{ color: ACCENT, borderColor: withOpacity(ACCENT, OPACITY_25), backgroundColor: withOpacity(ACCENT, OPACITY_10) }}>
          <Target className="w-3 h-3" /> Fit
        </button>
      </div>

      {error && <p role="alert" className="text-2xs font-mono" style={{ color: STATUS_ERROR }}>{error}</p>}

      {fit && (
        <div data-testid="pace-fit-result" className="space-y-1.5 pt-2 border-t border-border/40">
          <div className="text-xs font-mono text-text">
            Fitted: base <span className="font-bold">{fit.baseXp}</span> · exp <span className="font-bold">{fit.curveExp.toFixed(2)}</span>
          </div>
          {fit.residuals.map((r) => (
            <div key={r.level} className="flex justify-between text-2xs font-mono text-text-muted">
              <span>L{r.level} target {hrs(r.targetHours)}</span>
              <span>achieved <span className="text-text">{hrs(r.achievedHours)}</span> ({signedPct(r.errPct, 1)})</span>
            </div>
          ))}
          <p data-testid="pace-verdict" data-verdict={fit.verdict} className="text-2xs font-mono font-bold"
            style={{ color: VERDICT_COLOR[fit.verdict] }}>
            {verdictText(fit)}
          </p>
        </div>
      )}

      {previewing && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
          <span className="text-2xs font-mono text-text-muted mr-auto">Previewing fit vs current</span>
          <button type="button" onClick={onApply} className={btnCls}
            style={{ color: STATUS_SUCCESS, borderColor: withOpacity(STATUS_SUCCESS, OPACITY_25) }}>
            <Check className="w-3 h-3" /> Apply fit
          </button>
          <button type="button" onClick={onRevert} className={`${btnCls} border-border/40 text-text-muted hover:bg-surface-hover/50`}>
            <RotateCcw className="w-3 h-3" /> Revert
          </button>
        </div>
      )}
    </BlueprintPanel>
  );
}
