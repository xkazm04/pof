import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpatialStashGrid } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashGrid';
import { getInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';
import { useSpatialInventoryStore } from '@/stores/spatialInventoryStore';
import { getItemFootprint } from '@/lib/spatial-inventory';

afterEach(cleanup);

function Harness({ tabId }: { tabId: string }) {
  const tab = useSpatialInventoryStore((s) => s.tabsById[tabId]);
  return <SpatialStashGrid tab={tab} accent="currentColor" />;
}

describe('a refused rotate is explained', () => {
  it('announces which item has no room to rotate', () => {
    // A 1x3 item on a 2-column tab: rotated it would need 3 columns, so the rotate is refused.
    const item = getInventoryItems().find((i) => {
      const fp = getItemFootprint(i);
      return fp.w === 1 && fp.h === 3;
    })!;
    const store = useSpatialInventoryStore.getState();
    const tabId = store.addTab('Narrow', 2, 3);
    store.placeItem(tabId, item.id, { x: 0, y: 0 });
    render(<Harness tabId={tabId} />);
    fireEvent.click(document.querySelector(`button[aria-label="Rotate ${item.name}"]`)!);
    const notice = document.querySelector('[data-stash-notice]')!;
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain(`No room to rotate ${item.name} here`);
    // The placement itself is unchanged.
    expect(useSpatialInventoryStore.getState().tabsById[tabId].items[0].rotated).toBe(false);
  });

  it('says nothing when the rotate fits', () => {
    const item = getInventoryItems().find((i) => {
      const fp = getItemFootprint(i);
      return fp.w === 1 && fp.h === 3;
    })!;
    const store = useSpatialInventoryStore.getState();
    const tabId = store.addTab('Wide', 6, 6);
    store.placeItem(tabId, item.id, { x: 0, y: 0 });
    render(<Harness tabId={tabId} />);
    fireEvent.click(document.querySelector(`button[aria-label="Rotate ${item.name}"]`)!);
    expect(document.querySelector('[data-stash-notice]')?.textContent ?? '').toBe('');
    expect(useSpatialInventoryStore.getState().tabsById[tabId].items[0].rotated).toBe(true);
  });
});
