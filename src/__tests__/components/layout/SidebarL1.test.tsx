import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia gaps.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

import { SidebarL1 } from '@/components/layout/SidebarL1';
import { useNavigationStore } from '@/stores/navigationStore';

describe('SidebarL1 flyout labels + expandable rail', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      activeCategory: null,
      activeSubModule: null,
      l1Expanded: false,
    });
  });

  it('collapsed rail exposes category names only via accessible name, not inline text', () => {
    render(<SidebarL1 />);
    // The button is reachable by its accessible (aria) label…
    expect(screen.getByRole('button', { name: 'Core Engine' })).toBeTruthy();
    // …but the label is not rendered as inline visible text while collapsed.
    expect(screen.queryByText('Core Engine')).toBeNull();
  });

  it('shows a styled flyout label on keyboard focus and reuses the category accent color', () => {
    render(<SidebarL1 />);
    const btn = screen.getByRole('button', { name: 'Core Engine' });

    fireEvent.focus(btn);

    const flyout = screen.getByText('Core Engine');
    expect(flyout).toBeTruthy();
    // Positioned pill contract from the requirement.
    expect(flyout.className).toContain('left-full');
    expect(flyout.className).toContain('bg-surface');
    expect(flyout.className).toContain('shadow-lg');
    // Core Engine accent (#3b82f6) — jsdom serializes inline hex → rgb.
    expect(flyout.style.color).toBe('rgb(59, 130, 246)');
  });

  it('expands the rail and renders labels inline when the toggle is clicked', () => {
    render(<SidebarL1 />);
    const toggle = screen.getByTestId('pof-sidebar-l1-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(useNavigationStore.getState().l1Expanded).toBe(true);
    // Inline label is now visible text (not just the flyout).
    expect(screen.getByText('Core Engine')).toBeTruthy();
    expect(screen.getByTestId('pof-sidebar-l1-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('toggle button has a descriptive accessible name that reflects state', () => {
    render(<SidebarL1 />);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();

    fireEvent.click(screen.getByTestId('pof-sidebar-l1-toggle'));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy();
  });
});
