/** useCoarsePointer follows the (hover: none) and (pointer: coarse) media query, false without matchMedia. */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';

const original = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = original; });

function stubMatchMedia(initial: boolean) {
  const state = { matches: initial };
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  window.matchMedia = ((q: string) => {
    queries.push(q);
    return {
      get matches() { return state.matches; },
      addEventListener: (_t: string, l: () => void) => listeners.add(l),
      removeEventListener: (_t: string, l: () => void) => listeners.delete(l),
    };
  }) as unknown as typeof window.matchMedia;
  return { state, listeners, queries };
}

describe('useCoarsePointer', () => {
  it('reads the touch-first query, re-renders on change, and unsubscribes on unmount', () => {
    const mm = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useCoarsePointer());
    expect(result.current).toBe(false);
    expect(mm.queries[0]).toBe('(hover: none) and (pointer: coarse)');
    act(() => { mm.state.matches = true; mm.listeners.forEach((l) => l()); });
    expect(result.current).toBe(true);
    unmount();
    expect(mm.listeners.size).toBe(0);
  });

  it('is false when matchMedia is unavailable', () => {
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useCoarsePointer());
    expect(result.current).toBe(false);
  });
});
