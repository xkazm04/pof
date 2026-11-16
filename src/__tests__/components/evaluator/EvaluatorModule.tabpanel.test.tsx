/**
 * scan-sweep (cross-module-features): the Evaluator tab strip declares
 * role="tablist"/role="tab", but the content had no role="tabpanel" and no tab
 * pointed at it (aria-controls), so a screen reader announced 31 tabs that
 * control nothing. WAI-ARIA tabs pattern: each tab controls the panel; the panel
 * is labelled by the active tab.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { EVALUATOR_TAB_INFO } from '@/lib/evaluator/tab-glossary';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);
beforeEach(() => { mockFetch({ body: { success: true, data: {} } }); });

describe('EvaluatorModule — tabs control a labelled tabpanel', () => {
  it('the active tab controls the panel, and the panel is named by it', () => {
    render(<EvaluatorModule />);
    const panel = screen.getByRole('tabpanel');
    const active = screen.getByRole('tab', { selected: true });
    expect(active.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(active.id);
    expect(screen.getByRole('tabpanel', { name: new RegExp(EVALUATOR_TAB_INFO.overview.label, 'i') })).toBeTruthy();
  });

  it('follows the selection', () => {
    render(<EvaluatorModule />);
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(EVALUATOR_TAB_INFO.spend.label, 'i') }));
    const active = screen.getByRole('tab', { selected: true });
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(active.id);
    expect(active.textContent).toContain(EVALUATOR_TAB_INFO.spend.label);
  });

  it('gives every tab a unique id', () => {
    render(<EvaluatorModule />);
    const ids = screen.getAllByRole('tab').map((t) => t.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
