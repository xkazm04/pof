/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, render-path): a wheel
 * over the plan map must zoom the map and NOT scroll the page behind it. React
 * registers `onWheel` as a passive listener, so the canvas's
 * `e.preventDefault()` was a no-op (the browser logs "Unable to preventDefault
 * inside passive event listener") and the page scrolled while the map zoomed.
 * The sibling canvases (AudioScenePainter, OrreryStage) already bind a native
 * `{ passive: false }` listener; the plan map now does the same and routes the
 * zoom through useCanvasTransform's one zoom-to-point.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';

const plan = generatePlan(new Map());

vi.mock('@/hooks/useImplementationPlan', () => ({
  useImplementationPlan: () => ({ plan, loading: false, error: null }),
}));

import { PlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});
afterEach(cleanup);

const zoomLabel = () => screen.getByText(/^\d+%$/).textContent;

describe('PlanMatrixMap wheel', () => {
  it('a wheel zooms the map and its default (page scroll) is cancelled', () => {
    const { container } = render(<PlanMatrixMap dispatch={() => ({ ok: false, error: { unmet: [] } }) as never} />);
    const surface = container.querySelector('[tabindex="0"]') as HTMLElement;
    expect(surface).toBeTruthy();

    const before = zoomLabel();
    const notCancelled = fireEvent.wheel(surface, { deltaY: -100, clientX: 10, clientY: 10 });
    expect(notCancelled).toBe(false);
    expect(zoomLabel()).not.toBe(before);
  });
});
