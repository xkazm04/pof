import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

const { sendPromptToModule, apiFetch, results } = vi.hoisted(() => ({
  sendPromptToModule: vi.fn(),
  apiFetch: vi.fn(),
  results: { current: [] as unknown[] },
}));

vi.mock('@/hooks/useModuleActions', () => ({
  useModuleActions: () => ({ sendPromptToModule }),
}));

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
import { SUB_MODULE_MAP } from '@/lib/module-registry';

const qa = SUB_MODULE_MAP['arpg-combat']!.quickActions[0];

async function openWithActionRow() {
  render(<GlobalSearchPanel />);
  act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
  const input = await screen.findByRole('textbox', { name: /search checklist items/i });
  fireEvent.change(input, { target: { value: qa.label } });
  await screen.findByText(qa.label);
  return input;
}

describe('GlobalSearchPanel — quick actions run only on Shift+Enter', () => {
  const navigateToModule = vi.fn();

  beforeEach(() => {
    sendPromptToModule.mockReset();
    navigateToModule.mockReset();
    apiFetch.mockReset();
    results.current = [{
      id: `qa-arpg-combat-${qa.id}`, type: 'checklist', moduleId: 'arpg-combat',
      moduleLabel: 'Combat', title: qa.label, snippet: '', rank: -1,
    }];
    apiFetch.mockImplementation(async (url: string) =>
      url.includes('rebuild') ? { indexed: 1 } : { results: results.current, count: 1, lastRebuilt: null });
    useNavigationStore.setState({ navigateToModule });
  });

  it('shows the hit as an Action, and Shift+Enter dispatches the exact registry prompt then closes', async () => {
    const input = await openWithActionRow();
    expect(screen.getByText('Action')).toBeTruthy();
    expect(sendPromptToModule).not.toHaveBeenCalled(); // never on render
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(sendPromptToModule).toHaveBeenCalledTimes(1);
    expect(sendPromptToModule).toHaveBeenCalledWith('arpg-combat', qa.prompt);
    expect(navigateToModule).not.toHaveBeenCalled();
    // AnimatePresence finishes the exit asynchronously.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Global search' })).toBeNull());
  });

  it('plain Enter on the same row navigates and never starts a run', async () => {
    const input = await openWithActionRow();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigateToModule).toHaveBeenCalledWith('arpg-combat');
    expect(sendPromptToModule).not.toHaveBeenCalled();
  });

  it('a click on the row body only navigates', async () => {
    await openWithActionRow();
    fireEvent.click(screen.getByText(qa.label));
    expect(navigateToModule).toHaveBeenCalledWith('arpg-combat');
    expect(sendPromptToModule).not.toHaveBeenCalled();
  });

  it('the row Run button is the explicit click that runs', async () => {
    await openWithActionRow();
    fireEvent.click(screen.getByRole('button', { name: `Run quick action ${qa.label}` }));
    expect(sendPromptToModule).toHaveBeenCalledTimes(1);
    expect(sendPromptToModule).toHaveBeenCalledWith('arpg-combat', qa.prompt);
    expect(navigateToModule).not.toHaveBeenCalled();
  });
});
