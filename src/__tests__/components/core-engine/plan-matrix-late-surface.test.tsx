/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, state-coverage): the
 * plan map renders a spinner until its plan exists, so the canvas element its
 * mount-time effects measure does not exist on the first commit. The
 * ResizeObserver (minimap viewport size) and the viewport-height effects ran
 * once with `[]` deps against a null ref and never re-ran: a map opened before
 * statuses loaded kept the 800x560 default and the minimap viewport lied.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { generatePlan, type ImplementationPlan } from '@/lib/implementation-planner/plan-generator';

const state = vi.hoisted(() => ({ plan: null as ImplementationPlan | null, loading: true }));
vi.mock('@/hooks/useImplementationPlan', () => ({
  useImplementationPlan: () => ({ plan: state.plan, loading: state.loading, error: null }),
}));

import { PlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap';

const observed: Element[] = [];
beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(el: Element) { observed.push(el); }
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

describe('PlanMatrixMap surface that appears after the plan loads', () => {
  it('starts observing the canvas once it exists', () => {
    const dispatch = () => ({ ok: false, error: { unmet: [] } }) as never;
    const { rerender, container } = render(<PlanMatrixMap dispatch={dispatch} />);
    expect(container.textContent).toContain('Generating layout');
    expect(observed).toHaveLength(0);

    state.plan = generatePlan(new Map());
    state.loading = false;
    rerender(<PlanMatrixMap dispatch={dispatch} />);

    const surface = container.querySelector('[tabindex="0"]');
    expect(surface).toBeTruthy();
    expect(observed).toContain(surface);
  });
});
