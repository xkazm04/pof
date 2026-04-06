'use client';

import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_STALE,
  ACCENT_VIOLET, OPACITY_10, OPACITY_30,
  withOpacity, OPACITY_20,
} from '@/lib/chart-colors';
import type { CalcInputs } from './types';
import { fmtNum } from './types';
import { CalcInput, ExecPhaseHeader, ExecPropRow } from './ExecComponents';

interface CalcResult {
  rawDamage: number;
  isCrit: boolean;
  critMultiplier: number;
  armorReduction: number;
  finalDamage: number;
}

interface ExecFormulaStepsProps {
  calcActive: boolean;
  inputs: CalcInputs;
  c: CalcResult;
  expandedCode: Set<string>;
  toggleCode: (id: string) => void;
  upd: (key: keyof CalcInputs, v: number) => void;
}

export function ExecFormulaSteps({ calcActive, inputs, c, expandedCode, toggleCode, upd }: ExecFormulaStepsProps) {
  return (
    <>
      {/* 3. Damage Formula */}
      <ExecPhaseHeader label="3. Damage Formula" color={STATUS_ERROR} />
      <ExecPropRow name="Step 1 > RawDamage" even
        code="const float RawDamage = BaseDamage + AttackPower * Scaling;"
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
      <ExecPropRow name="Step 2 > CritRoll"
        code={`const bool bIsCrit = FMath::FRand() < CriticalChance;\nconst float CritMultiplier = bIsCrit ? (1.f + CriticalDamage) : 1.f;`}
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
      <ExecPropRow name="Step 3 > ArmorReduction" even
        code="const float ArmorReduction = Armor / (Armor + 100.f);"
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
      <ExecPropRow name="Step 4 > FinalDamage"
        code={`float FinalDamage = RawDamage * CritMultiplier * (1.f - ArmorReduction);\nFinalDamage = FMath::Max(FinalDamage, 0.f);`}
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

      {/* 4. Meta Attribute Output */}
      <ExecPhaseHeader label="4. Meta Attribute Output" color={STATUS_SUCCESS} />
      <ExecPropRow name="IncomingCrit" even
        code={`OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(\n    UARPGAttributeSet::GetIncomingCritAttribute(),\n    EGameplayModOp::Override,\n    bIsCrit ? 1.f : 0.f));`}
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
      <ExecPropRow name="IncomingDamage"
        code={`OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(\n    UARPGAttributeSet::GetIncomingDamageAttribute(),\n    EGameplayModOp::Additive,\n    FinalDamage));`}
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
    </>
  );
}
