/**
 * The behaviour-tree list is ONE composite widget (role="tree"): Tab must reach it
 * once and arrow keys move inside it (roving tabindex, keyed by node id). Before this
 * guard every one of the 54 treeitems was tabIndex=0, so tabbing past the tree cost
 * 54 key presses.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { BTFlowchart } from '@/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart';

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
