import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

const groups = [{ category: 'Core', catalogs: [
  { catalogId: 'items', label: 'Items', description: '', verified: 1, total: 13 },
  { catalogId: 'spellbook', label: 'Spellbook', description: '', verified: 0, total: 6 },
] }];

it('keeps non-selected chapters compact by default; expands one on click', () => {
  const multi = [
    { category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 1, total: 13 }] },
    { category: 'Content', catalogs: [{ catalogId: 'audio', label: 'Audio', description: '', verified: 0, total: 4 }] },
  ];
  render(<CatalogTree t={LIGHT} groups={multi} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} />);
  // The selected catalog's chapter (Core) is open; the other chapter (Content) is compact.
  expect(screen.getByTestId('harness-catalog-items')).toBeTruthy();
  expect(screen.queryByTestId('harness-catalog-audio')).toBeNull();
  expect(screen.getByRole('button', { name: /Content/i }).getAttribute('aria-expanded')).toBe('false');
  // Clicking the compact chapter expands just that one.
  fireEvent.click(screen.getByRole('button', { name: /Content/i }));
  expect(screen.getByTestId('harness-catalog-audio')).toBeTruthy();
});

it('lets the user collapse the auto-opened selected chapter', () => {
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} />);
  // The selected chapter starts open…
  expect(screen.getByTestId('harness-catalog-items')).toBeTruthy();
  // …and the user can still collapse it.
  fireEvent.click(screen.getByRole('button', { name: /Core/i }));
  expect(screen.queryByTestId('harness-catalog-items')).toBeNull();
});

it('collapses a category group when its header is toggled', () => {
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} />);
  expect(screen.getByTestId('harness-catalog-spellbook')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Core/i }));
  expect(screen.queryByTestId('harness-catalog-spellbook')).toBeNull();
  const coreHeader = screen.getByRole('button', { name: /Core/i });
  expect(coreHeader.getAttribute('aria-expanded')).toBe('false');
});

it('selects a catalog via keyboard (ArrowDown + Enter)', () => {
  const onSelectCatalog = vi.fn();
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={onSelectCatalog} onSelectEntity={() => {}} />);
  const tree = screen.getByRole('tree');
  fireEvent.keyDown(tree, { key: 'ArrowDown' });
  fireEvent.keyDown(tree, { key: 'Enter' });
  expect(onSelectCatalog).toHaveBeenCalled();
});

it('Enter on a group header toggles collapse without selecting a catalog', () => {
  const onSelectCatalog = vi.fn();
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={onSelectCatalog} onSelectEntity={() => {}} />);
  const header = screen.getByRole('button', { name: /Core/i });
  header.focus();
  fireEvent.keyDown(header, { key: 'Enter' });
  // Enter on the header must NOT trigger a roving catalog-select (stopPropagation).
  expect(onSelectCatalog).not.toHaveBeenCalled();
});
