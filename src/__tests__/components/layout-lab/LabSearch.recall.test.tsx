import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';
import { EntitySearch } from '@/components/status/EntitySearch';
import { useSearchRecallStore } from '@/components/layout-lab/ui/searchRecall';
import { useCatalogStore } from '@/stores/catalogStore';

/**
 * Both SearchCombobox consumers opt into recall. The lab's summon gesture (Ctrl+K) becomes
 * a place switcher: pick, close, reopen, Enter -> the same destination through the same
 * lifted nav callbacks (LayoutLab wires them to the one navigate door, `useLabLocation`).
 */

const onSelectCatalog = vi.fn();
const onNavigate = vi.fn();
const onClose = vi.fn();

const lab = (open: boolean) => (
  <LabSearch open={open} onClose={onClose} currentEntityId={null} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />
);
// Modal moves focus into the dialog one animation frame after it opens.
const nextFrame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

beforeEach(() => {
  useSearchRecallStore.setState({ bySurface: {} });
  onSelectCatalog.mockReset(); onNavigate.mockReset(); onClose.mockReset();
});
afterEach(cleanup);

describe('<LabSearch> recall — Ctrl+K then Enter returns to the last pick', () => {
  it('focus lands in the search input (not the dialog close button), so Enter acts on the search', async () => {
    render(lab(true));
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByTestId('lab-search-input'));
  });

  it('pick an entity, close, reopen: it is the Recent row and Enter re-opens it via onNavigate', async () => {
    const first = Object.values(useCatalogStore.getState().entitiesByCatalog['items'] ?? {})[0];
    expect(first).toBeTruthy(); // fixture guard

    const { rerender } = render(lab(true));
    await nextFrame();
    expect(screen.queryByRole('listbox', { name: 'Recent' })).toBeNull(); // nothing picked yet
    fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: first.name.toLowerCase() } });
    const hit = screen.getAllByTestId('lab-search-option').find((o) => within(o).queryByText('entity'));
    fireEvent.click(hit!);
    expect(onNavigate).toHaveBeenLastCalledWith('items', first.id, 0);

    rerender(lab(false));
    // Modal unmounts its content once the exit animation ends — the recall must outlive that.
    await waitFor(() => expect(screen.queryByTestId('lab-search-input')).toBeNull());
    rerender(lab(true));
    await nextFrame();
    const recent = screen.getByRole('listbox', { name: 'Recent' });
    expect(within(recent).getAllByRole('option')[0].textContent).toContain(first.name);

    onNavigate.mockReset();
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('items', first.id, 0);
  });
});

describe('<EntitySearch> recall — the /status Item Focus search remembers its own picks', () => {
  it('a pick shows as Recent on the next focus (and not in the lab surface)', () => {
    const first = Object.values(useCatalogStore.getState().entitiesByCatalog['items'] ?? {})[0];
    const onFocus = vi.fn();
    render(<EntitySearch onFocus={onFocus} />);
    const input = screen.getByTestId('status-entity-search-input') as HTMLInputElement;
    act(() => { input.focus(); });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.change(input, { target: { value: first.name.toLowerCase() } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onFocus).toHaveBeenLastCalledWith(expect.any(String), expect.any(String));
    const [catalogId, entityId] = onFocus.mock.calls[0];

    act(() => { input.blur(); });
    act(() => { input.focus(); });
    expect(screen.getByRole('listbox', { name: 'Recent' })).toBeTruthy();
    onFocus.mockReset();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onFocus).toHaveBeenCalledWith(catalogId, entityId);
    expect(useSearchRecallStore.getState().bySurface['lab-search']).toBeUndefined();
  });
});
