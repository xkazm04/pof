import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LootTableSearchFilters } from '@/components/modules/core-engine/sub_loot/affix/LootTableSearchFilters';

afterEach(cleanup);

function renderFilters(sourceFilter: 'all' | 'chest' = 'chest') {
  return render(
    <LootTableSearchFilters searchQuery="" setSearchQuery={vi.fn()} sourceFilter={sourceFilter} setSourceFilter={vi.fn()} setPage={vi.fn()} />,
  );
}

describe('LootTableSearchFilters is operable without sight', () => {
  it('the search box has an accessible name beyond its placeholder', () => {
    const { container } = renderFilters();
    expect(container.querySelector('input')!.getAttribute('aria-label')).toBe('Search loot entries');
  });

  it('source toggles expose which one is active', () => {
    const { container } = renderFilters('chest');
    const pressed = Array.from(container.querySelectorAll('button')).map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
    expect(pressed).toEqual([['All', 'false'], ['enemy', 'false'], ['chest', 'true'], ['quest', 'false'], ['crafting', 'false']]);
  });
});
