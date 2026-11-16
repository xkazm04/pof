import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { CatalogGearTab } from '@/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab';
import { useCatalogStore } from '@/stores/catalogStore';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(() => Promise.resolve()), isRunning: false }),
}));
vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ isRunning: false, nextStep: null, generate: vi.fn() }),
}));

afterEach(cleanup);

/** The "Page N of M" label only; the whole tab's text is far too large to assert against. */
const pagerText = () =>
  Array.from(document.querySelectorAll('span')).find((s) => (s.textContent ?? '').startsWith('Page '))?.textContent ?? '';

function mount() {
  return render(<CatalogGearTab moduleId={'arpg-inventory' as never} featureMap={new Map()} />);
}

describe('catalog page index follows the item list', () => {
  it('never renders an out-of-range page after the list shrinks', () => {
    const all = useCatalogStore.getState().entitiesByCatalog.items;
    const entities = Object.values(all);
    expect(entities.length).toBeGreaterThan(40);
    try {
      mount();
      fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Next')!);
      fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Next')!);
      expect(pagerText()).toContain(`of ${Math.ceil(entities.length / 20)}`);
      // The store shrinks elsewhere to 25 items (2 pages) while the user sits on page 3.
      act(() => { useCatalogStore.getState().setEntities('items', entities.slice(0, 25)); });
      expect(pagerText()).toMatch(/Page\s*2\s*of 2/);
      expect(pagerText()).not.toMatch(/Page\s*3\s*of 2/);
    } finally {
      act(() => { useCatalogStore.getState().setEntities('items', entities); });
    }
  });
});
