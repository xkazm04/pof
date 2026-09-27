import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * Acceptance for scan-sweep --challenge card inventory-economy-simulator/B:
 * the Item Economy Simulator is reachable from the Item Catalog (it had zero
 * mount sites) and, once run at its defaults, renders the unmeasured endgame
 * honestly instead of 'End Power 0' / a green '0.0x'.
 */

// jsdom does not reliably advance framer-motion exit animations, so AnimatePresence
// mode="wait" can hold the skeleton forever; swap children immediately instead.
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

// The sibling sub-tabs are out of scope here; stub them so the mount test only
// exercises the Item Catalog shell and the simulator itself.
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
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({
  default: () => <div>features-stub</div>,
}));

import { ItemCatalog } from '@/components/modules/core-engine/sub_inventory';
import { ItemEconomySimulator } from '@/components/modules/core-engine/sub_inventory/economy-simulator';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

describe('Item Economy Simulator — reachable and honest', () => {
  it('case 7: the Item Catalog has an Economy Sim sub-tab that mounts the simulator', async () => {
    render(<ItemCatalog moduleId="arpg-inventory" />);
    fireEvent.click(screen.getByRole('tab', { name: /Economy Sim/ }));
    expect(await screen.findByText('Item Economy Simulator', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('a default run shows the unmeasured endgame and offers to extend the horizon', async () => {
    render(<ItemEconomySimulator moduleId="arpg-inventory" />);
    fireEvent.click(screen.getByRole('button', { name: /Simulate 500 Players/ }));
    const strip = await screen.findByTestId('econ-coverage', {}, { timeout: 10_000 });
    expect(strip.textContent).toMatch(/Lv22-25/);
    expect(strip.textContent).toMatch(/0\s*\/\s*500 agents/);
    expect(strip.textContent).toMatch(/UNMEASURED/);
    expect(screen.getByRole('button', { name: /Extend horizon to measure endgame/ })).toBeTruthy();
    // End Power is an em dash, never a measured-looking 0.
    const endPower = screen.getByText('End Power').parentElement!;
    expect(endPower.textContent).toContain('—');
    expect(endPower.textContent).not.toMatch(/\b0\b/);
  }, 20_000);

  it('Extend horizon adopts the smallest rung that samples the endgame (640 h at the defaults)', async () => {
    render(<ItemEconomySimulator moduleId="arpg-inventory" />);
    fireEvent.click(screen.getByRole('button', { name: /Simulate 500 Players/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Extend horizon to measure endgame/ }, { timeout: 10_000 }));
    await waitFor(
      () => expect(screen.getByTestId('econ-coverage').textContent).toMatch(/extended to 640 h/),
      { timeout: 20_000 },
    );
    const strip = screen.getByTestId('econ-coverage').textContent!;
    expect(strip).toMatch(/500\/500 agents/);
    expect(strip).not.toMatch(/UNMEASURED/);
    expect(screen.queryByRole('button', { name: /Extend horizon/ })).toBeNull();
    expect((screen.getByLabelText('Hours') as HTMLInputElement).value).toBe('640');
  }, 40_000);
});
