/** Pins the Lifecycle hook contract documented in docs/architecture/runtime-patterns.md. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useLifecycle, useGuardedLifecycle } from '@/hooks/useLifecycle';
import type { Lifecycle } from '@/lib/lifecycle';

function tracked(name: string, log: string[]): Lifecycle<void> {
  let active = false;
  return {
    init() { active = true; log.push(`init:${name}`); },
    isActive() { return active; },
    dispose() { active = false; log.push(`dispose:${name}`); },
  };
}

afterEach(cleanup);

describe('useLifecycle', () => {
  it('disposes the previous instance before initialising the next, and on unmount', () => {
    const log: string[] = [];
    const { rerender, unmount } = renderHook(({ dep }) => useLifecycle(() => tracked(dep, log), [dep]), {
      initialProps: { dep: 'a' },
    });
    rerender({ dep: 'b' });
    unmount();
    expect(log).toEqual(['init:a', 'dispose:a', 'init:b', 'dispose:b']);
  });

  it('keeps one instance while deps are unchanged', () => {
    const factory = vi.fn(() => tracked('a', []));
    const { rerender } = renderHook(() => useLifecycle(factory, ['same']));
    rerender();
    rerender();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('useGuardedLifecycle', () => {
  it('initialises once across re-renders and disposes on unmount', () => {
    const log: string[] = [];
    const factory = vi.fn(() => tracked('g', log));
    const { rerender, unmount } = renderHook(() => useGuardedLifecycle(factory));
    rerender();
    unmount();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['init:g', 'dispose:g']);
  });
});
