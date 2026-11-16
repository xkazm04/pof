/**
 * The workbench's synergy reveal: when a NEW synergy forms, the panel glows,
 * opens, and marks exactly the synergies that just formed. Nudging a magnitude
 * slider forms no synergy, so it must neither re-open a panel the designer
 * collapsed nor re-flag the synergies that were already there.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAffixWorkbench } from '@/components/modules/core-engine/sub_loot/affix-workbench/hooks';
import { AFFIX_POOL } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';

afterEach(() => cleanup());

const pool = (id: string) => {
  const e = AFFIX_POOL.find((a) => a.id === id);
  if (!e) throw new Error(`no pool entry ${id}`);
  return e;
};
const PRECISION = pool('aff-precision'); // Affix.CritChance
const VICIOUS = pool('aff-vicious'); // Affix.CritDmg
const VAMPIRIC = pool('aff-vampiric'); // Affix.LifeSteal

describe('useAffixWorkbench — synergy reveal fires only on a newly formed synergy', () => {
  it('a magnitude nudge does not re-open a synergy panel the designer collapsed', () => {
    const { result } = renderHook(() => useAffixWorkbench());
    act(() => { result.current.addAffix(PRECISION); });
    act(() => { result.current.addAffix(VICIOUS); });
    expect(result.current.activeSynergies.map((s) => s.label)).toEqual(['Crit Stacking']);
    act(() => { result.current.setExpandedSynergies(false); });
    act(() => { result.current.updateAffixMagnitude(VICIOUS.tag, 25); });
    expect(result.current.expandedSynergies).toBe(false);
  });

  it('marks only the synergy that just formed as new', () => {
    const { result } = renderHook(() => useAffixWorkbench());
    act(() => { result.current.addAffix(PRECISION); });
    act(() => { result.current.addAffix(VICIOUS); });
    expect([...result.current.newSynergyLabels]).toEqual(['Crit Stacking']);
    act(() => { result.current.addAffix(VAMPIRIC); });
    expect([...result.current.newSynergyLabels]).toEqual(['Vampiric Crits']);
  });
});
