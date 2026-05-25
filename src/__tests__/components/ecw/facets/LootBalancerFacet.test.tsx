import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LootBalancerFacet } from '@/components/ecw/facets/loot/LootBalancerFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

const entity: StoredCatalogEntity = {
  id: 'LT_Brute', catalogId: 'loot-tables', name: 'LT_Brute',
  categoryPath: ['Loot Tables'], tags: [], lifecycle: 'planned',
  data: { lootTableName: 'LT_Brute', archetypeName: 'Stone Brute', dropChance: 0.5, rarityWeights: [30, 25, 25, 15, 5], bonusGold: 40 },
};

describe('LootBalancerFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the current EV and a target input', () => {
    render(<LootBalancerFacet entity={entity} />);
    expect(screen.getByText(/Goal-Seek Balancer/i)).toBeTruthy();
    expect(screen.getByText(/Target gold/i)).toBeTruthy();
  });

  it('proposes a richer distribution when the target is raised', () => {
    render(<LootBalancerFacet entity={entity} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '150' } });
    // proposal reaches near the target
    expect(screen.getByText(/Proposed reaches/i)).toBeTruthy();
  });

  it('dispatches a quick-action carrying the proposed weights when applied', () => {
    render(<LootBalancerFacet entity={entity} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /apply via claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('rarity weights');
    expect(task.prompt).toContain('150');
  });

  it('shows a fallback for an entity without a loot binding', () => {
    const bad = { id: 'x', catalogId: 'loot-tables', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as StoredCatalogEntity;
    render(<LootBalancerFacet entity={bad} />);
    expect(screen.getByText(/no loot binding to balance/i)).toBeTruthy();
  });
});
