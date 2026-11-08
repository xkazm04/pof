import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

afterEach(cleanup);

const { apiFetch, widthRef } = vi.hoisted(() => ({ apiFetch: vi.fn(), widthRef: { current: 600 } }));

vi.mock('@/hooks/useModuleActions', () => ({ useModuleActions: () => ({ sendPromptToModule: vi.fn() }) }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch };
});
vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => widthRef.current,
  useViewportAtLeast: (bp: number) => widthRef.current >= bp,
  WIDE_FALLBACK_WIDTH: 1440,
}));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { GlobalSearchPanel } from '@/components/layout/GlobalSearchPanel';
import { ActivityFeedPanel } from '@/components/layout/ActivityFeedPanel';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore } from '@/stores/navigationStore';

const raf = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });

function focusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])'));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string) =>
    url.includes('rebuild') ? { indexed: 1 } : { results: [], count: 0, lastRebuilt: null });
  useNavigationStore.setState({ navigateToModule: vi.fn() });
  useProjectStore.setState({ projectPath: '/proj' });
  useActivityFeedStore.setState({ events: [], isOpen: false });
  widthRef.current = 600;
});

describe('aria-modal surfaces hold and restore focus', () => {
  it('search palette: Tab from the last control wraps, closing returns focus to the opener', async () => {
    render(<><button>opener</button><GlobalSearchPanel /></>);
    const opener = screen.getByText('opener');
    opener.focus();
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const dialog = await screen.findByRole('dialog', { name: 'Global search' });
    await raf();
    const items = focusables(dialog);
    items[items.length - 1].focus();
    const notPrevented = fireEvent.keyDown(items[items.length - 1], { key: 'Tab' });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(items[0]);
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    expect(document.activeElement).toBe(opener);
  });

  it('feed drawer: focus moves in on open, Tab wraps, closing returns focus to the opener', async () => {
    render(<><button>opener</button><ActivityFeedPanel /></>);
    const opener = screen.getByText('opener');
    opener.focus();
    act(() => { useActivityFeedStore.setState({ isOpen: true }); });
    const dialog = await screen.findByRole('dialog', { name: 'Activity feed' });
    await raf();
    expect(dialog.contains(document.activeElement)).toBe(true);
    const items = focusables(dialog);
    items[items.length - 1].focus();
    const notPrevented = fireEvent.keyDown(items[items.length - 1], { key: 'Tab' });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(items[0]);
    act(() => { useActivityFeedStore.setState({ isOpen: false }); });
    expect(document.activeElement).toBe(opener);
  });
});
