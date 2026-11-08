import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpatialStashSection } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashSection';
import { useSpatialInventoryStore } from '@/stores/spatialInventoryStore';

afterEach(cleanup);

const activeItems = () => {
  const s = useSpatialInventoryStore.getState();
  return s.tabsById[s.activeTabId].items.length;
};

function buttonByTitle(title: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`button[title="${title}"]`)!;
}

function dialogButton(label: RegExp): HTMLButtonElement {
  const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
  const btn = Array.from(dialog?.querySelectorAll('button') ?? []).find((b) => label.test(b.textContent ?? ''));
  if (!btn) throw new Error(`no dialog button ${label}`);
  return btn as HTMLButtonElement;
}

describe('destructive stash actions are confirmed', () => {
  it('Remove tab waits for the confirm button and names the tab', () => {
    useSpatialInventoryStore.getState().addTab('Scratch', 6, 6);
    const tabsBefore = useSpatialInventoryStore.getState().order.length;
    render(<SpatialStashSection />);
    fireEvent.click(buttonByTitle('Remove active tab'));
    expect(useSpatialInventoryStore.getState().order.length).toBe(tabsBefore);
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')!.textContent).toContain('Scratch');
    fireEvent.click(dialogButton(/remove/i));
    expect(useSpatialInventoryStore.getState().order.length).toBe(tabsBefore - 1);
  });

  it('Reseed waits for the confirm button and Cancel keeps the layout', () => {
    const s = useSpatialInventoryStore.getState();
    s.setActiveTab(s.order[0]);
    s.reseedActiveTab();
    const s2 = useSpatialInventoryStore.getState();
    s2.removePlacement(s2.activeTabId, s2.tabsById[s2.activeTabId].items[0].id);
    const before = activeItems();
    render(<SpatialStashSection />);
    fireEvent.click(buttonByTitle('Reseed active tab'));
    expect(activeItems()).toBe(before);
    fireEvent.click(dialogButton(/cancel/i));
    expect(activeItems()).toBe(before);
    fireEvent.click(buttonByTitle('Reseed active tab'));
    fireEvent.click(dialogButton(/reseed/i));
    expect(activeItems()).toBe(before + 1);
  });
});
