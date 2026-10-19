/**
 * Pin, swap and undo/redo live in the spec reducer; the contact sheet adopts a
 * seed through the wizard's own setSeed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import {
  procgenSpecReducer, initialProcgenSpecState, HISTORY_CAP,
  type ProcgenSpecAction, type ProcgenSpecState,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/specState';
import { scanSeeds } from '@/lib/level-design/layout-gallery';
import { hashSeed } from '@/lib/level-design/frandom-stream';

afterEach(cleanup);

const run = (actions: ProcgenSpecAction[], from: ProcgenSpecState = initialProcgenSpecState()) =>
  actions.reduce(procgenSpecReducer, from);

describe('pin and swap', () => {
  it('pin stores a copy; a later edit leaves it unchanged', () => {
    const pinned = run([{ type: 'pin' }]);
    const before = JSON.stringify(pinned.pinned);
    const edited = run(
      [{ type: 'updateSize', key: 'gridWidth', value: 160 }, { type: 'toggleConstraint', key: 'secretRooms' }],
      pinned,
    );
    expect(edited.spec.gridWidth).toBe(160);
    expect(JSON.stringify(edited.pinned)).toBe(before);
  });

  it('restorePinned swaps pinned and live; two swaps return the original state', () => {
    const s = run([{ type: 'pin' }, { type: 'updateSize', key: 'gridWidth', value: 160 }]);
    const original = s.spec;
    const swapped = procgenSpecReducer(s, { type: 'restorePinned' });
    expect(swapped.spec).toEqual(s.pinned);
    expect(swapped.pinned).toEqual(original);
    expect(procgenSpecReducer(swapped, { type: 'restorePinned' })).toEqual(s);
    expect(procgenSpecReducer(initialProcgenSpecState(), { type: 'restorePinned' }).pinned).toBeNull();
  });
});

describe('undo / redo', () => {
  it('restores exact prior specs, caps history, ignores shown and duplicate seeds, clears redo on edit', () => {
    const init = initialProcgenSpecState();
    expect(procgenSpecReducer(init, { type: 'undo' })).toBe(init);

    let s = run([{ type: 'shown' }, { type: 'setSeed', seed: 'a' }, { type: 'setSeed', seed: 'a' }]);
    expect(s.past).toHaveLength(1); // shown pushed nothing; the repeated seed pushed no duplicate

    s = run([{ type: 'setSeed', seed: 'b' }, { type: 'updateSize', key: 'corridorWidth', value: 4 }], s);
    const afterEdits = s.spec;
    s = run([{ type: 'undo' }, { type: 'undo' }], s);
    expect(s.spec.seedLabel).toBe('a');
    expect(s.spec.seedValue).toBe(hashSeed('a'));
    s = run([{ type: 'redo' }, { type: 'redo' }], s);
    expect(s.spec).toEqual(afterEdits);

    s = run([{ type: 'undo' }, { type: 'setSeed', seed: 'z' }], s);
    expect(s.future).toEqual([]);
    expect(procgenSpecReducer(s, { type: 'redo' })).toBe(s);

    const many = run(Array.from({ length: HISTORY_CAP + 5 }, (_, i) => ({ type: 'setSeed', seed: `s${i}` }) as const));
    expect(many.past).toHaveLength(HISTORY_CAP);
  });
});

describe('seed contact sheet', () => {
  it('adopting a candidate sets only the seed and the live preview equals its stats', () => {
    const view = render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);
    const seedInput = view.getByPlaceholderText('0xRND...') as HTMLInputElement;
    fireEvent.change(seedInput, { target: { value: 'sheet' } });

    fireEvent.click(view.getByTestId('seed-sheet-scan'));
    expect(within(view.getByTestId('seed-sheet')).getAllByRole('button')).toHaveLength(12);

    const spec = procgenSpecReducer(initialProcgenSpecState(), { type: 'setSeed', seed: 'sheet' }).spec;
    const target = scanSeeds(spec)[3];
    fireEvent.click(view.getByTestId(`seed-candidate-${target.offset}`));

    expect(seedInput.value).toBe(target.seedLabel);
    const chips = view.getByTestId('procgen-preview-stats').textContent ?? '';
    expect(chips).toContain(String(target.stats.roomCount));
    expect(chips).toContain(`${Math.round(target.stats.connectivity * 100)}%`);
    expect(view.queryByTestId('seed-sheet')).toBeNull(); // the edit retired the sheet
  });
});
