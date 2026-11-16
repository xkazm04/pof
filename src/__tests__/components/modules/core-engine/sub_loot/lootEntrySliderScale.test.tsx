import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { LootTableEntryList } from '@/components/modules/core-engine/sub_loot/affix/LootTableEntryList';
import type { LootEditorEntryExpanded } from '@/components/modules/core-engine/sub_loot/_shared/data';

afterEach(() => cleanup());

function entry(id: string, weight: number): LootEditorEntryExpanded {
  return { id, name: id, weight, rarity: 'Common', color: 'red', source: 'enemy' };
}

function mount(weights: number[], onUpdateWeight = vi.fn()) {
  const entries = weights.map((w, i) => entry(`item${i}`, w));
  const total = weights.reduce((a, b) => a + b, 0);
  const { container } = render(
    <LootTableEntryList
      groupedEntries={[{ source: 'enemy', entries }]}
      sourceFilter="enemy"
      editorTotalWeight={total}
      filteredEntries={entries}
      onUpdateWeight={onUpdateWeight}
      onRemoveEntry={() => {}}
    />,
  );
  const sliders = Array.from(container.querySelectorAll('input[type="range"]')) as HTMLInputElement[];
  return { sliders, onUpdateWeight };
}

describe('loot entry weight slider follows the table scale', () => {
  it('max covers an imported weight above 100 on every row', () => {
    const { sliders } = mount([250, 10]);
    for (const s of sliders) expect(Number(s.max)).toBeGreaterThanOrEqual(250);
  });

  it('keeps the thumb at the real weight instead of pinning to 100', () => {
    const { sliders } = mount([250, 10]);
    expect(Number(sliders[0].value)).toBe(250);
  });

  it('a change event near the imported weight keeps the scale', () => {
    const { sliders, onUpdateWeight } = mount([250, 10]);
    fireEvent.change(sliders[0], { target: { value: '251' } });
    expect(onUpdateWeight).toHaveBeenCalledWith('item0', 251);
  });

  it('a fractional weight switches the slider off integer stepping', () => {
    const { sliders } = mount([2.5, 10]);
    expect(Number(sliders[0].value)).toBe(2.5);
    expect(sliders[0].step).toBe('any');
  });

  it('a normal table keeps the 0-100 integer slider', () => {
    const { sliders } = mount([40, 60]);
    expect(sliders[0].max).toBe('100');
    expect(sliders[0].step).toBe('1');
  });
});
