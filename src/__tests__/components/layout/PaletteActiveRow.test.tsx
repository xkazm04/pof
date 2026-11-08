import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

afterEach(cleanup);

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/hooks/useModuleActions', () => ({ useModuleActions: () => ({ sendPromptToModule: vi.fn() }) }));
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

const hit = (n: number) => ({
  id: `f-${n}`, type: 'feature', moduleId: 'arpg-combat', moduleLabel: 'Combat',
  title: `Combo ${n}`, snippet: '', rank: -n,
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string) =>
    url.includes('rebuild') ? { indexed: 2 } : { results: [hit(1), hit(2)], count: 2, lastRebuilt: null });
  useNavigationStore.setState({ navigateToModule: vi.fn() });
  useProjectStore.setState({ projectPath: '/proj' });
});

describe('palette exposes the active row to assistive tech', () => {
  it('ArrowDown moves aria-activedescendant to an existing row inside the controlled grid', async () => {
    render(<GlobalSearchPanel />);
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const input = await screen.findByRole('combobox', { name: /search checklist items/i });
    fireEvent.change(input, { target: { value: 'combo' } });
    await screen.findByText('Combo 2');

    const grid = document.getElementById(input.getAttribute('aria-controls') ?? '');
    expect(grid?.getAttribute('role')).toBe('grid');
    const first = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    expect(first?.getAttribute('data-index')).toBe('0');
    expect(grid?.contains(first)).toBe(true);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    expect(second?.getAttribute('data-index')).toBe('1');
    expect(second?.getAttribute('aria-selected')).toBe('true');
    expect(first?.getAttribute('aria-selected')).toBe('false');
  });
});
