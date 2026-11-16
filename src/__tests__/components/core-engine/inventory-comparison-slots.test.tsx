import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { ItemComparisonPanel } from '@/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel';

afterEach(cleanup);

const item = (id: string, name: string, dmg: number): ItemData => ({
  id, name, type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
  stats: [{ label: 'Damage', value: String(dmg), numericValue: dmg, maxValue: 50 }],
  description: `${name} desc`,
});
const ITEMS = [item('a', 'Alpha', 30), item('b', 'Beta', 20)];

function pick(slotIdx: number, id: string) {
  fireEvent.change(document.querySelectorAll('select')[slotIdx], { target: { value: id } });
}

describe('ItemComparisonPanel slots', () => {
  it('the same item in two of three slots is compared once, not against itself', () => {
    render(<ItemComparisonPanel items={ITEMS} />);
    fireEvent.click(screen.getByText('Weapon'));
    fireEvent.click(screen.getByText('Add Slot'));
    pick(0, 'a'); pick(1, 'a'); pick(2, 'b');
    // Header columns: one per DISTINCT item.
    const headers = Array.from(document.querySelectorAll('span.font-bold'))
      .map((s) => s.textContent ?? '').filter((t) => t === 'Alpha' || t === 'Beta');
    expect(headers).toEqual(['Alpha', 'Beta']);
    // Alpha leads Beta by 10 — not "tie" against its own duplicate.
    expect(screen.getByText('+10')).toBeTruthy();
  });
});
