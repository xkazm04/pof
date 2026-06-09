import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

import { ShellSkeleton } from '@/components/layout/ShellSkeleton';

describe('ShellSkeleton', () => {
  it('announces a busy "loading workspace" status region', () => {
    render(<ShellSkeleton />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-label')).toBe('Loading workspace');
    expect(region.getAttribute('aria-busy')).toBe('true');
    // Whole shell reads as one continuous pulse, not a spinner.
    expect(region.className).toContain('animate-pulse');
  });

  it('mirrors the real shell chrome: a 44px top bar and a 56px icon rail', () => {
    render(<ShellSkeleton />);

    // Top bar matches TopBar's h-11 (44px).
    const topbar = screen.getByTestId('pof-shell-skeleton-topbar');
    expect(topbar.className).toContain('h-11');
    expect(topbar.className).toContain('border-b');

    // Left rail matches the collapsed SidebarL1 width (56px).
    const rail = screen.getByTestId('pof-shell-skeleton-rail');
    expect(rail.style.width).toBe('56px');
    expect(rail.className).toContain('border-r');
    // A column of pulsing category icon placeholders (7 categories + toggle).
    const railIcons = rail.querySelectorAll('div');
    expect(railIcons.length).toBeGreaterThanOrEqual(7);
  });

  it('reuses the ModuleSkeleton tile grid for the content area', () => {
    render(<ShellSkeleton />);
    // The shared ModuleSkeleton renders its own status node + a 6-tile grid.
    const moduleSkeleton = screen.getByTestId('pof-module-skeleton');
    expect(moduleSkeleton).toBeTruthy();
    const tiles = moduleSkeleton.querySelectorAll('.rounded-lg');
    expect(tiles.length).toBeGreaterThanOrEqual(6);
  });
});
