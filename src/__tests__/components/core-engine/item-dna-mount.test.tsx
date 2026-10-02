import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

/**
 * Acceptance for scan-sweep --challenge card inventory-genome-economy/B, case 1:
 * the Item DNA lab (ItemDNAGenomeEditor had zero mount sites) is reachable from the
 * Item Catalog, and its Breeding Lab previews an offspring the designer can Keep,
 * Re-roll or Discard - nothing reaches the library until Keep.
 */

// jsdom does not reliably advance framer-motion exit animations; swap children at once.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    features: [],
    defs: [],
    isLoading: false,
  }),
}));

// Sibling sub-tabs are out of scope; stub them so only the shell and the DNA lab render.
vi.mock('@/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab', () => ({
  CatalogGearTab: () => <div>catalog-gear-stub</div>,
}));
vi.mock('@/components/modules/core-engine/sub_inventory/economy/EconomySourcingTab', () => ({
  EconomySourcingTab: () => <div>economy-sourcing-stub</div>,
}));
vi.mock('@/components/modules/core-engine/sub_inventory/mechanics/MechanicsScalingTab', () => ({
  MechanicsScalingTab: () => <div>mechanics-stub</div>,
}));
vi.mock('@/components/modules/core-engine/sub_inventory/loot-filter/LootFilterRuleBuilder', () => ({
  LootFilterRuleBuilder: () => <div>loot-filter-stub</div>,
}));
vi.mock('@/components/modules/core-engine/sub_inventory/economy-simulator', () => ({
  ItemEconomySimulator: () => <div>economy-sim-stub</div>,
}));
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({
  default: () => <div>features-stub</div>,
}));

import { ItemCatalog } from '@/components/modules/core-engine/sub_inventory';
import { SUBTABS } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  useItemGenomeStore.getState().resetToPresets();
});

afterEach(cleanup);

describe('Item DNA lab - mounted, and breeding previews before it writes', () => {
  it('case 1: an Item DNA sub-tab mounts the lab; Breeding Lab previews with Keep / Re-roll / Discard', async () => {
    expect(SUBTABS.map((t) => t.key)).toContain('item-dna');

    render(<ItemCatalog moduleId="arpg-inventory" />);
    fireEvent.click(screen.getByRole('tab', { name: /Item DNA/ }));
    expect(await screen.findByText('Item DNA Genome System', {}, { timeout: 3000 })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Breeding Lab/ }));
    const genomes = useItemGenomeStore.getState().genomes;
    const plate = genomes.find((g) => g.name === 'Guardian Plate')!;
    const leather = genomes.find((g) => g.name === 'Rogue Leather')!;
    fireEvent.change(screen.getByLabelText('Parent A'), { target: { value: plate.id } });
    fireEvent.change(screen.getByLabelText('Parent B'), { target: { value: leather.id } });

    const before = useItemGenomeStore.getState().genomes.length;
    fireEvent.click(screen.getByRole('button', { name: /Preview Offspring/ }));

    const panel = await screen.findByTestId('breed-preview');
    expect(within(panel).getByText(/Armor/)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /Keep/ })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /Discard/ })).toBeTruthy();
    const firstId = useItemGenomeStore.getState().breedPreview!.id;
    expect(useItemGenomeStore.getState().genomes).toHaveLength(before);

    fireEvent.click(within(panel).getByRole('button', { name: /Re-roll/ }));
    const rolled = useItemGenomeStore.getState().breedPreview!;
    expect(rolled.id).not.toBe(firstId);
    expect(useItemGenomeStore.getState().genomes).toHaveLength(before);

    fireEvent.click(within(screen.getByTestId('breed-preview')).getByRole('button', { name: /Keep/ }));
    const after = useItemGenomeStore.getState();
    expect(after.genomes).toHaveLength(before + 1);
    expect(after.genomes[after.genomes.length - 1].id).toBe(rolled.id);
    expect(after.breedPreview).toBeNull();
    expect(screen.queryByTestId('breed-preview')).toBeNull();
  });
});
