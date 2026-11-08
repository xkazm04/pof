import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

afterEach(cleanup);

const { sendPromptToModule, apiFetch } = vi.hoisted(() => ({
  sendPromptToModule: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock('@/hooks/useModuleActions', () => ({ useModuleActions: () => ({ sendPromptToModule }) }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch };
});
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { GlobalSearchPanel } from '@/components/layout/GlobalSearchPanel';
import { useNavigationStore } from '@/stores/navigationStore';
import { useProjectStore } from '@/stores/projectStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { readRecents } from '@/components/layout/GlobalSearchPanel/recentSelections';

async function openPalette() {
  render(<GlobalSearchPanel />);
  act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
  return screen.findByRole('textbox', { name: /search checklist items/i });
}

const feedEvent = (dismissed = false) => ({
  id: 'e1', type: 'evaluator-recommendation' as const, timestamp: 1, title: 'Fix the combat', description: 'd',
  moduleId: 'arpg-combat', dismissed, meta: { prompt: 'fix it now' },
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sendPromptToModule.mockReset();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string) =>
    url.includes('rebuild') ? { indexed: 1 } : { results: [], count: 0, lastRebuilt: null });
  useNavigationStore.setState({ navigateToModule: vi.fn() });
  useProjectStore.setState({ projectPath: '/proj' });
  useActivityFeedStore.setState({ events: [feedEvent()] });
});

describe('palette alert rows', () => {
  it('running the Fix marks the alert read, exactly as the feed card Fix does', async () => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(sendPromptToModule).toHaveBeenCalledTimes(1);
    expect(useActivityFeedStore.getState().events[0].dismissed).toBe(true);
  });

  it('opening an alert with Enter leaves it unread', async () => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useActivityFeedStore.getState().events[0].dismissed).toBe(false);
  });

  it.each([
    ['Enter', false],
    ['Shift+Enter', true],
  ])('%s on an alert does not write it into the persisted recents', async (_label, shiftKey) => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey });
    expect(readRecents('/proj').map((r) => r.id)).toEqual([]);
  });
});

describe('search failure', () => {
  it('a failed search reports the failure, never "No results"', async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url.includes('rebuild')) return { indexed: 1 };
      throw new Error('boom');
    });
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'dodge' } });
    await screen.findByRole('alert');
    expect(screen.queryByText(/No results for/)).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/failed/i);
  });

  it('Retry re-runs the same query and shows its hits', async () => {
    let fail = true;
    apiFetch.mockImplementation(async (url: string) => {
      if (url.includes('rebuild')) return { indexed: 1 };
      if (fail) throw new Error('boom');
      return { results: [{ id: 'cl-arpg-combat-x', type: 'checklist', moduleId: 'arpg-combat', moduleLabel: 'Combat', title: 'Dodge hit', snippet: '', rank: 0 }], count: 1, lastRebuilt: null };
    });
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'dodge' } });
    await screen.findByRole('alert');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText('Dodge hit');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
