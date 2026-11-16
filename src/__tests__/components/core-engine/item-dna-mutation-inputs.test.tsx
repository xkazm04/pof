import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { ItemGenome } from '@/types/item-genome';
import { EditorTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EditorTab';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/**
 * scan-sweep inventory-genome-economy: the Mutation Config number inputs must never
 * write a non-finite or out-of-range value into the genome. TraitSlider already
 * guards + clamps its typed number; the Rate / Max inputs did not, so clearing the
 * field stored NaN (C++ preview "NaNf", roller "NaN% chance") and typing 250 stored
 * a 2.5 mutation rate.
 */

afterEach(cleanup);

function setup() {
  let current: ItemGenome = createGenome('Probe', ACCENT_VIOLET, {});
  render(
    <EditorTab
      selected={current}
      radarData={[]}
      genomeCount={1}
      updateGenome={(_id, updater) => { current = updater(current); }}
      updateTrait={() => {}}
      deleteGenome={() => {}}
    />,
  );
  return {
    rate: screen.getByLabelText('Rate'),
    max: screen.getByLabelText('Max'),
    get: () => current,
  };
}

describe('EditorTab mutation config inputs', () => {
  it('a cleared Rate field never stores NaN', () => {
    const { rate, get } = setup();
    fireEvent.change(rate, { target: { value: '' } });
    expect(Number.isFinite(get().mutation.mutationRate)).toBe(true);
  });

  it('a typed Rate above 100 is clamped to 1', () => {
    const { rate, get } = setup();
    fireEvent.change(rate, { target: { value: '250' } });
    expect(get().mutation.mutationRate).toBe(1);
  });

  it('a cleared Max field never stores NaN and a typed Max is clamped to 0..6', () => {
    const { max, get } = setup();
    fireEvent.change(max, { target: { value: '' } });
    expect(Number.isFinite(get().mutation.maxMutations)).toBe(true);
    fireEvent.change(max, { target: { value: '40' } });
    expect(get().mutation.maxMutations).toBe(6);
    fireEvent.change(max, { target: { value: '-3' } });
    expect(get().mutation.maxMutations).toBe(0);
  });
});
