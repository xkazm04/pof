import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { ItemEntry } from '@/lib/catalog/types';

/**
 * Acceptance (case 6, consumer half) for scan-sweep --challenge card
 * inventory-economy-simulator/A: the Balance Advisor and the loot-filter
 * RuleEditor read the same merged item set (DUMMY_ITEMS + catalogStore items).
 */

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { useCatalogStore } from '@/stores/catalogStore';
import { RuleEditor } from '@/components/modules/core-engine/sub_inventory/loot-filter/RuleEditor';
import { MechanicsScalingTab } from '@/components/modules/core-engine/sub_inventory/mechanics/MechanicsScalingTab';
import type { SubModuleId } from '@/types/modules';

const GLAIVE: ItemData = {
  id: 'x', name: 'Catalog Glaive', type: 'Weapon', subtype: 'Glaive', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '20-30' }, { label: 'Speed', value: '2/s' }], description: 'designer-authored',
};
const GLAIVE_ENTRY: ItemEntry = {
  id: 'x', catalogId: 'items', name: GLAIVE.name, categoryPath: [], tags: [], lifecycle: 'planned', data: GLAIVE,
};

let seeded: ReturnType<typeof useCatalogStore.getState>['entitiesByCatalog'];
beforeEach(() => {
  seeded = useCatalogStore.getState().entitiesByCatalog;
  useCatalogStore.setState({ entitiesByCatalog: { ...seeded, items: { ...(seeded.items ?? {}), x: GLAIVE_ENTRY } } });
  execute.mockClear();
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ entitiesByCatalog: seeded });
});

describe('merged inventory item set reaches both consumers', () => {
  it('RuleEditor offers a catalog-only subtype as a chip', () => {
    render(<RuleEditor rulesetId="rs" accent="currentColor"
      rule={{ id: 'r', name: 'r', enabled: true, action: 'hide', condition: {}, style: {} }} />);
    expect(screen.getByRole('button', { name: 'Glaive' })).toBeTruthy();
  });

  it('the Balance Advisor sends a prompt that names the catalog item and its derived DPS', () => {
    render(<MechanicsScalingTab moduleId={'arpg-inventory' as SubModuleId} featureMap={new Map()} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze balance/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const prompt = (execute.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain('Catalog Glaive');
    expect(prompt).toContain('avg damage 25 × 2 attacks/s');
  });
});
