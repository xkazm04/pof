import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpatialStashGrid } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashGrid';
import { SpatialStashPalette } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashPalette';
import { setDragIntent } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/spatialDragState';
import { getInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';
import { useSpatialInventoryStore } from '@/stores/spatialInventoryStore';
import { getItemFootprint } from '@/lib/spatial-inventory';

afterEach(() => {
  cleanup();
  setDragIntent(null);
});

/** A palette + grid pair bound to a fresh empty tab in the persisted stash store. */
function Harness({ tabId }: { tabId: string }) {
  const tab = useSpatialInventoryStore((s) => s.tabsById[tabId]);
  return (
    <div>
      <SpatialStashGrid tab={tab} accent="currentColor" />
      <SpatialStashPalette accent="currentColor" />
    </div>
  );
}

function freshTab(): string {
  return useSpatialInventoryStore.getState().addTab('Keys', 10, 10);
}

function paletteRowFor(name: string): HTMLElement {
  const row = Array.from(document.querySelectorAll<HTMLElement>('[data-palette-row]')).find((r) =>
    (r.getAttribute('aria-label') ?? '').startsWith(`Pick up ${name}`),
  );
  if (!row) throw new Error(`no palette row for ${name}`);
  return row;
}

function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

describe('stash keyboard operation', () => {
  it('places a palette item with Enter, arrows, Enter', () => {
    const item = getInventoryItems()[0];
    const tabId = freshTab();
    render(<Harness tabId={tabId} />);
    const row = paletteRowFor(item.name);
    row.focus();
    expect(document.activeElement).toBe(row);
    press('Enter');
    press('ArrowRight');
    press('ArrowRight');
    press('Enter');
    const items = useSpatialInventoryStore.getState().tabsById[tabId].items;
    expect(items.map((p) => [p.itemId, p.x, p.y])).toEqual([[item.id, 2, 0]]);
  });

  it('moves a placed tile with Enter, arrows, Enter', () => {
    const item = getInventoryItems()[0];
    const tabId = freshTab();
    useSpatialInventoryStore.getState().placeItem(tabId, item.id, { x: 0, y: 0 });
    render(<Harness tabId={tabId} />);
    const tile = document.querySelector<HTMLElement>('[data-placed-tile]')!;
    tile.focus();
    press('Enter');
    press('ArrowDown');
    press('ArrowRight');
    press('ArrowRight');
    press('Enter');
    const items = useSpatialInventoryStore.getState().tabsById[tabId].items;
    expect(items.map((p) => [p.x, p.y])).toEqual([[2, 1]]);
  });

  it('rotates the picked footprint with R and cancels with Escape', () => {
    const item = getInventoryItems().find((i) => {
      const fp = getItemFootprint(i);
      return fp.w !== fp.h;
    })!;
    const fp = getItemFootprint(item);
    const tabId = freshTab();
    render(<Harness tabId={tabId} />);
    paletteRowFor(item.name).focus();
    press('Enter');
    press('r');
    press('Enter');
    const placed = useSpatialInventoryStore.getState().tabsById[tabId].items;
    expect(placed.map((p) => [p.w, p.h, p.rotated])).toEqual([[fp.h, fp.w, true]]);

    paletteRowFor(item.name).focus();
    press('Enter');
    press('ArrowDown');
    press('Escape');
    expect(useSpatialInventoryStore.getState().tabsById[tabId].items).toHaveLength(1);
    expect(document.querySelector('[data-stash-status]')!.textContent).toBe('');
  });
});
