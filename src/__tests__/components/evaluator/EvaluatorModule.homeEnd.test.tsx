/**
 * scan-sweep (cross-module-features/B): the Evaluator tab strip (31 tabs) handles
 * Home/End like the WAI-ARIA tabs pattern, so the far tabs are 1 key away
 * instead of up to 30 ArrowRight presses.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);
beforeEach(() => { mockFetch({ body: { success: true, data: {} } }); });

const tabs = () => screen.getAllByRole('tab');
const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true');

describe('EvaluatorModule tab strip — Home/End', () => {
  it('End activates the last tab, Home activates the first', () => {
    render(<EvaluatorModule />);
    const all = tabs();
    expect(all.length).toBeGreaterThan(20);
    fireEvent.keyDown(selected()[0], { key: 'End' });
    expect(selected()).toHaveLength(1);
    expect(selected()[0]).toBe(tabs()[tabs().length - 1]);
    fireEvent.keyDown(selected()[0], { key: 'Home' });
    expect(selected()[0]).toBe(tabs()[0]);
  });

  it('ArrowRight still moves one tab (control)', () => {
    render(<EvaluatorModule />);
    fireEvent.keyDown(tabs()[0], { key: 'ArrowRight' });
    expect(selected()[0]).toBe(tabs()[1]);
  });
});
