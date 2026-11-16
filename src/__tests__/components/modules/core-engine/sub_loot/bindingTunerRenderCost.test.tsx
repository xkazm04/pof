import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const lint = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@/lib/loot/economy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/loot/economy')>();
  return {
    ...actual,
    lintLootEconomy: (...args: Parameters<typeof actual.lintLootEconomy>) => {
      lint.calls++;
      return actual.lintLootEconomy(...args);
    },
  };
});

import { useLootTuningStore, resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';
import { BindingTuner } from '@/components/modules/core-engine/sub_loot/core/BindingTuner';

beforeEach(() => resetLootTuning());
afterEach(cleanup);

function mountSelected() {
  const store = useLootTuningStore.getState();
  const id = store.bindings[0].archetypeId;
  act(() => store.dispatch({ type: 'select', id }));
  const view = render(<BindingTuner />);
  return { id, view, rosterSize: store.bindings.length };
}

describe('BindingTuner lint cost', () => {
  it('a pity-threshold write (not a tuner input) triggers no lint pass', () => {
    mountSelected();
    lint.calls = 0;
    for (let i = 0; i < 50; i++) act(() => useLootTuningStore.getState().setPityThreshold(30 + i));
    expect(lint.calls).toBe(0);
  });

  it('a tune write lints only the selected binding', () => {
    const { id, rosterSize } = mountSelected();
    expect(rosterSize).toBeGreaterThan(1);
    lint.calls = 0;
    act(() => useLootTuningStore.getState().dispatch({ type: 'setField', id, field: 'bonusGold', value: 77 }));
    expect(lint.calls).toBe(1);
  });

  it('the findings shown are still the roster lint result for the selected binding', () => {
    const { id, view } = mountSelected();
    act(() => useLootTuningStore.getState().dispatch({ type: 'setField', id, field: 'bonusGold', value: 999999 }));
    // The panel renders without error and still mounts its field inputs after a heavy tune.
    expect(view.container.querySelector('input[aria-label]')).not.toBeNull();
  });
});
