/**
 * The one-shot drawer declares `role="dialog"` + `aria-modal="true"`, so it owes the
 * guarantees of one: focus moves in on open, Tab wraps inside, Escape closes, and focus
 * returns to the opener. It had none (no keydown handler, no trap, no restore).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/lib/one-shot/orchestrator', () => ({
  createOrchestrator: () => ({ start: vi.fn(), refine: vi.fn(), approveAndRun: vi.fn(), cancel: vi.fn() }),
}));

import { OneShotPanel } from '@/components/layout-lab/one-shot/OneShotPanel';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { LIGHT } from '@/components/layout-lab/theme';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Harness = () => (
  <>
    <button data-testid="opener">Open one-shot</button>
    <OneShotPanel t={LIGHT} />
  </>
);

beforeEach(() => {
  useOneShotJobStore.getState().reset();
  useOneShotLabStore.setState({ panelOpen: false, pendingNavigation: null });
});
afterEach(cleanup);

describe('OneShotPanel — an aria-modal dialog owns focus', () => {
  it('moves focus in on open, Escape closes, and focus returns to the opener', () => {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    opener.focus();

    act(() => { useOneShotLabStore.setState({ panelOpen: true }); });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(useOneShotLabStore.getState().panelOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />);
    act(() => { useOneShotLabStore.setState({ panelOpen: true }); });
    const dialog = screen.getByRole('dialog');
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    expect(items.length).toBeGreaterThan(1);
    const first = items[0];
    const last = items[items.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
