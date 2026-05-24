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

  it('groups entities by first categoryPath segment', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    // Two groups: Offensive (2 entries) + Support (1 entry)
    expect(screen.getByText(/Offensive/)).toBeTruthy();
    expect(screen.getByText(/Support/)).toBeTruthy();
  });

  it('renders all entity names', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.getByText('Frost')).toBeTruthy();
    expect(screen.getByText('Heal')).toBeTruthy();
  });

  it('clicking an entity selects it in ecwStore', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.click(screen.getByRole('button', { name: /Frost/ }));
    expect(useEcwStore.getState().activeEntityId).toBe('b');
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
  });

  it('marks the selected entity with aria-current', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'a' });
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    const fireball = screen.getByRole('button', { name: /Fireball/ });
    expect(fireball.getAttribute('aria-current')).toBe('true');
    const frost = screen.getByRole('button', { name: /Frost/ });
    expect(frost.getAttribute('aria-current')).toBeNull();
  });

  it('shows an empty message when no entities', () => {
    render(<EntityTree catalogId="spellbook" entities={[]} />);
    expect(screen.getByText(/no entities/i)).toBeTruthy();
  });
});
