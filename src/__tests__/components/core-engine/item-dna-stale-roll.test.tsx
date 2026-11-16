import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ItemDNAGenomeEditor } from '@/components/modules/core-engine/sub_inventory/dna-genome';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';

/**
 * scan-sweep inventory-genome-economy: a roll result belongs to the genome (and the
 * rarity / level) it was rolled with. ItemDNAGenomeEditor kept one rollResult across
 * selection changes, so after switching genome the Affix Roller showed genome A's
 * affixes inside genome B's card, coloured as B.
 */

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  useItemGenomeStore.getState().resetToPresets();
});

afterEach(cleanup);

function selectorButton(name: string): HTMLElement {
  const match = screen.getAllByRole('button').find((b) => b.textContent?.trim() === name);
  if (!match) throw new Error(`no selector button ${name}`);
  return match;
}

describe('Affix Roller result is scoped to its inputs', () => {
  it('switching genome clears the previous genome\'s roll', () => {
    const [first, second] = useItemGenomeStore.getState().genomes;
    render(<ItemDNAGenomeEditor moduleId="arpg-inventory" />);
    fireEvent.click(selectorButton(first.name));
    fireEvent.click(screen.getByRole('tab', { name: /Affix Roller/ }));
    fireEvent.click(screen.getByRole('button', { name: /Roll Affixes/ }));
    expect(screen.queryByText('Rolled Affixes')).not.toBeNull();

    fireEvent.click(selectorButton(second.name));
    expect(screen.queryByText('Rolled Affixes')).toBeNull();

    // Back to the genome it was rolled for, unchanged: the roll is still valid.
    fireEvent.click(selectorButton(first.name));
    expect(screen.queryByText('Rolled Affixes')).not.toBeNull();
  });

  it('changing the rarity clears the roll', () => {
    render(<ItemDNAGenomeEditor moduleId="arpg-inventory" />);
    fireEvent.click(screen.getByRole('tab', { name: /Affix Roller/ }));
    fireEvent.click(screen.getByRole('button', { name: /Roll Affixes/ }));
    expect(screen.queryByText('Rolled Affixes')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Rarity'), { target: { value: 'Legendary' } });
    expect(screen.queryByText('Rolled Affixes')).toBeNull();
  });
});
