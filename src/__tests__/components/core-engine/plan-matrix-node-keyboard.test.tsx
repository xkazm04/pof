/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, accessibility-checker):
 * the plan map's feature nodes were plain divs with onClick only - no tabIndex,
 * role or key handler - so the DetailPanel and its Implement button were
 * pointer-only. Instrument: count the nodes reachable by key and drive
 * focus + Enter through the real PlanMatrixMap.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';

const plan = generatePlan(new Map());
vi.mock('@/hooks/useImplementationPlan', () => ({
  useImplementationPlan: () => ({ plan, loading: false, error: null }),
}));

import { PlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap';

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const dispatch = () => ({ ok: false, error: { unmet: [] } }) as never;

function mount(presses: number) {
  const utils = render(<PlanMatrixMap dispatch={dispatch} />);
  const surface = utils.container.querySelector('[tabindex="0"]') as HTMLElement;
  // jsdom measures 0px, so zoomToFit lands on the minimum zoom; step the
  // keyboard zoom until nodes render (dots >= 0.45, cards >= 0.8).
  for (let i = 0; i < presses; i++) fireEvent.keyDown(surface, { key: '+' });
  const nodes = () =>
    Array.from(surface.querySelectorAll<HTMLElement>('[data-node-key]'));
  const keyed = () =>
    Array.from(surface.querySelectorAll<HTMLElement>('[tabindex]')).filter((el) => el !== surface);
  return { ...utils, surface, nodes, keyed };
}

describe.each([
  ['dot nodes', 4],
  ['card nodes', 7],
])('PlanMatrixMap %s are keyboard-operable', (_label, presses) => {
  it('makes every node reachable by key (one roving tab stop)', () => {
    const { keyed } = mount(presses);
    expect(keyed().length).toBe(plan.items.length);
    expect(keyed().filter((el) => el.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(keyed().every((el) => el.getAttribute('role') === 'button')).toBe(true);
  });

  it('Enter on a focused node opens the detail panel for that node', () => {
    const { nodes, container } = mount(presses);
    const readyKeys = new Set(plan.items.filter((i) => i.isReady).map((i) => i.key));
    const node = nodes().find((el) => readyKeys.has(el.dataset.nodeKey ?? ''))!;
    expect(container.textContent).not.toContain('Implement Feature');
    node.focus();
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(container.textContent).toContain('Implement Feature'); // panel mounted for a ready node
    expect(node.getAttribute('aria-pressed')).toBe('true');
  });

  it('Arrow keys move focus between nodes instead of panning', () => {
    const { nodes } = mount(presses);
    const first = nodes()[0];
    first.focus();
    const seen = new Set<string>();
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      const from = document.activeElement as HTMLElement;
      fireEvent.keyDown(from, { key });
      seen.add((document.activeElement as HTMLElement).dataset.nodeKey ?? '');
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(document.activeElement).not.toBe(document.body);
  });
});
