import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import {
  encounterReducer, initialEncounterState, resetEncounterDraft, useEncounterDraftStore,
  type EncounterState,
} from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';
import { CombatChoreographyEditor } from '@/components/modules/core-engine/sub_combat/choreography';
import { COMBAT_SUBTABS } from '@/components/modules/core-engine/sub_combat/_shared/data';
import { getSections } from '@/components/modules/core-engine/unique-tabs/feature-map-config';

// The Encounter Choreographer is mounted as the Combat 'Encounter' tab; its draft
// lives in a module-level store over a pure reducer (survives the AnimatePresence
// tab remount), and a pinned baseline is untouched by later edits.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
beforeEach(() => resetEncounterDraft());
afterEach(cleanup);

const run = (s: EncounterState, ...actions: Parameters<typeof encounterReducer>[1][]) =>
  actions.reduce(encounterReducer, s);

describe('encounterReducer — baseline, revert, wave removal, undo', () => {
  it('case 6: a pinned baseline is untouched by later edits; revert restores the draft', () => {
    const s0 = initialEncounterState();
    const pinned = run(s0, { type: 'pinBaseline' });
    const edited = run(pinned, { type: 'setTuning', key: 'enemyDamageMul', value: 0.5 }, { type: 'placeEnemy', x: 5, y: 3 });
    expect(edited.tuning.enemyDamageMul).toBe(0.5);
    expect(edited.enemies).toHaveLength(6);
    expect(edited.baseline?.tuning.enemyDamageMul).toBe(1.0);
    expect(edited.baseline?.enemies).toHaveLength(5);
    const reverted = run(edited, { type: 'revertToBaseline' });
    const { enemies, waves, tuning, playerLevel } = reverted;
    expect({ enemies, waves, tuning, playerLevel }).toEqual(edited.baseline);
  });

  it('case 7: removeWave(1) drops the wave-1 brute, reindexes the elite, clamps selection; undo restores', () => {
    const before = run(initialEncounterState(), { type: 'selectWave', index: 2 });
    const after = run(before, { type: 'removeWave', index: 1 });
    expect(after.waves.map((w) => w.label)).toEqual(['Initial', 'Boss Wave']);
    expect(after.enemies.find((e) => e.archetypeId === 'brute')).toBeUndefined();
    expect(after.enemies.find((e) => e.archetypeId === 'elite-knight')?.waveIndex).toBe(1);
    expect(after.selectedWave).toBe(1);
    expect(after.selectedWave).toBeLessThan(after.waves.length);
    expect(run(after, { type: 'undo' })).toEqual(before);
  });
});

describe('Combat > Encounter tab mount', () => {
  it('case 8: the tab and its section are declared, and the draft survives a remount', () => {
    expect(COMBAT_SUBTABS.map((t) => t.key)).toContain('encounter');
    expect(getSections('arpg-combat').map((s) => s.id)).toContain('encounter-choreography');

    // Wave times are the editor's only number inputs: 0 / 8 / 18 on the seed.
    const first = render(<CombatChoreographyEditor />);
    const wave2 = screen.getByDisplayValue('8') as HTMLInputElement;
    expect(wave2.type).toBe('number');
    fireEvent.change(wave2, { target: { value: '12' } });
    first.unmount();

    render(<CombatChoreographyEditor />);
    expect(screen.queryByDisplayValue('8')).toBeNull();
    expect((screen.getByDisplayValue('12') as HTMLInputElement).type).toBe('number');
  });

  it('case 9: pinning a baseline then halving enemy damage shows the pass delta and reverts', async () => {
    render(<CombatChoreographyEditor />);
    fireEvent.click(screen.getByRole('button', { name: /pin as baseline/i }));
    act(() => useEncounterDraftStore.getState().dispatch({ type: 'setTuning', key: 'enemyDamageMul', value: 0.5 }));
    const strip = screen.getByTestId('encounter-compare-strip');
    // The compare reads the editor's (debounced) sim, so wait for it to settle.
    await waitFor(() => expect(strip.textContent).toMatch(/survives/i));
    expect(strip.textContent).toMatch(/dies at 18\.8s/i);
    expect(strip.textContent).toMatch(/\+3\.0s/);
    expect(strip.textContent).toMatch(/player death/i);
    expect(strip.textContent).toMatch(/burst spike/i);
    fireEvent.click(screen.getByRole('button', { name: /revert to baseline/i }));
    expect(useEncounterDraftStore.getState().tuning.enemyDamageMul).toBe(1.0);
  });
});
