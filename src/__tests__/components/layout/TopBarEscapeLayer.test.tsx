import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { mockFetchRoutes } from '../../setup';
import { useTopBar } from '@/components/layout/TopBar/useTopBar';
import { hotkeys } from '@/lib/hotkeys/hotkeyRegistry';

afterEach(() => { cleanup(); hotkeys.reset(); });

const escape = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

describe('project dropdown Escape rides the layer stack', () => {
  beforeEach(() => {
    mockFetchRoutes([{ match: '/api/recent-projects', response: { body: { success: true, data: [] } } }]);
  });

  it('with a layer pushed above the dropdown, one Escape closes only the topmost', () => {
    const { result } = renderHook(() => useTopBar());
    act(() => result.current.setDropdownOpen(true));
    const other = vi.fn();
    act(() => { hotkeys.pushLayer('other-layer', other); });
    expect(hotkeys.layers()).toEqual(['topbar-project-dropdown', 'other-layer']);

    escape();
    expect(other).toHaveBeenCalledTimes(1);
    expect(result.current.dropdownOpen).toBe(true);

    escape();
    expect(result.current.dropdownOpen).toBe(false);
    expect(hotkeys.layers()).toEqual([]);
  });
});
