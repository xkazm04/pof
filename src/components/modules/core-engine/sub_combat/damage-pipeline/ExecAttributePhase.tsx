'use client';

import { MODULE_COLORS } from '@/lib/chart-colors';
import type { CalcInputs } from './types';
import { fmtNum } from './types';
import { CalcInput, ExecPhaseHeader, ExecPropRow } from './ExecComponents';
import { EXEC_SNIPPETS } from './exec-snippets';

interface ExecAttributePhaseProps {
  calcActive: boolean;
  inputs: CalcInputs;
  upd: (key: keyof CalcInputs, v: number) => void;
  expandedCode: Set<string>;
  toggleCode: (id: string) => void;
}

/**
 * "1. Attribute Capture" block of ExecutionBreakdownPanel.
 * Extracted as its own sub-component to keep the parent .tsx under 200 LOC.
 */
export function ExecAttributePhase({
  calcActive, inputs, upd, expandedCode, toggleCode,
}: ExecAttributePhaseProps) {
  return (
    <>
      <ExecPhaseHeader label="1. Attribute Capture" color={MODULE_COLORS.core} />
      <ExecPropRow name="Source > AttackPower" even code={EXEC_SNIPPETS.ap}
        codeExpanded={expandedCode.has('ap')} onToggleCode={() => toggleCode('ap')}>
        {calcActive
          ? <CalcInput value={inputs.attackPower} onChange={v => upd('attackPower', v)} step={5} min={0} label="AttackPower" />
          : <span className="text-text">{fmtNum(inputs.attackPower)}</span>}
      </ExecPropRow>
      <ExecPropRow name="Source > CriticalChance" code={EXEC_SNIPPETS.cc}
        codeExpanded={expandedCode.has('cc')} onToggleCode={() => toggleCode('cc')}>
        {calcActive
          ? <CalcInput value={inputs.critChance} onChange={v => upd('critChance', v)} step={0.05} min={0} max={1} label="CriticalChance" />
          : <span className="text-text">{fmtNum(inputs.critChance)}</span>}
      </ExecPropRow>
      <ExecPropRow name="Source > CriticalDamage" even code={EXEC_SNIPPETS.cd}
        codeExpanded={expandedCode.has('cd')} onToggleCode={() => toggleCode('cd')}>
        {calcActive
          ? <CalcInput value={inputs.critDamage} onChange={v => upd('critDamage', v)} step={0.1} min={0} label="CriticalDamage" />
          : <span className="text-text">{fmtNum(inputs.critDamage)}</span>}
      </ExecPropRow>
      <ExecPropRow name="Target > Armor" code={EXEC_SNIPPETS.armor}
        codeExpanded={expandedCode.has('armor')} onToggleCode={() => toggleCode('armor')}>
        {calcActive
          ? <CalcInput value={inputs.armor} onChange={v => upd('armor', v)} step={5} min={0} label="Armor" />
          : <span className="text-text">{fmtNum(inputs.armor)}</span>}
      </ExecPropRow>
    </>
  );
}
