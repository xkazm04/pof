/**
 * The catalog tree exposes its three levels as a valid ARIA tree: every interactive node of
 * the hierarchy is a treeitem carrying aria-level (chapter 1, catalog 2, entity 3), and the
 * roving cursor walks from a catalog into its entities.
 */
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
  { catalogId: 'items', label: 'Items', description: '', verified: 1, total: 2 },
  { catalogId: 'spellbook', label: 'Spellbook', description: '', verified: 0, total: 6 },
] }];
const entities = [
  { id: 'e1', name: 'Alpha', lifecycle: 'planned' as const },
  { id: 'e2', name: 'Beta', lifecycle: 'planned' as const },
] as never;

const mount = (onSelectEntity = () => {}) => render(
  <CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items" entities={entities} selectedEntityId={null}
    onSelectCatalog={() => {}} onSelectEntity={onSelectEntity} />,
);

describe('CatalogTree ARIA tree', () => {
  it('every tree button except the discard action is a treeitem with a level 1..3', () => {
    const { container } = mount();
    const tree = container.querySelector('[role="tree"]')!;
    const strays = [...tree.querySelectorAll('button')].filter((b) => b.getAttribute('role') !== 'treeitem');
    expect(strays.length).toBe(0);
    const levels = new Set([...tree.querySelectorAll('[role="treeitem"]')].map((n) => n.getAttribute('aria-level')));
    expect([...levels].sort()).toEqual(['1', '2', '3']);
    expect(tree.querySelector('[role="treeitem"][aria-level="1"]')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('ArrowDown from the open catalog reaches its first entity and Enter selects it', () => {
    const onSelectEntity = vi.fn();
    mount(onSelectEntity);
    const tree = screen.getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(screen.getAllByRole('treeitem', { name: /Alpha/ })[0].getAttribute('data-roving-active')).toBe('true');
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onSelectEntity).toHaveBeenCalledWith('e1');
  });
});
