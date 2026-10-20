import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { FilterEvaluation, LootFilterRuleset } from '@/lib/loot-filter/types';
import { evaluateRuleset } from '@/lib/loot-filter/engine';
import { useEvaluationDelta } from '@/components/modules/core-engine/sub_inventory/loot-filter/useEvaluationDelta';

const items: ItemData[] = ['1', '2', '3', '4'].map((id) => ({
  id, name: `Item ${id}`, type: 'Weapon', subtype: 'Sword', rarity: id === '4' ? 'Epic' : 'Common', stats: [], description: '',
}));
const rs = (action: 'show' | 'hide'): LootFilterRuleset => ({
  id: 'r', name: 'r', updatedAt: '',
  rules: [{ id: 'a', name: 'a', enabled: true, action, condition: { rarities: ['Common'] }, style: {} }],
});

describe('useEvaluationDelta', () => {
  it('reports the delta after an edit flips items, then clears when the next evaluation changes nothing and after the visibility window', () => {
    const shown = evaluateRuleset(items, rs('show'));
    const hidden = evaluateRuleset(items, rs('hide'));
    const { result, rerender } = renderHook(({ ev }: { ev: FilterEvaluation }) => useEvaluationDelta(ev), { initialProps: { ev: shown } });
    expect(result.current).toBeNull();
    rerender({ ev: hidden });
    expect(result.current).toMatchObject({ shown: -3, hidden: 3, changed: 3 });
    expect(result.current?.changes).toHaveLength(3);
    rerender({ ev: evaluateRuleset(items, rs('hide')) });
    expect(result.current).toBeNull();
  });

  it('clears by itself after the visibility window', async () => {
    const { result, rerender } = renderHook(({ ev }: { ev: FilterEvaluation }) => useEvaluationDelta(ev, 20), { initialProps: { ev: evaluateRuleset(items, rs('show')) } });
    rerender({ ev: evaluateRuleset(items, rs('hide')) });
    expect(result.current?.changed).toBe(3);
    await waitFor(() => expect(result.current).toBeNull());
  });


  it('stays null when an evaluation changes without changing any action', () => {
    const a = evaluateRuleset(items, rs('show'));
    const b = evaluateRuleset(items, rs('show'));
    const { result, rerender } = renderHook(({ ev }: { ev: FilterEvaluation }) => useEvaluationDelta(ev), { initialProps: { ev: a } });
    rerender({ ev: b });
    expect(result.current).toBeNull();
  });
});
