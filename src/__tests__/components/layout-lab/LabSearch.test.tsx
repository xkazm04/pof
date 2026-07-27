import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';
import { SearchCombobox, type SearchHit } from '@/components/layout-lab/ui/SearchCombobox';
import { useCatalogStore } from '@/stores/catalogStore';

const onSelectCatalog = vi.fn();
const onNavigate = vi.fn();
const onClose = vi.fn();

const renderSearch = (currentEntityId: string | null = null) =>
  render(
    <LabSearch open onClose={onClose} currentEntityId={currentEntityId} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />,
  );

const type = (v: string) => fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: v } });
const options = () => screen.queryAllByTestId('lab-search-option');

beforeEach(() => { onSelectCatalog.mockReset(); onNavigate.mockReset(); onClose.mockReset(); });
afterEach(cleanup);

describe('<LabSearch /> — find anything across catalogs, entities and steps', () => {
  it('finds a catalog by name and selects it through the existing nav callback', () => {
    renderSearch();
    type('items');
    const catalogHit = options().find((o) => within(o).queryByText('catalog'));
    expect(catalogHit).toBeTruthy();
    fireEvent.click(catalogHit!);
    expect(onSelectCatalog).toHaveBeenCalledWith('items');
    expect(onClose).toHaveBeenCalled();
  });

  it('finds a seeded entity and jumps to it at step 0', () => {
    const entities = useCatalogStore.getState().entitiesByCatalog['items'] ?? {};
    const first = Object.values(entities)[0];
    expect(first).toBeTruthy(); // fixture guard: the lab search is only useful with seeded entities

    renderSearch();
    type(first.name.toLowerCase());
    const hit = options().find((o) => within(o).queryByText('entity'));
    fireEvent.click(hit!);
    expect(onNavigate).toHaveBeenCalledWith('items', first.id, 0);
  });

  it('finds a pipeline STEP and opens it on the current entity when it belongs to that catalog', () => {
    const entities = useCatalogStore.getState().entitiesByCatalog['items'] ?? {};
    const current = Object.values(entities)[0];

    renderSearch(current.id);
    type('economy');
    const hit = options().find((o) => within(o).queryByText('step'));
    expect(hit).toBeTruthy();
    fireEvent.click(hit!);
    const [catalogId, entityId, stepIndex] = onNavigate.mock.calls[0];
    expect(entityId).toBe(current.id);
    expect(catalogId).toBe('items');
    expect(stepIndex).toBeGreaterThanOrEqual(0);
  });

  it('is keyboard-first: arrow keys move the active option and Enter opens it', () => {
    renderSearch();
    type('items');
    const input = screen.getByTestId('lab-search-input');
    const activeKey = () => input.getAttribute('aria-activedescendant');

    expect(activeKey()).toBe('lab-search-option-0');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeKey()).toBe('lab-search-option-1');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeKey()).toBe('lab-search-option-0');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectCatalog.mock.calls.length + onNavigate.mock.calls.length).toBe(1);
  });

  it('Escape clears the query first, then dismisses the overlay', () => {
    renderSearch();
    const input = screen.getByTestId('lab-search-input');
    type('items');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when nothing matches, instead of rendering an empty popup', () => {
    renderSearch();
    type('zzzzz-no-such-thing');
    expect(options()).toHaveLength(0);
    expect(screen.getByTestId('lab-search-empty').textContent).toMatch(/No result matches/i);
  });
});

describe('<SearchCombobox /> — the extracted primitive', () => {
  const hits: SearchHit<number>[] = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, label: `Row ${i}`, payload: i }));

  it('caps the list but STATES the cap (never a silent truncation)', () => {
    render(
      <SearchCombobox<number>
        search={() => hits}
        onSelect={() => {}}
        idPrefix="t"
        ariaLabel="test"
        placeholder="test"
        maxHits={5}
      />,
    );
    fireEvent.change(screen.getByTestId('t-input'), { target: { value: 'row' } });
    expect(screen.getAllByTestId('t-option')).toHaveLength(5);
    expect(screen.getByText(/Showing 5 of 20/)).toBeTruthy();
  });

  it('distinguishes "nothing loaded" from "no match"', () => {
    render(
      <SearchCombobox<number>
        search={() => []}
        onSelect={() => {}}
        idPrefix="u"
        ariaLabel="test"
        placeholder="test"
        emptyUniverse
      />,
    );
    fireEvent.change(screen.getByTestId('u-input'), { target: { value: 'x' } });
    expect(screen.getByTestId('u-empty').textContent).toMatch(/Nothing is loaded yet/i);
  });

  it('Home/End jump to the ends of the hit list', () => {
    render(
      <SearchCombobox<number>
        search={() => hits.slice(0, 4)}
        onSelect={() => {}}
        idPrefix="v"
        ariaLabel="test"
        placeholder="test"
      />,
    );
    const input = screen.getByTestId('v-input');
    fireEvent.change(input, { target: { value: 'row' } });
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toBe('v-option-3');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(input.getAttribute('aria-activedescendant')).toBe('v-option-0');
  });
});
