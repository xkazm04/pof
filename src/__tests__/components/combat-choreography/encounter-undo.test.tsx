import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { CombatChoreographyEditor } from '@/components/modules/core-engine/sub_combat/choreography';
import {
  resetEncounterDraft, useEncounterDraftStore,
} from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';

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

const undoButton = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>('button[aria-label^="Undo last encounter edit"]');

describe('Encounter editor undo affordance', () => {
  it('the reducer\'s undo history is reachable from the UI', () => {
    const { container } = render(<CombatChoreographyEditor />);
    const btn = undoButton(container);
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true); // nothing to undo yet

    const before = useEncounterDraftStore.getState().enemies.length;
    act(() => { useEncounterDraftStore.getState().dispatch({ type: 'placeEnemy', x: 5, y: 3 }); });
    expect(useEncounterDraftStore.getState().enemies.length).toBe(before + 1);
    expect(undoButton(container)!.disabled).toBe(false);

    fireEvent.click(undoButton(container)!);
    expect(useEncounterDraftStore.getState().enemies.length).toBe(before);
    expect(undoButton(container)!.disabled).toBe(true);
  });
});
