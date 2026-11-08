/**
 * The behaviour-tree list is ONE composite widget (role="tree"): Tab must reach it
 * once and arrow keys move inside it (roving tabindex, keyed by node id). Before this
 * guard every one of the 54 treeitems was tabIndex=0, so tabbing past the tree cost
 * 54 key presses.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { BTFlowchart } from '@/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart';
import { BT_TREE } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

function tabStops(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(el => el.tabIndex === 0);
}

describe('BTFlowchart roving tabindex', () => {
  it('exposes exactly one tab stop among the tree items', () => {
    const { container } = render(<BTFlowchart expandedNodeId={null} onNodeClick={() => {}} />);
    const items = container.querySelectorAll('[role="treeitem"]');
    expect(items.length).toBeGreaterThan(1);
    expect(tabStops(container)).toHaveLength(1);
    expect(tabStops(container)[0]).toBe(items[0]);
  });

  it('moves the tab stop with arrow-key focus', () => {
    const { container } = render(<BTFlowchart expandedNodeId={null} onNodeClick={() => {}} />);
    const items = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    expect(tabStops(container)).toEqual([items[1]]);
  });

  it('falls back to the first visible item when the remembered node is filtered out', () => {
    const { container, getByPlaceholderText } = render(<BTFlowchart expandedNodeId={null} onNodeClick={() => {}} />);
    const items = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    items[0].focus();
    fireEvent.change(getByPlaceholderText('Search BT nodes...'), { target: { value: items[3].getAttribute('aria-label')!.split(' — ')[0] } });
    const stops = tabStops(container);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(container.querySelector('[role="treeitem"]'));
  });
});

/** Depth-first row order of the fully expanded tree, mirroring the component's walk. */
function flatOrder() {
  const byId = new Map(BT_TREE.map(n => [n.id, n]));
  const parentOf = new Map<string, string>();
  const order: string[] = [];
  const walk = (id: string) => {
    order.push(id);
    for (const c of byId.get(id)!.children) { parentOf.set(c, id); walk(c); }
  };
  walk('root');
  return { byId, parentOf, order };
}

describe('BTFlowchart tree keyboard model (Home/End, parent/child arrows)', () => {
  const setup = () => {
    const { container } = render(<BTFlowchart expandedNodeId={null} onNodeClick={() => {}} />);
    const items = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    return { items, ...flatOrder() };
  };

  it('Home focuses the first row and End the last', () => {
    const { items } = setup();
    items[5].focus();
    fireEvent.keyDown(items[5], { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowLeft on a leaf moves focus to its parent', () => {
    const { items, byId, parentOf, order } = setup();
    const leaf = order.findIndex(id => byId.get(id)!.children.length === 0 && (parentOf.get(id) ?? 'root') !== 'root');
    const parentIdx = order.indexOf(parentOf.get(order[leaf])!);
    items[leaf].focus();
    fireEvent.keyDown(items[leaf], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items[parentIdx]);
  });

  it('ArrowRight on an expanded parent moves focus to its first child; Left on it collapses first', () => {
    const { items, byId, order } = setup();
    const parent = order.findIndex(id => id !== 'root' && byId.get(id)!.children.length > 0);
    items[parent].focus();
    fireEvent.keyDown(items[parent], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(items[parent + 1]);
    items[parent].focus();
    fireEvent.keyDown(items[parent], { key: 'ArrowLeft' });
    expect(items[parent].getAttribute('aria-expanded')).toBe('false');
  });

  it('ArrowLeft on a collapsed parent moves focus to its own parent', () => {
    const { items, byId, parentOf, order } = setup();
    const idx = order.findIndex(id => id !== 'root' && byId.get(id)!.children.length > 0);
    const parentIdx = order.indexOf(parentOf.get(order[idx])!);
    items[idx].focus();
    fireEvent.keyDown(items[idx], { key: 'ArrowLeft' });
    fireEvent.keyDown(items[idx], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items[parentIdx]);
  });
});
