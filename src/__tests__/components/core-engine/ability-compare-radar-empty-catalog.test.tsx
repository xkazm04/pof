/**
 * AbilityCompareRadar used `(entries.find(...) ?? entries[0])!` and handed the
 * result to useGeneration. With an empty spellbook catalog (before the fetch
 * resolves) that is `undefined`, and the real useGeneration dereferences
 * `entity.catalogId` — a render-time crash. The sibling min-select test mocks
 * useGeneration wholesale, so it could not see this. The mock here dereferences
 * its entity exactly like the real hook, so an undefined entity throws.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AbilityEntry, StoredCatalogEntity } from '@/lib/catalog/types';

afterEach(cleanup);

const { entriesRef, seenEntities } = vi.hoisted(() => ({
  entriesRef: { current: [] as unknown[] },
  seenEntities: [] as StoredCatalogEntity[],
}));

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: (entity: StoredCatalogEntity) => {
    // Same first dereference as the real hook (useGeneration.ts: entity.catalogId).
    const catalogId = entity.catalogId;
    seenEntities.push(entity);
    // A planned spellbook entity has a recipe step, so a non-null nextStep is
    // what the real hook returns for the placeholder — the button must still be gated.
    return { generate: () => {}, isRunning: false, nextStep: catalogId === 'spellbook' ? 'scaffold-cpp' : null };
  },
}));

vi.mock('@/stores/catalogStore', () => ({
  useSpellbookEntries: () => entriesRef.current,
}));

import { AbilityCompareRadar } from '@/components/modules/core-engine/sub_ability/abilities/AbilityCompareRadar';

const makeEntry = (id: string, name: string): AbilityEntry => ({
  id, catalogId: 'spellbook', name, categoryPath: ['Offensive'], tags: [], lifecycle: 'planned',
  data: {
    id, name, category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 10, manaCost: 0, cooldown: 0, radar: [0.5, 0.5, 0.5, 0.5, 0.5],
    description: '', color: '#fff', tag: `Ability.${id}`,
  },
});

describe('AbilityCompareRadar with an empty spellbook catalog', () => {
  beforeEach(() => {
    seenEntities.length = 0;
  });

  it('renders without throwing and hands useGeneration a defined spellbook placeholder', () => {
    entriesRef.current = [];
    expect(() => render(<AbilityCompareRadar />)).not.toThrow();
    expect(seenEntities.length).toBeGreaterThan(0);
    for (const entity of seenEntities) {
      expect(entity).toBeDefined();
      expect(entity.catalogId).toBe('spellbook');
    }
  });

  it('shows no (Re)generate button for the placeholder even when nextStep is non-null', () => {
    entriesRef.current = [];
    const { container } = render(<AbilityCompareRadar />);
    expect(screen.queryByText(/\(Re\)generate/)).toBeNull();
    expect(container.textContent).not.toMatch(/\(Re\)generate/);
  });

  it('still shows the (Re)generate button once a real entry exists', () => {
    entriesRef.current = [makeEntry('off-fire-01', 'Fireball')];
    render(<AbilityCompareRadar />);
    expect(screen.getByText(/\(Re\)generate/)).toBeTruthy();
    expect(seenEntities.at(-1)?.id).toBe('off-fire-01');
  });
});
