/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, ux-reviewer): the
 * plan map navigator's "Search features (Cmd+K)" input had no value, no
 * onChange and no Cmd+K binding - typing changed 0 of 240 nodes. Instrument:
 * type a query through the real PlanMatrixMap and count the nodes still drawn
 * at full opacity.
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

function mount() {
  const utils = render(<PlanMatrixMap dispatch={dispatch} />);
  const surface = utils.container.querySelector('[tabindex="0"]') as HTMLElement;
  for (let i = 0; i < 4; i++) fireEvent.keyDown(surface, { key: '+' }); // render dot nodes
  const input = utils.getByPlaceholderText(/Search features/) as HTMLInputElement;
  const full = () =>
    Array.from(surface.querySelectorAll<HTMLElement>('[data-node-key]')).filter(
      (el) => el.style.opacity === '1',
    );
  return { ...utils, surface, input, full };
}

describe('PlanMatrixMap navigator search', () => {
  it('dims every node that does not match the query', () => {
    const { input, full } = mount();
    expect(full()).toHaveLength(plan.items.length);
    fireEvent.change(input, { target: { value: 'combo' } });
    const expected = plan.items.filter((i) => i.featureName.toLowerCase().includes('combo'));
    expect(expected.length).toBeGreaterThan(0);
    expect(full().map((el) => el.dataset.nodeKey).sort()).toEqual(expected.map((i) => i.key).sort());
  });

  it('clearing the query restores every node', () => {
    const { input, full } = mount();
    fireEvent.change(input, { target: { value: 'combo' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(full()).toHaveLength(plan.items.length);
  });

  it('Enter selects the first match and opens its detail panel', () => {
    const { input, container } = mount();
    expect(container.textContent).not.toContain('Depends on');
    fireEvent.change(input, { target: { value: 'combo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const first = plan.items.find((i) => i.featureName.toLowerCase().includes('combo'))!;
    const selected = container.querySelector('[data-node-key][aria-pressed="true"]') as HTMLElement;
    expect(selected?.dataset.nodeKey).toBe(first.key);
  });

  it('Cmd+K inside the map focuses the search input', () => {
    const { input, surface } = mount();
    surface.focus();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(surface, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);
  });
});
