import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CatalogGearTab } from '@/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(() => Promise.resolve()), isRunning: false }),
}));
vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ isRunning: false, nextStep: null, generate: vi.fn() }),
}));

afterEach(cleanup);

const firstCard = () =>
  document.querySelector<HTMLElement>('[aria-label="Item catalog"] [role="gridcell"][aria-label*=","]')!;

describe('item detail drawer focus management', () => {
  it('moves focus into the drawer on open and back to the card on close', () => {
    render(<CatalogGearTab moduleId={'arpg-inventory' as never} featureMap={new Map()} />);
    const card = firstCard();
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    const close = document.querySelector<HTMLElement>('button[aria-label="Close detail"]')!;
    const drawer = close.closest('.overflow-hidden')!;
    expect(drawer.contains(document.activeElement)).toBe(true);

    fireEvent.click(close);
    expect(document.activeElement).toBe(firstCard());
  });
});
