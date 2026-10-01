import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { SearchCombobox, type SearchHit } from '@/components/layout-lab/ui/SearchCombobox';
import { useSearchRecallStore } from '@/components/layout-lab/ui/searchRecall';

/**
 * SearchCombobox `recall` (opt-in): an empty, focused query lists the surface's recent
 * picks; a typed query stably moves recent MATCHES first (before the cap); recents are
 * kept per `idPrefix` in memory and survive the component unmounting (Modal unmounts its
 * content on close). Without `recall` nothing changes.
 */

const mk = (i: number): SearchHit<number> => ({ key: `k${i}`, label: `Row ${i}`, payload: i });
const ALL = Array.from({ length: 20 }, (_, i) => mk(i));
const BY_KEY = new Map(ALL.map((h) => [h.key, h]));
const recall = { resolve: (k: string) => BY_KEY.get(k) ?? null };
const searchAll = () => ALL;

function Box(props: { idPrefix?: string; withRecall?: boolean; onSelect?: (h: SearchHit<number>) => void; search?: (n: string) => SearchHit<number>[] }) {
  const { idPrefix = 'lab-search', withRecall = true, onSelect = () => {}, search = searchAll } = props;
  return (
    <SearchCombobox<number>
      search={search}
      onSelect={onSelect}
      idPrefix={idPrefix}
      ariaLabel="test search"
      placeholder="test"
      recall={withRecall ? recall : undefined}
    />
  );
}

const input = (p = 'lab-search') => screen.getByTestId(`${p}-input`) as HTMLInputElement;
const focus = (p = 'lab-search') => act(() => { input(p).focus(); });
const labels = (p = 'lab-search') => screen.queryAllByTestId(`${p}-option`).map((o) => o.textContent);
const record = (surface: string, ...keys: string[]) => {
  // Oldest first, so the LAST key given is the most recent.
  for (const k of keys) useSearchRecallStore.getState().record(surface, k);
};

beforeEach(() => { useSearchRecallStore.setState({ bySurface: {} }); });
afterEach(cleanup);

describe('<SearchCombobox recall> — the empty query is where you were', () => {
  it('one recorded pick + focused empty query -> a listbox labelled "Recent" and aria-expanded=true', () => {
    record('lab-search', 'k3');
    render(<Box />);
    focus();
    const lb = screen.getByRole('listbox', { name: 'Recent' });
    expect(lb.textContent).toContain('Row 3');
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('recall but no recorded picks -> the empty query stays closed', () => {
    render(<Box />);
    focus();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('summon-then-Enter switches back to the last pick; ArrowDown then Enter to the one before', () => {
    record('lab-search', 'k8', 'k5'); // recents: [k5, k8]
    const onSelect = vi.fn();
    const { unmount } = render(<Box onSelect={onSelect} />);
    focus();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(mk(5));
    unmount();

    useSearchRecallStore.setState({ bySurface: {} });
    record('lab-search', 'k8', 'k5');
    render(<Box onSelect={onSelect} />);
    focus();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(mk(8));
  });

  it('a typed needle: the recent match goes first, a non-matching recent is NOT shown', () => {
    record('lab-search', 'k9', 'k2'); // k9 does not match below
    const pqr = [mk(0), mk(1), mk(2)];
    render(<Box search={() => pqr} />);
    fireEvent.change(input(), { target: { value: 'row' } });
    expect(labels()).toEqual(['Row 2', 'Row 0', 'Row 1']);
  });

  it('history reorders the FULL match set before the cap: match #18 of 20 renders first under maxHits 12', () => {
    record('lab-search', 'k17'); // the 18th match
    render(<Box />);
    fireEvent.change(input(), { target: { value: 'row' } });
    const shown = labels();
    expect(shown).toHaveLength(12);
    expect(shown[0]).toBe('Row 17');
    expect(screen.getByText(/Showing 12 of 20/)).toBeTruthy();
  });

  it('a pick is kept per surface and survives unmount (Modal unmounts its content on close)', () => {
    const { unmount } = render(<Box />);
    fireEvent.change(input(), { target: { value: 'row' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' }); // picks Row 1
    unmount();

    render(<Box />);
    focus();
    expect(labels()[0]).toBe('Row 1');
    cleanup();

    render(<Box idPrefix="status-entity-search" />);
    focus('status-entity-search');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(labels('status-entity-search')).not.toContain('Row 1');
  });

  it('[guard] WITHOUT recall: empty focused query has no listbox, typed results keep caller order, nothing recorded', () => {
    record('plain', 'k4');
    render(<Box idPrefix="plain" withRecall={false} />);
    focus('plain');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input('plain').getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(input('plain'), { target: { value: 'row' } });
    expect(labels('plain').slice(0, 5)).toEqual(['Row 0', 'Row 1', 'Row 2', 'Row 3', 'Row 4']);
    fireEvent.keyDown(input('plain'), { key: 'Enter' });
    expect(useSearchRecallStore.getState().bySurface['plain']).toEqual(['k4']);
  });
});
