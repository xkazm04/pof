import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);

vi.mock('@/hooks/useModuleActions', () => ({ useModuleActions: () => ({ sendPromptToModule: vi.fn() }) }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: vi.fn(async () => ({ results: [], count: 0, lastRebuilt: null, indexed: 0 })) };
});
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { SearchTrigger } from '@/components/layout/TopBar/HeaderButtons';
import { GlobalSearchPanel } from '@/components/layout/GlobalSearchPanel';
import { hotkeys } from '@/lib/hotkeys/hotkeyRegistry';

describe('topbar Search button', () => {
  it('opens global search even while a visible module owns mod+k', async () => {
    const moduleOwner = vi.fn();
    const off = hotkeys.register('mod+k', moduleOwner, { scope: 'module:spellbook', id: 'spellbook', allowInInput: true });
    render(<><SearchTrigger /><GlobalSearchPanel /></>);
    fireEvent.click(screen.getByTitle('Search (Ctrl+K)'));
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeTruthy();
    expect(moduleOwner).not.toHaveBeenCalled();
    off();
  });

  it('shows the same chord its title names', () => {
    render(<SearchTrigger />);
    expect(screen.getByTitle('Search (Ctrl+K)').querySelector('kbd')?.textContent).toBe('Ctrl K');
  });
});
