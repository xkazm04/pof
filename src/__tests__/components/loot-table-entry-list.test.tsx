import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { LootTableEntryList } from '@/components/modules/core-engine/sub_loot/affix/LootTableEntryList';
import type { LootEditorEntryExpanded } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { STATUS_MUTED, STATUS_INFO } from '@/lib/chart-colors';

afterEach(cleanup);

const SWORD: LootEditorEntryExpanded = {
  id: 'e1', name: 'Rusty Sword', weight: 40, rarity: 'Common', color: STATUS_MUTED, source: 'enemy',
};
const RING: LootEditorEntryExpanded = {
  id: 'e2', name: 'Gold Ring', weight: 60, rarity: 'Rare', color: STATUS_INFO, source: 'enemy',
};

function renderList(entries: LootEditorEntryExpanded[] = [SWORD, RING], total = 100) {
  const onUpdateWeight = vi.fn();
  const onRemoveEntry = vi.fn();
  const utils = render(
    <LootTableEntryList
      groupedEntries={[{ source: 'enemy', entries }]}
      sourceFilter="enemy"
      editorTotalWeight={total}
      filteredEntries={entries}
      onUpdateWeight={onUpdateWeight}
      onRemoveEntry={onRemoveEntry}
    />,
  );
  return { ...utils, onUpdateWeight, onRemoveEntry };
}

describe('LootTableEntryList', () => {
  it('renders an accessibly-labeled weight slider per entry and reports edits', () => {
    const { getByLabelText, onUpdateWeight } = renderList([SWORD]);
    const slider = getByLabelText('Weight for Rusty Sword') as HTMLInputElement;
    expect(slider.tagName).toBe('INPUT');
    expect(slider.type).toBe('range');
    // Thicker, larger hit target — h-2 track replaces the old 1px h-1 track.
    expect(slider.className).toContain('h-2');
    expect(slider.className).toContain('focus-ring');

    fireEvent.change(slider, { target: { value: '75' } });
    expect(onUpdateWeight).toHaveBeenCalledWith('e1', 75);
  });

  it('labels the raw value as "wt" (no percent sign) and the normalized value as "% share"', () => {
    const { getByTitle } = renderList([SWORD]); // weight 40 of total 100 -> 40.0% share
    const raw = getByTitle('Raw weight (relative magnitude)');
    const share = getByTitle('Share of total drop weight');

    // Raw weight is an arbitrary magnitude, NOT a percentage — must not carry a % sign.
    expect(raw.textContent).toBe('wt 40');
    expect(raw.textContent).not.toContain('%');

    // Normalized share is the only value that reads as a percentage.
    expect(share.textContent).toBe('40.0% share');
  });

  it('renders a Trash2 remove button with an aria-label, no bare "x", and a hover surface', () => {
    const { getByRole, queryByText, onRemoveEntry } = renderList([SWORD]);
    const removeBtn = getByRole('button', { name: 'Remove Rusty Sword' });
    // The old affordance was a bare "x" text node — it should be gone.
    expect(queryByText('x')).toBeNull();
    expect(removeBtn.className).toContain('hover:bg-surface-hover');
    expect(removeBtn.className).toContain('focus-ring');
    // Lucide renders an <svg> child rather than a text glyph.
    expect(removeBtn.querySelector('svg')).toBeTruthy();

    fireEvent.click(removeBtn);
    expect(onRemoveEntry).toHaveBeenCalledWith('e1');
  });

  it('guards the normalized share against a zero total weight', () => {
    const { getByTitle } = renderList([SWORD], 0);
    expect(getByTitle('Share of total drop weight').textContent).toBe('0.0% share');
  });
});
