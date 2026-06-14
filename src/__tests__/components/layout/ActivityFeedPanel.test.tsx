import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Drive the viewport width + reduced-motion preference per test (hoisted so the
// mock factories can read the live refs).
const { widthRef, reducedRef } = vi.hoisted(() => ({
  widthRef: { current: 1440 },
  reducedRef: { current: false },
}));

vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => widthRef.current,
  useViewportAtLeast: (bp: number) => widthRef.current >= bp,
  WIDE_FALLBACK_WIDTH: 1440,
}));

// Deterministic reduced-motion + avoid jsdom matchMedia gaps; keep real motion/AnimatePresence.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedRef.current };
});

import { ActivityFeedPanel } from '@/components/layout/ActivityFeedPanel';
import { useActivityFeedStore } from '@/stores/activityFeedStore';

describe('ActivityFeedPanel — animated open/close + responsive overlay', () => {
  beforeEach(() => {
    widthRef.current = 1440;
    reducedRef.current = false;
    useActivityFeedStore.setState({ events: [], isOpen: false });
  });

  it('renders nothing while closed', () => {
    render(<ActivityFeedPanel />);
    expect(screen.queryByRole('complementary', { name: 'Activity feed' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Activity feed' })).toBeNull();
    expect(screen.queryByText('Activity')).toBeNull();
  });

  it('wide viewport: renders an inline complementary column, not a dialog', () => {
    widthRef.current = 1440;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    expect(screen.getByRole('complementary', { name: 'Activity feed' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('activity-feed-backdrop')).toBeNull();
    expect(screen.getByText('Activity')).toBeTruthy();
  });

  it('narrow viewport: promotes to an overlay dialog over a dimmed backdrop', () => {
    widthRef.current = 800;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    expect(screen.getByRole('dialog', { name: 'Activity feed' })).toBeTruthy();
    const backdrop = screen.getByTestId('activity-feed-backdrop');
    expect(backdrop.className).toContain('bg-black/40');
    // The inline complementary column is not used in overlay mode.
    expect(screen.queryByRole('complementary', { name: 'Activity feed' })).toBeNull();
  });

  it('narrow viewport: Escape closes the drawer', () => {
    widthRef.current = 800;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    expect(screen.getByRole('dialog', { name: 'Activity feed' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useActivityFeedStore.getState().isOpen).toBe(false);
  });

  it('narrow viewport: clicking the backdrop closes the drawer', () => {
    widthRef.current = 800;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    fireEvent.click(screen.getByTestId('activity-feed-backdrop'));
    expect(useActivityFeedStore.getState().isOpen).toBe(false);
  });

  it('wide viewport: Escape does NOT close the inline column (only the overlay drawer reacts)', () => {
    widthRef.current = 1440;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useActivityFeedStore.getState().isOpen).toBe(true);
  });

  it('reduced motion: still renders the open feed (animation gating never hides content)', () => {
    reducedRef.current = true;
    widthRef.current = 1440;
    useActivityFeedStore.setState({ isOpen: true });
    render(<ActivityFeedPanel />);

    expect(screen.getByRole('complementary', { name: 'Activity feed' })).toBeTruthy();
    expect(screen.getByText('Activity')).toBeTruthy();
  });
});
