import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia gaps.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { SidebarL2 } from '@/components/layout/SidebarL2';
import { useNavigationStore } from '@/stores/navigationStore';
import { getSubModulesForCategory } from '@/lib/module-registry';

const CATEGORY = 'core-engine' as const;

// jsdom has no ResizeObserver; TruncateWithTooltip (each item's label) needs one.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

function options(): HTMLButtonElement[] {
  return screen.getAllByRole('option') as HTMLButtonElement[];
}

describe('SidebarL2 — roving tabindex listbox', () => {
  beforeEach(() => {
    useNavigationStore.setState({ activeCategory: CATEGORY, activeSubModule: null });
  });

  it('gives exactly one option tabindex 0 — the active one', () => {
    const mods = getSubModulesForCategory(CATEGORY);
    expect(mods.length).toBeGreaterThan(2);
    const activeIdx = 2;
    useNavigationStore.setState({ activeSubModule: mods[activeIdx].id });
    render(<SidebarL2 />);

    const opts = options();
    expect(opts).toHaveLength(mods.length);
    const stops = opts.filter((o) => o.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(opts[activeIdx]);
    expect(opts[activeIdx].getAttribute('aria-selected')).toBe('true');
    opts.forEach((o, i) => {
      if (i !== activeIdx) expect(o.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('falls back to the first option as the tab stop when none is active', () => {
    render(<SidebarL2 />);
    const opts = options();
    expect(opts[0].getAttribute('tabindex')).toBe('0');
    opts.slice(1).forEach((o) => expect(o.getAttribute('tabindex')).toBe('-1'));
  });

  it('moves focus with ArrowDown, ArrowUp (wrapping), Home and End', () => {
    render(<SidebarL2 />);
    const opts = options();
    const last = opts.length - 1;

    opts[0].focus();
    fireEvent.keyDown(opts[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(opts[1]);

    fireEvent.keyDown(opts[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(opts[0]);

    // Wrap: ArrowUp from the first goes to the last, ArrowDown from the last to the first.
    fireEvent.keyDown(opts[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(opts[last]);
    fireEvent.keyDown(opts[last], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(opts[0]);

    fireEvent.keyDown(opts[0], { key: 'End' });
    expect(document.activeElement).toBe(opts[last]);
    fireEvent.keyDown(opts[last], { key: 'Home' });
    expect(document.activeElement).toBe(opts[0]);
  });
});
