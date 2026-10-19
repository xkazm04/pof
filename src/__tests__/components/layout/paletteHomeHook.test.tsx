import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

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
import { readRecents, recordRecent } from '@/components/layout/GlobalSearchPanel/recentSelections';

const navigateToModule = vi.fn();
const recent = { id: 'cl-arpg-combat-x', type: 'checklist' as const, moduleId: 'arpg-combat', moduleLabel: 'Combat', title: 'Recent thing', snippet: '', rank: 0 };

async function openPalette() {
  render(<GlobalSearchPanel />);
  act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
  return screen.findByRole('textbox', { name: /search checklist items/i });
}

describe('palette home (blank query)', () => {
  beforeEach(() => {
    // jsdom has no layout: the palette scrolls the active row into view.
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    sendPromptToModule.mockReset();
    navigateToModule.mockReset();
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (url: string) =>
      url.includes('rebuild')
        ? { indexed: 1 }
        : { results: [{ ...recent, id: 'cl-arpg-combat-found', title: 'Found hit' }], count: 1, lastRebuilt: null });
    useNavigationStore.setState({ navigateToModule });
    useProjectStore.setState({ projectPath: '/proj' });
    useActivityFeedStore.setState({
      events: [{
        id: 'e1', type: 'evaluator-recommendation', timestamp: 1, title: 'Fix the combat', description: 'd',
        moduleId: 'arpg-combat', dismissed: false, meta: { prompt: 'fix it now' },
      }],
    });
    recordRecent('/proj', recent);
    recordRecent('/other', { ...recent, id: 'cl-arpg-combat-leak', title: 'Other project thing' });
  });

  it('shows the alert then this project recents, and never another project', async () => {
    await openPalette();
    expect(await screen.findByText('Fix the combat')).toBeTruthy();
    expect(screen.getByText('Recent thing')).toBeTruthy();
    expect(screen.queryByText('Other project thing')).toBeNull();
  });

  it('Enter on the alert navigates and never runs', async () => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigateToModule).toHaveBeenCalledWith('arpg-combat');
    expect(sendPromptToModule).not.toHaveBeenCalled();
  });

  it('Shift+Enter on the alert runs the Fix prompt', async () => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(sendPromptToModule).toHaveBeenCalledWith('arpg-combat', 'fix it now');
    expect(navigateToModule).not.toHaveBeenCalled();
  });

  it('ArrowDown moves to the recent row and Enter navigates and records it once', async () => {
    const input = await openPalette();
    await screen.findByText('Recent thing');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigateToModule).toHaveBeenCalledWith('arpg-combat');
    const ids = readRecents('/proj').map((r) => r.id);
    expect(ids.filter((i) => i === recent.id)).toHaveLength(1);
    expect(ids[0]).toBe(recent.id);
  });

  it('typing replaces home rows with API results; clearing restores them', async () => {
    const input = await openPalette();
    await screen.findByText('Fix the combat');
    fireEvent.change(input, { target: { value: 'found' } });
    await screen.findByText('Found hit');
    expect(screen.queryByText('Fix the combat')).toBeNull();
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('Fix the combat')).toBeTruthy());
    expect(screen.queryByText('Found hit')).toBeNull();
  });

  it('selecting a typed result records it as a recent', async () => {
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'found' } });
    await screen.findByText('Found hit');
    fireEvent.click(screen.getByText('Found hit'));
    expect(readRecents('/proj')[0].id).toBe('cl-arpg-combat-found');
  });
});
