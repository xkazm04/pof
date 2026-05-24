'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_STALE,
  ACCENT_VIOLET, OPACITY_10, OPACITY_30,
  withOpacity, OPACITY_25, OPACITY_20,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '@/components/modules/core-engine/unique-tabs/_design';
import type { CalcInputs } from './types';
import { DEFAULT_CALC, fmtNum } from './types';
import { CalcInput, ExecPhaseHeader, ExecPropRow } from './ExecComponents';
import { EXEC_SNIPPETS } from './exec-snippets';
import { ExecAttributePhase } from './ExecAttributePhase';

export function ExecutionBreakdownPanel() {
  const [calcActive, setCalcActive] = useState(false);
  const [inputs, setInputs] = useState<CalcInputs>(DEFAULT_CALC);
  const [expandedCode, setExpandedCode] = useState<Set<string>>(new Set());

  const toggleCode = useCallback((id: string) => {
    setExpandedCode(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const upd = useCallback((key: keyof CalcInputs, v: number) => {
    setInputs(prev => ({ ...prev, [key]: v }));
  }, []);

  const c = useMemo(() => {
    const rawDamage = inputs.baseDamage + inputs.attackPower * inputs.scaling;
    const isCrit = inputs.critRoll < inputs.critChance;
    const critMultiplier = isCrit ? (1 + inputs.critDamage) : 1;
    const armorReduction = inputs.armor / (inputs.armor + 100);
    const finalDamage = Math.max(rawDamage * critMultiplier * (1 - armorReduction), 0);
    return { rawDamage, isCrit, critMultiplier, armorReduction, finalDamage };
  }, [inputs]);

  return (
    <div data-testid="execution-breakdown-panel">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted leading-relaxed">
          Step-by-step breakdown of{' '}
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

      <BlueprintPanel className="overflow-hidden">
        <div data-testid="execution-steps">
          <ExecPhaseHeader label="Invulnerability Check" color={STATUS_WARNING} />
          <ExecPropRow name="State_Invulnerable" code={EXEC_SNIPPETS.invuln}
            codeExpanded={expandedCode.has('invuln')} onToggleCode={() => toggleCode('invuln')}>
            <span className="text-text-muted">{'→'} skip all damage</span>
          </ExecPropRow>

          <ExecAttributePhase
            calcActive={calcActive} inputs={inputs} upd={upd}
            expandedCode={expandedCode} toggleCode={toggleCode}
          />

          <ExecPhaseHeader label="2. SetByCaller Resolution" color={ACCENT_VIOLET} />
          <ExecPropRow name="Data.Damage.Base" even code={EXEC_SNIPPETS.base}
            codeExpanded={expandedCode.has('base')} onToggleCode={() => toggleCode('base')}>
            <div className="flex items-center gap-2">
              {calcActive
                ? <CalcInput value={inputs.baseDamage} onChange={v => upd('baseDamage', v)} step={5} min={0} label="BaseDamage" />
                : <span className="text-text">{fmtNum(inputs.baseDamage)}</span>}
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">(required)</span>
            </div>
          </ExecPropRow>
          <ExecPropRow name="Data.Damage.Scaling" code={EXEC_SNIPPETS.scaling}
            codeExpanded={expandedCode.has('scaling')} onToggleCode={() => toggleCode('scaling')}>
            <div className="flex items-center gap-2">
              {calcActive
                ? <CalcInput value={inputs.scaling} onChange={v => upd('scaling', v)} step={0.1} min={0} label="Scaling" />
                : <span className="text-text">{fmtNum(inputs.scaling)}</span>}
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">(default 1.0)</span>
            </div>
          </ExecPropRow>

          <ExecPhaseHeader label="3. Damage Formula" color={STATUS_ERROR} />
          <ExecPropRow name="Step 1 > RawDamage" even code={EXEC_SNIPPETS.raw}
            codeExpanded={expandedCode.has('raw')} onToggleCode={() => toggleCode('raw')}>
            <div className="flex items-center gap-1.5">
              {calcActive && (
                <span className="text-text-muted text-xs font-mono">
                  {fmtNum(inputs.baseDamage)} + {fmtNum(inputs.attackPower)} x {fmtNum(inputs.scaling)} =
                </span>
              )}
              <span className="font-bold text-text">{fmtNum(c.rawDamage)}</span>
            </div>
          </ExecPropRow>
          <ExecPropRow name="Step 2 > CritRoll" code={EXEC_SNIPPETS.crit}
            codeExpanded={expandedCode.has('crit')} onToggleCode={() => toggleCode('crit')}>
            <div className="flex items-center gap-2">
              {calcActive && (
                <>
                  <CalcInput value={inputs.critRoll} onChange={v => upd('critRoll', v)} step={0.05} min={0} max={1} label="CritRoll" />
                  <span className="text-xs font-mono text-text-muted">{'<'} {fmtNum(inputs.critChance)}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: c.isCrit ? STATUS_SUCCESS : STATUS_ERROR }}>
                    {c.isCrit ? 'CRIT' : 'miss'}
                  </span>
                </>
              )}
              <span className="font-bold text-text">x{fmtNum(c.critMultiplier)}</span>
            </div>
          </ExecPropRow>
          <ExecPropRow name="Step 3 > ArmorReduction" even code={EXEC_SNIPPETS.ar}
            codeExpanded={expandedCode.has('ar')} onToggleCode={() => toggleCode('ar')}>
            <div className="flex items-center gap-1.5">
              {calcActive && (
                <span className="text-text-muted text-xs font-mono">
                  {fmtNum(inputs.armor)} / ({fmtNum(inputs.armor)} + 100) =
                </span>
              )}
              <span className="font-bold" style={{ color: STATUS_WARNING }}>
                {(c.armorReduction * 100).toFixed(1)}% reduced
              </span>
            </div>
          </ExecPropRow>
          <ExecPropRow name="Step 4 > FinalDamage" code={EXEC_SNIPPETS.final}
            codeExpanded={expandedCode.has('final')} onToggleCode={() => toggleCode('final')}>
            <div className="flex items-center gap-1.5">
              {calcActive && (
                <span className="text-text-muted text-xs font-mono">
                  {fmtNum(c.rawDamage)} x {fmtNum(c.critMultiplier)} x {(1 - c.armorReduction).toFixed(3)} =
                </span>
              )}
              <span className="font-bold text-sm" style={{ color: STATUS_ERROR }}>
                {fmtNum(c.finalDamage)}
              </span>
            </div>
          </ExecPropRow>

          <ExecPhaseHeader label="4. Meta Attribute Output" color={STATUS_SUCCESS} />
          <ExecPropRow name="IncomingCrit" even code={EXEC_SNIPPETS.outcrit}
            codeExpanded={expandedCode.has('outcrit')} onToggleCode={() => toggleCode('outcrit')}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded font-bold"
                style={{ backgroundColor: STATUS_STALE + OPACITY_10, color: ACCENT_VIOLET, border: `1px solid ${STATUS_STALE}${OPACITY_30}` }}>
                Override
              </span>
              <span className="text-text font-bold">{c.isCrit ? '1.0' : '0.0'}</span>
              <span className="text-xs font-mono font-bold" style={{ color: c.isCrit ? STATUS_SUCCESS : STATUS_ERROR }}>
                ({c.isCrit ? 'crit' : 'no crit'})
              </span>
            </div>
          </ExecPropRow>
          <ExecPropRow name="IncomingDamage" code={EXEC_SNIPPETS.outdmg}
            codeExpanded={expandedCode.has('outdmg')} onToggleCode={() => toggleCode('outdmg')}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded font-bold"
                style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}` }}>
                Additive
              </span>
              <span className="font-bold" style={{ color: STATUS_ERROR }}>{fmtNum(c.finalDamage)}</span>
            </div>
          </ExecPropRow>

          <div className="px-3 py-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted border-t border-border/20">
            Output modifiers only applied when <code className="font-mono text-text">FinalDamage {'>'} 0</code>
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}
