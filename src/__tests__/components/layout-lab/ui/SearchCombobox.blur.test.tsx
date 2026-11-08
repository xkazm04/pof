import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SearchCombobox, type SearchHit } from '@/components/layout-lab/ui/SearchCombobox';

/** APG combobox: the popup collapses when focus leaves the input; the query survives. */

afterEach(cleanup);

const HITS: SearchHit<number>[] = [{ key: 'a', label: 'Dragon', payload: 1 }, { key: 'b', label: 'Drake', payload: 2 }];

function setup() {
  render(<SearchCombobox<number> search={() => HITS} onSelect={() => {}} idPrefix="t" ariaLabel="search" placeholder="p" />);
  return screen.getByTestId('t-input') as HTMLInputElement;
}

describe('SearchCombobox — popup follows focus', () => {
  it('blur closes the listbox and aria-expanded; focus brings it back with the query intact', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'dr' } });
    expect(screen.queryByRole('listbox')).not.toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('true');

    fireEvent.blur(input);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('dr');

    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).not.toBeNull();
    expect(input.value).toBe('dr');
  });

  it('blur also closes the no-match message', () => {
    render(<SearchCombobox<number> search={() => []} onSelect={() => {}} idPrefix="n" ariaLabel="s" placeholder="p" />);
    const input = screen.getByTestId('n-input');
    fireEvent.change(input, { target: { value: 'zz' } });
    expect(screen.queryByTestId('n-empty')).not.toBeNull();
    fireEvent.blur(input);
    expect(screen.queryByTestId('n-empty')).toBeNull();
  });
});
