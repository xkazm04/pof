'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_STALE, MODULE_COLORS,
  ACCENT_VIOLET, OPACITY_10, OPACITY_30,
  withOpacity, OPACITY_25, OPACITY_20,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '@/components/modules/core-engine/unique-tabs/_design';
import {
  DEFAULT_UE_EXEC_INPUTS, UE_EXECUTION_STEPS, UE_EXEC_PHASE_LABELS,
  compareWithCanon, fmtExec,
  type CanonComparison, type ExecDivergence, type UeExecInputs, type UeExecPhase, type UeExecStep, type UeExecStepCtx,
} from '@/lib/combat/ue-damage-execution';
import { CalcInput, ExecPhaseHeader, ExecPropRow } from './ExecComponents';

const PHASE_COLOR: Record<UeExecPhase, string> = {
  invuln: STATUS_WARNING,
  capture: MODULE_COLORS.core,
  setbycaller: ACCENT_VIOLET,
  formula: STATUS_ERROR,
  output: STATUS_SUCCESS,
};

const DIVERGENCE_LABEL: Record<ExecDivergence, string> = {
  'armour-curve': 'canon armour soft-caps against hit size: armour / (armour + 5 x hit)',
  'crit-cap': 'canon caps crit chance at 95%',
};

const MOD_OP_STYLE = {
  Override: { backgroundColor: STATUS_STALE + OPACITY_10, color: ACCENT_VIOLET, border: `1px solid ${STATUS_STALE}${OPACITY_30}` },
  Additive: { backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}` },
} as const;

function valueStyle(s: UeExecStep, ctx: UeExecStepCtx): React.CSSProperties | undefined {
  if (s.tone === 'retired') return { color: STATUS_WARNING };
  if (s.tone === 'final') return { color: STATUS_ERROR };
  if (s.tone === 'crit') return { color: ctx.result.isCrit ? STATUS_SUCCESS : STATUS_ERROR };
  return undefined;
}

/** One generic row: every step is declared once, in UE_EXECUTION_STEPS. */
function ExecStepRow({ s, even, ctx, calcActive, codeOpen, onToggleCode, onInput }: {
  s: UeExecStep; even: boolean; ctx: UeExecStepCtx; calcActive: boolean; codeOpen: boolean;
  onToggleCode: (id: string) => void; onInput: (key: keyof UeExecInputs, v: number) => void;
}) {
  const input = calcActive ? s.input : undefined;
  return (
    <div data-testid={`exec-row-${s.id}`}>
      <ExecPropRow name={s.label} even={even} code={s.snippet} codeExpanded={codeOpen} onToggleCode={() => onToggleCode(s.id)}>
        <div className="flex items-center gap-2">
          {s.modOp && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded font-bold" style={MOD_OP_STYLE[s.modOp]}>{s.modOp}</span>
          )}
          {input && (
            <CalcInput value={ctx.inputs[input.key]} onChange={(v) => onInput(input.key, v)}
              step={input.step} min={input.min} max={input.max} label={input.label} />
          )}
          {calcActive && s.expr && <span className="text-text-muted text-xs font-mono">{s.expr(ctx)}</span>}
          {!(input && !s.expr) && (
            <span className={`font-bold ${s.tone ? '' : 'text-text'} ${s.id === 'final' ? 'text-sm' : ''}`} style={valueStyle(s, ctx)}>
              {s.value(ctx)}
            </span>
          )}
          {s.note && (
            <span className="text-xs font-mono uppercase tracking-[0.15em]"
              style={{ color: s.tone === 'retired' ? STATUS_WARNING : 'var(--text-muted)' }}>{s.note}</span>
          )}
        </div>
      </ExecPropRow>
    </div>
  );
}

/** Canon kernel for the same inputs, beside the shipped figure — the retired curve is never the verdict. */
function CanonRow({ cmp }: { cmp: CanonComparison }) {
  const sign = cmp.delta >= 0 ? '+' : '';
  return (
    <div data-testid="exec-canon-row" className="px-3 py-1.5 border-t border-border/20 text-xs font-mono"
      style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-[0.15em]" style={{ color: STATUS_SUCCESS }}>Canon kernel (same inputs)</span>
        <span className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: STATUS_SUCCESS }}>{fmtExec(cmp.canon.total)}</span>
          <span className="text-text-muted">
            {sign}{fmtExec(cmp.delta)} ({sign}{cmp.deltaPct.toFixed(1)}%) vs shipped {fmtExec(cmp.shipped.finalDamage)}
          </span>
        </span>
      </div>
      {cmp.divergences.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-text-muted" aria-label="Where shipped C++ diverges from canon">
          {cmp.divergences.map((d) => <li key={d}>{DIVERGENCE_LABEL[d]}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ExecutionBreakdownPanel() {
  const [calcActive, setCalcActive] = useState(false);
  const [inputs, setInputs] = useState<UeExecInputs>(DEFAULT_UE_EXEC_INPUTS);
  const [expandedCode, setExpandedCode] = useState<Set<string>>(new Set());

  const toggleCode = useCallback((id: string) => {
    setExpandedCode(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const upd = useCallback((key: keyof UeExecInputs, v: number) => {
    setInputs(prev => ({ ...prev, [key]: v }));
  }, []);

  const cmp = useMemo(() => compareWithCanon(inputs), [inputs]);
  const ctx: UeExecStepCtx = { inputs, result: cmp.shipped };

  return (
    <div data-testid="execution-breakdown-panel">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted leading-relaxed">
          UE C++ as shipped (pre-canon armour curve):{' '}
          <code className="font-mono text-text">ARPGDamageExecution::Execute_Implementation</code>
        </p>
        <button onClick={() => setCalcActive(a => !a)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono uppercase tracking-[0.15em] font-bold transition-colors border shrink-0"
          style={calcActive ? {
            backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`,
            borderColor: `${withOpacity(STATUS_SUCCESS, OPACITY_25)}`,
            color: STATUS_SUCCESS,
          } : {
            backgroundColor: 'transparent',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
          data-testid="calc-toggle">
          <span className="w-1.5 h-1.5 rounded-full" style={{
            backgroundColor: calcActive ? STATUS_SUCCESS : 'var(--text-muted)',
            boxShadow: calcActive ? `0 0 6px ${STATUS_SUCCESS}` : 'none',
          }} />
          Calculator {calcActive ? 'ON' : 'OFF'}
        </button>
      </div>
      <p className="text-xs font-mono text-text-muted mb-2 leading-relaxed">
        Mirrors the documented formula. Open UE defect: AttackPower adds 0 in play today
        (docs/superpowers/specs/2026-09-22-combat-attackpower-adds-zero.md).
      </p>

      <BlueprintPanel className="overflow-hidden">
        <div data-testid="execution-steps">
          {UE_EXECUTION_STEPS.map((s, i) => {
            const prev = UE_EXECUTION_STEPS[i - 1];
            const idxInPhase = UE_EXECUTION_STEPS.slice(0, i).filter((p) => p.phase === s.phase).length;
            return (
              <div key={s.id}>
                {prev?.phase !== s.phase && <ExecPhaseHeader label={UE_EXEC_PHASE_LABELS[s.phase]} color={PHASE_COLOR[s.phase]} />}
                <ExecStepRow s={s} even={s.phase !== 'invuln' && idxInPhase % 2 === 0} ctx={ctx} calcActive={calcActive}
                  codeOpen={expandedCode.has(s.id)} onToggleCode={toggleCode} onInput={upd} />
              </div>
            );
          })}

          <div className="px-3 py-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted border-t border-border/20">
            Output modifiers only applied when <code className="font-mono text-text">FinalDamage {'>'} 0</code>
          </div>
          <CanonRow cmp={cmp} />
        </div>
      </BlueprintPanel>
    </div>
  );
}
