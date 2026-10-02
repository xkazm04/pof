import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { useLootTuningStore, resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';
import { EVCalculator } from '@/components/modules/core-engine/sub_loot/core/EVCalculator';
import { EnemyLootBindingSection } from '@/components/modules/core-engine/sub_loot/core/EnemyLootBinding';
import { BindingTuner } from '@/components/modules/core-engine/sub_loot/core/BindingTuner';
import { LootFilters } from '@/components/modules/core-engine/sub_loot/LootFilters';
import { computeExpectedValue } from '@/lib/loot/economy';
import { generateEnemyLootCpp } from '@/components/modules/core-engine/sub_loot/_shared/codegen';

// Every loot panel on the Core tab reads ONE tuned roster and ONE gold table held in
// useLootTuningStore: the EV calculator, the binding cards + C++ export, and the header
// Enemy Source picker that focuses the tuner.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

const evPerKillOf = (archetypeId: string) => {
  const card = screen.getByTestId(`ev-card-${archetypeId}`);
  const row = within(card).getByText('EV / kill').parentElement!;
  return row.textContent!.replace('EV / kill', '');
};

beforeEach(() => resetLootTuning());
afterEach(cleanup);

describe('Core-tab loot panels read the tuning store', () => {
  it('EV panel shows the goal-seeked Melee Grunt, not the static defaults', () => {
    render(<EVCalculator />);
    expect(evPerKillOf('MeleeGrunt')).toBe('23.9g');
    act(() => useLootTuningStore.getState().dispatch({ type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 }));
    expect(evPerKillOf('MeleeGrunt')).toBe('29.9g');
  });

  it('a sell value edited in the EV panel is the gold table goal-seek solves against', () => {
    render(<EVCalculator />);
    fireEvent.change(screen.getByLabelText('Rare sell value'), { target: { value: '100' } });
    expect(useLootTuningStore.getState().rarityGold.Rare).toBe(100);
    act(() => useLootTuningStore.getState().dispatch({ type: 'goalSeek', id: 'MeleeGrunt', targetEV: 30 }));
    const s = useLootTuningStore.getState();
    const tuned = s.bindings.find((b) => b.archetypeId === 'MeleeGrunt')!;
    expect(computeExpectedValue(tuned, s.rarityGold)).toBe(30);
    expect(Math.abs(parseFloat(evPerKillOf('MeleeGrunt')) - 30)).toBeLessThanOrEqual(0.5);
  });

  it('the copied C++ carries the tuned drop chance', () => {
    act(() => useLootTuningStore.getState().dispatch({ type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 0.4 }));
    const line = 'Melee Grunt: LootTable=LT_Grunt, DropChance=0.40, Gold=15';
    expect(generateEnemyLootCpp(useLootTuningStore.getState().bindings)).toContain(line);
    render(<EnemyLootBindingSection />);
    fireEvent.click(screen.getByRole('button', { name: /C\+\+/ }));
    expect(screen.getByText((_, el) => el?.tagName === 'PRE' && el.textContent!.includes(line))).toBeTruthy();
  });

  it('header Enemy Source picks one of the 22 bindings by tier and focuses the tuner', () => {
    render(
      <>
        <LootFilters rarityFilter="All" setRarityFilter={() => {}} activeRarityColor="currentColor" />
        <BindingTuner />
      </>,
    );
    const select = screen.getByLabelText('Enemy Source') as HTMLSelectElement;
    const groups = [...select.querySelectorAll('optgroup')].map((g) => `${g.label} ${g.querySelectorAll('option').length}`);
    expect(groups).toEqual(['Minion 6', 'Standard 6', 'Elite 6', 'Boss 4']);
    fireEvent.change(select, { target: { value: 'Brute' } });
    expect(useLootTuningStore.getState().selectedId).toBe('Brute');
    expect(screen.getByText('Stone Brute · LT_Brute')).toBeTruthy();
  });
});
