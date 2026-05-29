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

it('collapses a category group when its header is toggled', () => {
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} />);
  expect(screen.getByTestId('harness-catalog-spellbook')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Core/i }));
  expect(screen.queryByTestId('harness-catalog-spellbook')).toBeNull();
});

it('selects a catalog via keyboard (ArrowDown + Enter)', () => {
  const onSelectCatalog = vi.fn();
  render(<CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={[]} selectedEntityId={null} onSelectCatalog={onSelectCatalog} onSelectEntity={() => {}} />);
  const tree = screen.getByRole('tree');
  fireEvent.keyDown(tree, { key: 'ArrowDown' });
  fireEvent.keyDown(tree, { key: 'Enter' });
  expect(onSelectCatalog).toHaveBeenCalled();
});
