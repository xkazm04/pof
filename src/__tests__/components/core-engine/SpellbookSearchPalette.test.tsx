import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SpellbookSearchPalette } from '@/components/modules/core-engine/sub_ability/SpellbookSearchPalette';
import type { SearchResult } from '@/components/modules/core-engine/sub_ability/spellbook-search-index';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';

// jsdom does not implement scrollIntoView, which the palette calls in an effect.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const RESULTS: SearchResult[] = [
  { id: 'r1', label: 'Fireball', category: 'ability', tab: 'abilities', sectionId: 'abilities', color: STATUS_ERROR },
  { id: 'r2', label: 'Frostbite', category: 'ability', tab: 'abilities', sectionId: 'abilities', color: STATUS_SUCCESS },
  { id: 'r3', label: 'Burning', category: 'effect', tab: 'effects', sectionId: 'effects', color: STATUS_WARNING },
];

type PaletteProps = React.ComponentProps<typeof SpellbookSearchPalette>;

function renderPalette(overrides: Partial<PaletteProps> = {}): PaletteProps {
  const props: PaletteProps = {
    query: 'fi',
    setQuery: vi.fn(),
    filtered: RESULTS,
    selectedIdx: 0,
    setSelectedIdx: vi.fn(),
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  };
  render(<SpellbookSearchPalette {...props} />);
  return props;
}

describe('SpellbookSearchPalette — combobox semantics', () => {
  it('marks the input as a combobox that controls the listbox', () => {
    renderPalette();
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('id')).toBeTruthy();
    expect(input.getAttribute('aria-controls')).toBe(listbox.getAttribute('id'));
  });

  it('renders each result as an option with aria-selected tracking selectedIdx', () => {
    renderPalette({ selectedIdx: 1 });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[2].getAttribute('aria-selected')).toBe('false');
  });

  it('points aria-activedescendant at the selected option', () => {
    renderPalette({ selectedIdx: 2 });
    const input = screen.getByRole('combobox');
    const options = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[2].getAttribute('id'));
  });

  it('collapses and drops activedescendant when there are no results', () => {
    renderPalette({ filtered: [], selectedIdx: 0 });
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
