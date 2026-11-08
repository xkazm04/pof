/** The tab follows the address on Back/Forward, as its contract says. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTabParam } from '@/hooks/useTabParam';

const TABS = ['core', 'loadout', 'tree'] as const;

function goTo(search: string) {
  window.history.replaceState({}, '', `/${search}`);
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
}

beforeEach(() => window.history.replaceState({}, '', '/'));
afterEach(cleanup);

describe('useTabParam', () => {
  it('reads a valid deep link on mount and ignores an unknown one', () => {
    window.history.replaceState({}, '', '/?t=tree');
    expect(renderHook(() => useTabParam('t', 'core', TABS)).result.current[0]).toBe('tree');
    window.history.replaceState({}, '', '/?t=nope');
    expect(renderHook(() => useTabParam('t', 'core', TABS)).result.current[0]).toBe('core');
  });

  it('writes the tab to the URL without adding a history entry', () => {
    const { result } = renderHook(() => useTabParam('t', 'core', TABS));
    const before = window.history.length;
    act(() => result.current[1]('loadout'));
    expect(window.location.search).toBe('?t=loadout');
    expect(window.history.length).toBe(before);
  });

  it('follows the address on popstate, falling back to the default', () => {
    const { result } = renderHook(() => useTabParam('t', 'core', TABS));
    goTo('?t=tree');
    expect(result.current[0]).toBe('tree');
    goTo('');
    expect(result.current[0]).toBe('core');
  });
});
