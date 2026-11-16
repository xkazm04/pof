import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SearchCombobox, type SearchHit } from '@/components/layout-lab/ui/SearchCombobox';

/**
 * The polite live region is the ONLY channel a screen-reader user gets the hit count from.
 * It must read as English for every `noun` a consumer passes (EntitySearch: "entity",
 * LabSearch: "result"): plural form AND verb agreement.
 */

afterEach(cleanup);

const hits = (n: number): SearchHit<number>[] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Row ${i}`, payload: i }));

function announce(noun: string, n: number, maxHits?: number): string {
  render(
    <SearchCombobox<number>
      search={() => hits(n)} onSelect={() => {}} idPrefix="t" ariaLabel="search" placeholder="p"
      noun={noun} maxHits={maxHits}
    />,
  );
  fireEvent.change(screen.getByTestId('t-input'), { target: { value: 'row' } });
  return screen.getByRole('status').textContent ?? '';
}

describe('SearchCombobox — live hit count', () => {
  it('pluralises a consonant+y noun ("entity" -> "entities"), never "entitys"', () => {
    expect(announce('entity', 3)).toBe('3 entities match');
  });
  it('a single hit agrees in number ("1 entity matches")', () => {
    expect(announce('entity', 1)).toBe('1 entity matches');
  });
  it('the default noun keeps reading correctly', () => {
    expect(announce('result', 2)).toBe('2 results match');
    cleanup();
    expect(announce('result', 1)).toBe('1 result matches');
  });
  it('a vowel+y noun takes a plain s ("key" -> "keys") and the cap is still stated', () => {
    expect(announce('key', 20, 12)).toBe('20 keys match, showing first 12');
  });
});
