import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityTree } from '@/components/ecw/catalogs/EntityTree';
import { useEcwStore } from '@/stores/ecwStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const entities: CatalogEntityBase[] = [
  { id: 'a', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'verified' },
  { id: 'b', catalogId: 'spellbook', name: 'Frost', categoryPath: ['Offensive', 'Ice'], tags: [], lifecycle: 'planned' },
  { id: 'c', catalogId: 'spellbook', name: 'Heal', categoryPath: ['Support'], tags: [], lifecycle: 'planned' },
];

describe('EntityTree', () => {
  beforeEach(() => useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: null }));
  afterEach(cleanup);

  it('groups entities by categoryPath (nested) + renders names', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Fire')).toBeTruthy(); // 2nd level
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.getByText('Frost')).toBeTruthy();
    expect(screen.getByText('Heal')).toBeTruthy();
  });

  it('clicking an entity selects it in ecwStore', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /Frost/ }));
    expect(useEcwStore.getState().activeEntityId).toBe('b');
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
  });

  it('marks the selected entity with aria-selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'a' });
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    expect(screen.getByRole('treeitem', { name: /Fireball/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('treeitem', { name: /Frost/ }).getAttribute('aria-selected')).toBe('false');
  });

  it('collapsing a top group hides its descendants', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.click(screen.getByText('Offensive'));
    expect(screen.queryByText('Fire')).toBeNull();
    expect(screen.queryByText('Fireball')).toBeNull();
    expect(screen.getByText('Offensive')).toBeTruthy(); // header itself stays
  });

  it('filter prunes to matching entities + their ancestor groups', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'frost' } });
    expect(screen.getByText('Frost')).toBeTruthy();
    expect(screen.getByText('Ice')).toBeTruthy();
    expect(screen.queryByText('Fireball')).toBeNull();
    expect(screen.queryByText('Support')).toBeNull();
  });

  it('shows an empty message when no entities', () => {
    render(<EntityTree catalogId="spellbook" entities={[]} />);
    expect(screen.getByText(/no entities/i)).toBeTruthy();
  });
});
