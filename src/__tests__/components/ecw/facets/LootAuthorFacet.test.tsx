import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LootAuthorFacet } from '@/components/ecw/facets/loot/LootAuthorFacet';
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

describe('LootAuthorFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the instruction textarea', () => {
    render(<LootAuthorFacet entity={entity} />);
    expect(screen.getByPlaceholderText(/fewer potions/i)).toBeTruthy();
  });

  it('dispatches a quick-action carrying the table name, archetype, and instruction', () => {
    render(<LootAuthorFacet entity={entity} />);
    fireEvent.change(screen.getByPlaceholderText(/fewer potions/i), {
      target: { value: 'add a rare crafting material' },
    });
    fireEvent.click(screen.getByRole('button', { name: /author loot with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('LT_Brute');
    expect(task.prompt).toContain('Stone Brute');
    expect(task.prompt).toContain('add a rare crafting material');
  });
});
