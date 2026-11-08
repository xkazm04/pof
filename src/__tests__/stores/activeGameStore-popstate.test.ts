/** Back onto an entry with no `g` keeps the address naming the game the store shows. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useActiveGameStore, useActiveGameUrlSync } from '@/stores/activeGameStore';

const gParam = () => new URLSearchParams(window.location.search).get('g');
const pop = () => window.dispatchEvent(new PopStateEvent('popstate'));

beforeEach(() => {
  localStorage.clear();
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
  window.history.replaceState({}, '', '/');
});
afterEach(cleanup);

describe('useActiveGameUrlSync popstate', () => {
  it('an entry with no g, while a non-default game is active, is rewritten to name it', () => {
    useActiveGameStore.setState({ gameId: 'gtai' });
    window.history.replaceState({}, '', '/?g=gtai');
    renderHook(() => useActiveGameUrlSync());

    window.history.pushState({}, '', '/?c=items'); // an older entry: no g
    pop();

    expect(useActiveGameStore.getState().gameId).toBe('gtai');
    expect(gParam()).toBe('gtai');
    expect(new URLSearchParams(window.location.search).get('c')).toBe('items');
  });

  it('[guard] with the default game active an absent g stays absent', () => {
    renderHook(() => useActiveGameUrlSync());
    window.history.pushState({}, '', '/?c=items');
    pop();
    expect(gParam()).toBeNull();
  });

  it('[guard] an entry naming another registered game is still adopted', () => {
    useActiveGameStore.setState({ gameId: 'gtai' });
    window.history.replaceState({}, '', '/?g=gtai');
    renderHook(() => useActiveGameUrlSync());
    window.history.pushState({}, '', '/?g=pof');
    pop();
    expect(useActiveGameStore.getState().gameId).toBe('pof');
  });
});
